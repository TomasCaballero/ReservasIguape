import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { findFreeUnitIds } from "./availability";
import type { ISODate } from "./dates";

// Toma de unidades. La garantía anti-superposición la da la exclusion constraint
// de UnitOccupancy (RNF-03): acá solo se elige un candidato, se intenta ocuparlo
// y, si otro lo ganó de mano, se prueba con el siguiente.

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** La constraint `UnitOccupancy_no_overlap` rechazó la inserción (SQLSTATE 23P01). */
export function isOverlapError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const e = current as { message?: unknown; code?: unknown; cause?: unknown; meta?: unknown };
    if (e.code === "23P01") return true;
    if (typeof e.message === "string" && /23P01|UnitOccupancy_no_overlap/.test(e.message)) return true;
    if (e.meta && JSON.stringify(e.meta).match(/23P01|UnitOccupancy_no_overlap/)) return true;
    current = e.cause;
  }
  return false;
}

/**
 * Libera los soft locks vencidos de la unidad (y el del token, si lo hay) para
 * poder ocuparla. Un lock vencido deja de contar en la disponibilidad (RF-26),
 * pero su fila de ocupación sigue chocando con la constraint hasta borrarse.
 * Se mide con la hora de la base de datos (RNF-07).
 */
export async function releaseExpiredLocks(tx: Tx, unitId: string, token?: string) {
  await tx.$executeRaw`
    DELETE FROM "SoftLock"
    WHERE ("unitId" = ${unitId}::uuid AND "expiresAt" <= now())
       OR (${token ?? null}::text IS NOT NULL AND "token" = ${token ?? null}::text)`;
}

/** Soft lock vigente de ese token para exactamente esa búsqueda: unidad que ya tiene reservada. */
export async function findOwnLockUnit(
  db: Db,
  p: { token: string; categoryId: string; checkIn: ISODate; checkOut: ISODate },
): Promise<string | null> {
  const rows = await db.$queryRaw<{ unitId: string }[]>`
    SELECT "unitId" FROM "SoftLock"
    WHERE "token" = ${p.token}
      AND "categoryId" = ${p.categoryId}::uuid
      AND "checkIn" = ${p.checkIn}::date AND "checkOut" = ${p.checkOut}::date
      AND "expiresAt" > now()`;
  return rows[0]?.unitId ?? null;
}

/** RF-25: bloquea una unidad de la categoría por 15 min. Devuelve null si no hay ninguna libre. */
export async function takeSoftLock(
  db: Db,
  p: { categoryId: string; checkIn: ISODate; checkOut: ISODate; previousToken?: string },
): Promise<{ token: string; expiresAt: Date } | null> {
  // Si el usuario reingresa al formulario, su lock anterior se libera primero
  // (si no, su propia unidad figuraría ocupada).
  if (p.previousToken) await releaseSoftLock(db, p.previousToken);
  const candidates = await findFreeUnitIds(db, p);
  for (const unitId of candidates) {
    const token = randomUUID();
    try {
      return await db.$transaction(async (tx) => {
        await releaseExpiredLocks(tx, unitId);
        const lock = await tx.softLock.create({
          data: {
            categoryId: p.categoryId,
            unitId,
            checkIn: new Date(p.checkIn),
            checkOut: new Date(p.checkOut),
            token,
          },
        });
        await tx.unitOccupancy.create({
          data: {
            unitId,
            startDate: new Date(p.checkIn),
            endDate: new Date(p.checkOut),
            softLockId: lock.id,
          },
        });
        return { token, expiresAt: lock.expiresAt };
      });
    } catch (error) {
      if (!isOverlapError(error)) throw error;
    }
  }
  return null;
}

export async function releaseSoftLock(db: Db, token: string) {
  await db.softLock.deleteMany({ where: { token } });
}
