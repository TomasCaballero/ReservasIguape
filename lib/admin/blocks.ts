import type { PrismaClient } from "@/app/generated/prisma/client";
import { isOverlapError, releaseExpiredLocks } from "@/lib/booking/claim";
import { isValidISODate, type ISODate } from "@/lib/booking/dates";
import type { ActionResult } from "./bookings";

type Db = PrismaClient;

export type ManualBlockKind = "MAINTENANCE" | "OWNER";

export const BLOCK_KIND_LABEL: Record<ManualBlockKind | "ICAL", string> = {
  MAINTENANCE: "Mantenimiento",
  OWNER: "Uso de propietarios",
  ICAL: "Reserva externa (iCal)",
};

export const BLOCK_OVERLAP = "La unidad ya tiene una reserva o un bloqueo en esas fechas";

/**
 * RF-51: bloqueo manual de una unidad por mantenimiento o uso de propietarios. Ocupa las noches
 * [startDate, endDate): la fecha de fin queda libre, igual que un check-out. Reduce en 1 la
 * disponibilidad de su categoría (AC-75). Si se superpone con algo, 409.
 */
export async function createBlock(
  db: Db,
  input: { unitId: string; startDate: ISODate; endDate: ISODate; kind: ManualBlockKind; note?: string },
): Promise<ActionResult> {
  if (!isValidISODate(input.startDate) || !isValidISODate(input.endDate)) {
    return { ok: false, code: "INVALID_DATES", message: "Las fechas no son válidas", httpStatus: 400 };
  }
  if (input.endDate <= input.startDate) {
    return { ok: false, code: "INVALID_RANGE", message: "La fecha de fin debe ser posterior a la de inicio", httpStatus: 400 };
  }
  const unit = await db.unit.findUnique({ where: { id: input.unitId }, select: { id: true } });
  if (!unit) return { ok: false, code: "NOT_FOUND", message: "La unidad no existe", httpStatus: 404 };

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  try {
    await db.$transaction(async (tx) => {
      await releaseExpiredLocks(tx, input.unitId);
      const block = await tx.unitBlock.create({
        data: {
          unitId: input.unitId,
          startDate: start,
          endDate: end,
          kind: input.kind,
          note: input.note?.trim() || null,
        },
      });
      await tx.unitOccupancy.create({
        data: { unitId: input.unitId, startDate: start, endDate: end, blockId: block.id },
      });
    });
    return { ok: true };
  } catch (error) {
    if (isOverlapError(error)) {
      return { ok: false, code: "OVERLAP", message: BLOCK_OVERLAP, httpStatus: 409 };
    }
    throw error;
  }
}

/** Quita un bloqueo manual. Los bloqueos importados por iCal los gestiona la sincronización. */
export async function deleteBlock(db: Db, blockId: string): Promise<ActionResult> {
  const block = await db.unitBlock.findUnique({ where: { id: blockId } });
  if (!block) return { ok: false, code: "NOT_FOUND", message: "El bloqueo no existe", httpStatus: 404 };
  if (block.kind === "ICAL") {
    return {
      ok: false,
      code: "ICAL",
      message: "Los bloqueos de reservas externas se actualizan con la sincronización iCal",
      httpStatus: 400,
    };
  }
  await db.unitBlock.delete({ where: { id: blockId } }); // la ocupación se borra en cascada
  return { ok: true };
}
