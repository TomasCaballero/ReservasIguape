import type { PrismaClient } from "@/app/generated/prisma/client";
import type { ISODate } from "./dates";

export type CategoryAvailability = { categoryId: string; availableUnits: number };

/**
 * RF-09 / RF-04: categorías con al menos una unidad libre en [checkIn, checkOut)
 * y capacidad máxima >= huéspedes. Cuentan como ocupación las reservas
 * Pendiente/Confirmada, los bloqueos (manuales e iCal) y los soft locks vigentes.
 *
 * Un soft lock vencido se ignora (RF-26): vence cuando expiresAt <= ahora, con
 * tolerancia 0 y la hora del servidor de base de datos (RNF-07). `at` solo se
 * pasa en tests para fijar "ahora".
 */
export async function findAvailableCategories(
  prisma: Pick<PrismaClient, "$queryRaw">,
  params: { checkIn: ISODate; checkOut: ISODate; guests: number; at?: Date },
): Promise<CategoryAvailability[]> {
  const { checkIn, checkOut, guests, at } = params;
  return prisma.$queryRaw<CategoryAvailability[]>`
    SELECT c."id" AS "categoryId", COUNT(u."id")::int AS "availableUnits"
    FROM "Category" c
    JOIN "Unit" u ON u."categoryId" = c."id"
    WHERE c."maxCapacity" >= ${guests}
      AND NOT EXISTS (
        SELECT 1
        FROM "UnitOccupancy" o
        LEFT JOIN "SoftLock" s ON s."id" = o."softLockId"
        WHERE o."unitId" = u."id"
          AND o."startDate" < ${checkOut}::date
          AND o."endDate" > ${checkIn}::date
          AND (o."softLockId" IS NULL OR s."expiresAt" > COALESCE(${at ?? null}::timestamptz, now()))
      )
    GROUP BY c."id"
  `;
}
