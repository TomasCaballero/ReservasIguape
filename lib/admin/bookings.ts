import type { PrismaClient } from "@/app/generated/prisma/client";
import { findFreeUnitIds } from "@/lib/booking/availability";
import { isOverlapError, releaseExpiredLocks } from "@/lib/booking/claim";

// Ciclo de vida de la reserva en el panel (RF-48 a RF-53).
//
// Una reserva Pendiente o Confirmada ocupa una unidad (fila en UnitOccupancy, que la
// exclusion constraint protege). Al cancelarla o finalizarla se libera; al
// reactivarla se vuelve a ocupar una unidad y, si no hay, se responde 409 (RF-49).

type Db = PrismaClient;

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "FINISHED";

/** RF-48: únicas transiciones permitidas. */
export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CANCELLED", "FINISHED"],
  CANCELLED: ["PENDING", "CONFIRMED"],
  FINISHED: ["PENDING", "CONFIRMED", "CANCELLED"],
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  FINISHED: "Finalizada",
};

export const canTransition = (from: BookingStatus, to: BookingStatus) => TRANSITIONS[from].includes(to);

const isActive = (status: BookingStatus) => status === "PENDING" || status === "CONFIRMED";

export type ActionResult =
  | { ok: true }
  | { ok: false; code: string; message: string; httpStatus: 400 | 404 | 409 };

const fail = (code: string, message: string, httpStatus: 400 | 404 | 409): ActionResult => ({
  ok: false,
  code,
  message,
  httpStatus,
});

export const NOT_ALLOWED = "Transición no permitida";
export const NO_AVAILABILITY = "No hay disponibilidad en esas fechas";
export const UNIT_TAKEN = "La unidad ya tiene una reserva en esas fechas";

class StatusChanged extends Error {}

/**
 * RF-48, RF-49: cambia el estado de una reserva.
 * - Cancelar o finalizar libera la unidad (y una cancelación manual no lleva la marca de vencimiento, AC-80).
 * - Reactivar (Cancelada/Finalizada → Pendiente/Confirmada) vuelve a ocupar una unidad: primero la que
 *   tenía, si sigue libre, y si no cualquiera libre de la categoría. Sin ninguna, 409 y la reserva
 *   queda como estaba (AC-72). Al volver a Pendiente se limpian el envío del método de pago y la
 *   marca de vencimiento, para que no vuelva a vencer sola de inmediato.
 */
export async function changeBookingStatus(db: Db, bookingId: string, to: BookingStatus): Promise<ActionResult> {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return fail("NOT_FOUND", "La reserva no existe", 404);

  const from = booking.status as BookingStatus;
  if (!canTransition(from, to)) return fail("TRANSITION_NOT_ALLOWED", NOT_ALLOWED, 400);

  const data = {
    status: to,
    cancelledByExpiry: false,
    ...(to === "PENDING" ? { paymentInfoSentAt: null } : {}),
  };
  // Si otra persona cambió el estado mientras tanto, no se pisa su cambio.
  const guardedUpdate = async (tx: Pick<Db, "booking">, extra: Record<string, unknown> = {}) => {
    const updated = await tx.booking.updateMany({
      where: { id: bookingId, status: from },
      data: { ...data, ...extra },
    });
    if (updated.count === 0) throw new StatusChanged();
  };

  try {
    if (isActive(from) && isActive(to)) {
      await guardedUpdate(db);
      return { ok: true };
    }

    if (!isActive(to)) {
      await db.$transaction(async (tx) => {
        await guardedUpdate(tx);
        await tx.unitOccupancy.deleteMany({ where: { bookingId } });
      });
      return { ok: true };
    }

    // Reactivación.
    if (!booking.categoryId) {
      return fail("NO_CATEGORY", "La categoría de esta reserva ya no existe", 409);
    }
    const checkIn = booking.checkIn.toISOString().slice(0, 10);
    const checkOut = booking.checkOut.toISOString().slice(0, 10);
    const free = await findFreeUnitIds(db, { categoryId: booking.categoryId, checkIn, checkOut });
    const candidates = [
      ...(booking.unitId ? [booking.unitId] : []),
      ...free.filter((id) => id !== booking.unitId),
    ];

    for (const unitId of candidates) {
      try {
        await db.$transaction(async (tx) => {
          await releaseExpiredLocks(tx, unitId);
          await guardedUpdate(tx, { unitId, unitAssigned: booking.unitAssigned && booking.unitId === unitId });
          await tx.unitOccupancy.create({
            data: { unitId, startDate: booking.checkIn, endDate: booking.checkOut, bookingId },
          });
        });
        return { ok: true };
      } catch (error) {
        if (isOverlapError(error)) continue; // otra reserva ocupó la unidad: se prueba con la siguiente
        throw error;
      }
    }
    return fail("NO_AVAILABILITY", NO_AVAILABILITY, 409);
  } catch (error) {
    if (error instanceof StatusChanged) {
      return fail("STATE_CHANGED", "La reserva cambió de estado. Actualizá la pantalla.", 409);
    }
    throw error;
  }
}

/**
 * RF-50: asigna una unidad física concreta a una reserva Pendiente o Confirmada.
 * La unidad debe ser de la misma categoría. Si ya tiene otra reserva o bloqueo en
 * esas fechas, 409 y no se asigna (AC-74).
 */
export async function assignUnit(db: Db, bookingId: string, unitId: string): Promise<ActionResult> {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return fail("NOT_FOUND", "La reserva no existe", 404);
  if (!isActive(booking.status as BookingStatus)) {
    return fail("NOT_ACTIVE", "Solo se puede asignar unidad a una reserva Pendiente o Confirmada", 400);
  }
  const unit = await db.unit.findUnique({ where: { id: unitId } });
  if (!unit || unit.categoryId !== booking.categoryId) {
    return fail("WRONG_CATEGORY", "La unidad no pertenece a la categoría de la reserva", 400);
  }

  try {
    await db.$transaction(async (tx) => {
      if (booking.unitId !== unitId) {
        await releaseExpiredLocks(tx, unitId);
        const moved = await tx.unitOccupancy.updateMany({ where: { bookingId }, data: { unitId } });
        if (moved.count === 0) throw new Error("La reserva no tiene ocupación");
      }
      await tx.booking.update({ where: { id: bookingId }, data: { unitId, unitAssigned: true } });
    });
    return { ok: true };
  } catch (error) {
    if (isOverlapError(error)) return fail("UNIT_TAKEN", UNIT_TAKEN, 409);
    throw error;
  }
}

/** RF-52: registra, con la hora de la base de datos, que se envió el método de pago a un Pendiente. */
export async function markPaymentInfoSent(db: Db, bookingId: string): Promise<ActionResult> {
  const updated = await db.$executeRaw`
    UPDATE "Booking" SET "paymentInfoSentAt" = now(), "updatedAt" = now()
    WHERE "id" = ${bookingId}::uuid AND "status" = 'PENDING' AND "paymentInfoSentAt" IS NULL`;
  if (updated > 0) return { ok: true };

  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
  if (!booking) return fail("NOT_FOUND", "La reserva no existe", 404);
  if (booking.status !== "PENDING") {
    return fail("NOT_PENDING", "Solo se puede registrar el envío en una reserva Pendiente", 400);
  }
  return fail("ALREADY_SENT", "Ya se registró el envío del método de pago", 409);
}

export type UncontactedBooking = {
  id: string;
  reference: string;
  holderName: string;
  categoryName: string;
  checkIn: string;
  checkOut: string;
  createdAt: Date;
  hoursWaiting: number;
};

/**
 * RF-53: reservas Pendiente sin envío del método de pago registrado, una vez cumplido el plazo
 * de aviso (24 h por defecto). Solo se avisa: la reserva sigue Pendiente y ocupando (AC-78).
 * Mide con la hora de la base de datos; `at` solo se usa en tests.
 */
export async function findUncontactedBookings(db: Db, at?: Date): Promise<UncontactedBooking[]> {
  const settings = await db.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
  const rows = await db.$queryRaw<
    {
      id: string;
      firstName: string;
      lastName: string;
      categoryName: string;
      checkIn: Date;
      checkOut: Date;
      createdAt: Date;
      hours: number;
    }[]
  >`
    SELECT b."id", c."firstName", c."lastName", b."categoryName", b."checkIn", b."checkOut", b."createdAt",
           EXTRACT(EPOCH FROM (COALESCE(${at ?? null}::timestamptz, now()) - b."createdAt")) / 3600 AS hours
    FROM "Booking" b JOIN "Customer" c ON c."id" = b."customerId"
    WHERE b."status" = 'PENDING' AND b."paymentInfoSentAt" IS NULL
      AND b."createdAt" <= COALESCE(${at ?? null}::timestamptz, now()) - make_interval(hours => ${settings.pendingNoticeHours}::int)
    ORDER BY b."createdAt" ASC`;
  return rows.map((r) => ({
    id: r.id,
    reference: r.id.slice(0, 8).toUpperCase(),
    holderName: `${r.firstName} ${r.lastName}`,
    categoryName: r.categoryName,
    checkIn: r.checkIn.toISOString().slice(0, 10),
    checkOut: r.checkOut.toISOString().slice(0, 10),
    createdAt: r.createdAt,
    hoursWaiting: Math.floor(Number(r.hours)),
  }));
}
