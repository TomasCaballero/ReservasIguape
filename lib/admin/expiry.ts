import type { PrismaClient } from "@/app/generated/prisma/client";

// RF-54: una Pendiente sin ningún cobro vence `pendingExpiryDays` días después de que se le
// envió el método de pago. Se calcula con la hora de la base (D-06). No usa `changeBookingStatus`
// porque ese limpia la marca `cancelledByExpiry` (F7-3).

/** Cancela por vencimiento y libera las unidades. Devuelve cuántas reservas venció. */
export async function expirePendingBookings(db: PrismaClient): Promise<number> {
  return db.$transaction(async (tx) => {
    const expired = await tx.$queryRaw<{ id: string }[]>`
      UPDATE "Booking" b
      SET "status" = 'CANCELLED', "cancelledByExpiry" = true
      WHERE b."status" = 'PENDING'
        AND b."paymentInfoSentAt" IS NOT NULL
        AND b."paymentInfoSentAt" <= now() - ((SELECT "pendingExpiryDays" FROM "SystemSettings" WHERE "id" = 1) * interval '1 day')
        AND NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p."bookingId" = b."id")
      RETURNING b."id"`;
    if (expired.length > 0) {
      await tx.unitOccupancy.deleteMany({ where: { bookingId: { in: expired.map((r) => r.id) } } });
    }
    return expired.length;
  });
}
