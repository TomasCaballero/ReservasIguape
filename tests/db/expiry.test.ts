import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changeBookingStatus } from "@/lib/admin/bookings";
import { expirePendingBookings } from "@/lib/admin/expiry";
import { prisma } from "@/lib/prisma";
import { createFixture } from "./helpers";

const fx = createFixture();
let cat: { id: string; unitIds: string[] };
let days: number;
let n = 0;

beforeAll(async () => {
  cat = await fx.category("expiry", 2, 6);
  days = (await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } })).pendingExpiryDays;
});
afterAll(async () => {
  await fx.cleanup();
  await prisma.$disconnect();
});

/** Pendiente con el método de pago enviado hace `age` (intervalo de Postgres), o sin envío. */
async function pending(age: string | null) {
  const i = n++;
  const b = await fx.booking(cat, cat.unitIds[i], `2027-08-${10 + i}`, `2027-08-${11 + i}`, "PENDING");
  if (age) {
    await prisma.$executeRaw`UPDATE "Booking" SET "paymentInfoSentAt" = now() - ${age}::interval WHERE "id" = ${b.id}::uuid`;
  }
  return b.id;
}
const get = (id: string) => prisma.booking.findUniqueOrThrow({ where: { id } });
const occupied = async (id: string) => (await prisma.unitOccupancy.count({ where: { bookingId: id } })) > 0;

describe("expirePendingBookings", () => {
  it("vence justo al llegar al plazo, con marca, y libera la unidad (AC-79)", async () => {
    const id = await pending(`${days} days`);
    expect(await expirePendingBookings(prisma)).toBeGreaterThanOrEqual(1);
    expect(await get(id)).toMatchObject({ status: "CANCELLED", cancelledByExpiry: true });
    expect(await occupied(id)).toBe(false);
  });

  it("un minuto antes del plazo no vence (AC-79)", async () => {
    const id = await pending(`${days - 1} days 23 hours 59 minutes`);
    await expirePendingBookings(prisma);
    expect(await get(id)).toMatchObject({ status: "PENDING", cancelledByExpiry: false });
    expect(await occupied(id)).toBe(true);
  });

  it("con un cobro registrado no vence (AC-81)", async () => {
    const id = await pending(`${days + 3} days`);
    await prisma.payment.create({ data: { bookingId: id, amount: 1000, currency: "ARS", method: "Transferencia" } });
    await expirePendingBookings(prisma);
    expect((await get(id)).status).toBe("PENDING");
  });

  it("sin envío del método de pago no vence", async () => {
    const id = await pending(null);
    await expirePendingBookings(prisma);
    expect((await get(id)).status).toBe("PENDING");
  });

  it("la cancelación manual no lleva la marca de vencimiento (AC-80)", async () => {
    const id = await pending("1 day");
    expect((await changeBookingStatus(prisma, id, "CANCELLED")).ok).toBe(true);
    expect(await get(id)).toMatchObject({ status: "CANCELLED", cancelledByExpiry: false });
  });
});
