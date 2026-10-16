import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBlock, deleteBlock } from "@/lib/admin/blocks";
import {
  assignUnit,
  changeBookingStatus,
  findUncontactedBookings,
  markPaymentInfoSent,
  NO_AVAILABILITY,
  NOT_ALLOWED,
  UNIT_TAKEN,
} from "@/lib/admin/bookings";
import { getMonthCalendar, occupiesNight } from "@/lib/admin/calendar";
import { findAvailableCategories } from "@/lib/booking/availability";
import { prisma } from "@/lib/prisma";
import { createFixture } from "./helpers";

const fx = createFixture();
type Cat = Awaited<ReturnType<typeof fx.category>>;

const available = async (cat: Cat, checkIn: string, checkOut: string) =>
  (await findAvailableCategories(prisma, { checkIn, checkOut, guests: 2 })).some((c) => c.categoryId === cat.id);
const reload = (id: string) =>
  prisma.booking.findUniqueOrThrow({ where: { id }, include: { occupancy: true } });

afterAll(async () => {
  await fx.cleanup();
  await prisma.$disconnect();
});

describe("cambio de estado (RF-48, RF-49)", () => {
  let cat: Cat;
  beforeAll(async () => {
    cat = await fx.category("estados", 4, 1);
  });

  it("Pendiente → Confirmada conserva la ocupación (AC-67)", async () => {
    const b = await fx.booking(cat, cat.unitIds[0], "2027-02-10", "2027-02-12", "PENDING");
    expect(await changeBookingStatus(prisma, b.id, "CONFIRMED")).toEqual({ ok: true });
    const after = await reload(b.id);
    expect(after.status).toBe("CONFIRMED");
    expect(after.occupancy).not.toBeNull();
    await changeBookingStatus(prisma, b.id, "CANCELLED");
  });

  it("cancelar la última unidad la libera para el portal (AC-68)", async () => {
    const b = await fx.booking(cat, cat.unitIds[0], "2027-03-10", "2027-03-12", "CONFIRMED");
    expect(await available(cat, "2027-03-10", "2027-03-12")).toBe(false);
    expect(await changeBookingStatus(prisma, b.id, "CANCELLED")).toEqual({ ok: true });
    expect(await available(cat, "2027-03-10", "2027-03-12")).toBe(true);
    expect((await reload(b.id)).cancelledByExpiry).toBe(false); // cancelación manual (AC-80)
  });

  it("rechaza Pendiente → Finalizada y Confirmada → Pendiente con 'Transición no permitida' (AC-69, AC-70)", async () => {
    const pending = await fx.booking(cat, cat.unitIds[0], "2027-04-10", "2027-04-12", "PENDING");
    expect(await changeBookingStatus(prisma, pending.id, "FINISHED")).toMatchObject({
      ok: false,
      message: NOT_ALLOWED,
    });
    expect((await reload(pending.id)).status).toBe("PENDING");

    await changeBookingStatus(prisma, pending.id, "CONFIRMED");
    expect(await changeBookingStatus(prisma, pending.id, "PENDING")).toMatchObject({
      ok: false,
      message: NOT_ALLOWED,
    });
    expect((await reload(pending.id)).status).toBe("CONFIRMED");
    await changeBookingStatus(prisma, pending.id, "CANCELLED");
  });

  it("una reserva Finalizada vuelve a Pendiente si hay disponibilidad (AC-71)", async () => {
    const b = await fx.booking(cat, cat.unitIds[0], "2027-05-10", "2027-05-12", "CONFIRMED");
    await changeBookingStatus(prisma, b.id, "FINISHED");
    expect((await reload(b.id)).occupancy).toBeNull();

    expect(await changeBookingStatus(prisma, b.id, "PENDING")).toEqual({ ok: true });
    const after = await reload(b.id);
    expect(after.status).toBe("PENDING");
    expect(after.occupancy).not.toBeNull();
    await changeBookingStatus(prisma, b.id, "CANCELLED");
  });

  it("reactivar sin disponibilidad da 409 y la reserva sigue Cancelada (AC-72)", async () => {
    const cancelled = await fx.booking(cat, cat.unitIds[0], "2027-06-10", "2027-06-12", "CONFIRMED");
    await changeBookingStatus(prisma, cancelled.id, "CANCELLED");
    const holder = await fx.booking(cat, cat.unitIds[0], "2027-06-10", "2027-06-12", "CONFIRMED");

    const result = await changeBookingStatus(prisma, cancelled.id, "CONFIRMED");
    expect(result).toMatchObject({ ok: false, httpStatus: 409, message: NO_AVAILABILITY });
    expect((await reload(cancelled.id)).status).toBe("CANCELLED");
    await changeBookingStatus(prisma, holder.id, "CANCELLED");
  });

  it("al volver a Pendiente se limpian el envío del método de pago y la marca de vencimiento", async () => {
    const b = await fx.booking(cat, cat.unitIds[0], "2027-07-10", "2027-07-12", "PENDING");
    await changeBookingStatus(prisma, b.id, "CANCELLED");
    await prisma.booking.update({
      where: { id: b.id },
      data: { cancelledByExpiry: true, paymentInfoSentAt: new Date() },
    });
    await changeBookingStatus(prisma, b.id, "PENDING");
    const after = await reload(b.id);
    expect(after.cancelledByExpiry).toBe(false);
    expect(after.paymentInfoSentAt).toBeNull();
    await changeBookingStatus(prisma, b.id, "CANCELLED");
  });

  it("dos reactivaciones simultáneas sobre la última unidad: solo una gana", async () => {
    const dates = ["2027-08-10", "2027-08-12"] as const;
    const x = await fx.booking(cat, cat.unitIds[0], ...dates, "CONFIRMED");
    await changeBookingStatus(prisma, x.id, "CANCELLED");
    const y = await fx.booking(cat, cat.unitIds[0], ...dates, "CONFIRMED");
    await changeBookingStatus(prisma, y.id, "CANCELLED");

    const results = await Promise.all([
      changeBookingStatus(prisma, x.id, "CONFIRMED"),
      changeBookingStatus(prisma, y.id, "CONFIRMED"),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.httpStatus === 409)).toHaveLength(1);
  });

  it("una reserva inexistente responde 404", async () => {
    expect(await changeBookingStatus(prisma, "00000000-0000-0000-0000-000000000000", "CONFIRMED")).toMatchObject({
      ok: false,
      httpStatus: 404,
    });
  });
});

describe("reactivar prefiere la unidad anterior (RF-49)", () => {
  it("vuelve a su unidad si sigue libre y si no, a otra libre de la categoría", async () => {
    const cat = await fx.category("dos", 4, 2);
    const b = await fx.booking(cat, cat.unitIds[0], "2027-09-10", "2027-09-12", "CONFIRMED");
    await changeBookingStatus(prisma, b.id, "CANCELLED");
    await changeBookingStatus(prisma, b.id, "CONFIRMED");
    expect((await reload(b.id)).unitId).toBe(cat.unitIds[0]);

    await changeBookingStatus(prisma, b.id, "CANCELLED");
    const holder = await fx.booking(cat, cat.unitIds[0], "2027-09-10", "2027-09-12", "CONFIRMED");
    expect(await changeBookingStatus(prisma, b.id, "CONFIRMED")).toEqual({ ok: true });
    expect((await reload(b.id)).unitId).toBe(cat.unitIds[1]);
    expect(holder.unitId).toBe(cat.unitIds[0]);
  });
});

describe("asignar unidad (RF-50)", () => {
  let cat: Cat;
  beforeAll(async () => {
    cat = await fx.category("asignar", 4, 3);
  });

  it("mueve la reserva a la unidad elegida y la marca como asignada (AC-73)", async () => {
    const b = await fx.booking(cat, cat.unitIds[0], "2027-02-10", "2027-02-14", "CONFIRMED");
    expect((await reload(b.id)).unitAssigned).toBe(false);

    expect(await assignUnit(prisma, b.id, cat.unitIds[1])).toEqual({ ok: true });
    const after = await reload(b.id);
    expect(after.unitId).toBe(cat.unitIds[1]);
    expect(after.unitAssigned).toBe(true);
    expect(after.occupancy?.unitId).toBe(cat.unitIds[1]);
    // la unidad anterior queda libre
    expect(await prisma.unitOccupancy.count({ where: { unitId: cat.unitIds[0] } })).toBe(0);
  });

  it("si la unidad ya tiene una reserva en esas fechas responde 409 y no asigna (AC-74)", async () => {
    const first = await fx.booking(cat, cat.unitIds[2], "2027-03-10", "2027-03-14", "CONFIRMED");
    const second = await fx.booking(cat, cat.unitIds[0], "2027-03-12", "2027-03-16", "CONFIRMED");
    expect(await assignUnit(prisma, first.id, cat.unitIds[2])).toEqual({ ok: true });

    const result = await assignUnit(prisma, second.id, cat.unitIds[2]);
    expect(result).toMatchObject({ ok: false, httpStatus: 409, message: UNIT_TAKEN });
    const after = await reload(second.id);
    expect(after.unitId).toBe(cat.unitIds[0]);
    expect(after.unitAssigned).toBe(false);
  });

  it("rechaza unidades de otra categoría y reservas que no están activas", async () => {
    const other = await fx.category("otra", 4, 1);
    const b = await fx.booking(cat, cat.unitIds[0], "2027-04-10", "2027-04-12", "PENDING");
    expect(await assignUnit(prisma, b.id, other.unitIds[0])).toMatchObject({ ok: false, code: "WRONG_CATEGORY" });

    await changeBookingStatus(prisma, b.id, "CANCELLED");
    expect(await assignUnit(prisma, b.id, cat.unitIds[0])).toMatchObject({ ok: false, code: "NOT_ACTIVE" });
  });
});

describe("envío del método de pago (RF-52)", () => {
  it("registra la fecha y hora del envío en una reserva Pendiente (AC-76)", async () => {
    const cat = await fx.category("envio", 4, 1);
    const b = await fx.booking(cat, cat.unitIds[0], "2027-02-10", "2027-02-12", "PENDING");
    expect(await markPaymentInfoSent(prisma, b.id)).toEqual({ ok: true });
    const sent = (await reload(b.id)).paymentInfoSentAt;
    expect(sent).not.toBeNull();
    expect(Math.abs(sent!.getTime() - Date.now())).toBeLessThan(10_000);

    expect(await markPaymentInfoSent(prisma, b.id)).toMatchObject({ ok: false, code: "ALREADY_SENT" });
  });

  it("solo en reservas Pendiente", async () => {
    const cat = await fx.category("envio2", 4, 1);
    const b = await fx.booking(cat, cat.unitIds[0], "2027-02-10", "2027-02-12", "CONFIRMED");
    expect(await markPaymentInfoSent(prisma, b.id)).toMatchObject({ ok: false, code: "NOT_PENDING" });
  });
});

describe("aviso de reservas sin contacto (RF-53)", () => {
  it("lista la de 24 h 00 min y no la de 23 h 59 min; la reserva sigue Pendiente y ocupando (AC-77, AC-78)", async () => {
    const cat = await fx.category("aviso", 4, 3);
    const old = await fx.booking(cat, cat.unitIds[0], "2027-02-10", "2027-02-12", "PENDING");
    const recent = await fx.booking(cat, cat.unitIds[1], "2027-02-10", "2027-02-12", "PENDING");
    const sent = await fx.booking(cat, cat.unitIds[2], "2027-02-10", "2027-02-12", "PENDING");
    await prisma.$executeRaw`UPDATE "Booking" SET "createdAt" = now() - interval '24 hours' WHERE id = ${old.id}::uuid`;
    await prisma.$executeRaw`UPDATE "Booking" SET "createdAt" = now() - interval '23 hours 59 minutes' WHERE id = ${recent.id}::uuid`;
    await prisma.$executeRaw`UPDATE "Booking" SET "createdAt" = now() - interval '48 hours', "paymentInfoSentAt" = now() WHERE id = ${sent.id}::uuid`;

    const listed = (await findUncontactedBookings(prisma)).map((b) => b.id);
    expect(listed).toContain(old.id);
    expect(listed).not.toContain(recent.id);
    expect(listed).not.toContain(sent.id);

    const after = await reload(old.id);
    expect(after.status).toBe("PENDING");
    expect(after.occupancy).not.toBeNull();
    expect(await available(cat, "2027-02-10", "2027-02-12")).toBe(false);
  });
});

describe("bloqueos manuales (RF-51)", () => {
  it("bloquear una unidad baja en 1 la disponibilidad de la categoría y se puede quitar (AC-75)", async () => {
    const cat = await fx.category("bloqueos", 4, 1);
    expect(await available(cat, "2027-12-02", "2027-12-04")).toBe(true);

    const input = { unitId: cat.unitIds[0], startDate: "2027-12-01", endDate: "2027-12-05", kind: "MAINTENANCE" as const };
    expect(await createBlock(prisma, input)).toEqual({ ok: true });
    expect(await available(cat, "2027-12-02", "2027-12-04")).toBe(false);
    expect(await available(cat, "2027-12-05", "2027-12-07")).toBe(true); // el día de fin queda libre

    const block = await prisma.unitBlock.findFirstOrThrow({ where: { unitId: cat.unitIds[0] } });
    expect(await deleteBlock(prisma, block.id)).toEqual({ ok: true });
    expect(await available(cat, "2027-12-02", "2027-12-04")).toBe(true);
  });

  it("rechaza rangos inválidos y superposiciones con 409", async () => {
    const cat = await fx.category("bloqueos2", 4, 1);
    await fx.booking(cat, cat.unitIds[0], "2027-11-10", "2027-11-14", "CONFIRMED");
    const base = { unitId: cat.unitIds[0], kind: "OWNER" as const };
    expect(await createBlock(prisma, { ...base, startDate: "2027-11-12", endDate: "2027-11-12" })).toMatchObject({ ok: false, httpStatus: 400 });
    expect(await createBlock(prisma, { ...base, startDate: "2027-11-12", endDate: "2027-11-16" })).toMatchObject({ ok: false, httpStatus: 409 });
    expect(await createBlock(prisma, { ...base, startDate: "2027-11-14", endDate: "2027-11-16" })).toEqual({ ok: true });
  });

  it("no permite quitar un bloqueo importado por iCal", async () => {
    const cat = await fx.category("bloqueos3", 4, 1);
    const block = await prisma.unitBlock.create({
      data: { unitId: cat.unitIds[0], startDate: new Date("2027-10-01"), endDate: new Date("2027-10-03"), kind: "ICAL" },
    });
    expect(await deleteBlock(prisma, block.id)).toMatchObject({ ok: false, code: "ICAL" });
  });
});

describe("calendario de ocupación (RF-47)", () => {
  it("una reserva del 10 al 14 ocupa las noches 10 a 13 y deja libre el 14 (AC-66)", async () => {
    const cat = await fx.category("calendario", 4, 2);
    const b = await fx.booking(cat, cat.unitIds[0], "2027-11-10", "2027-11-14", "CONFIRMED");
    await createBlock(prisma, { unitId: cat.unitIds[1], startDate: "2027-11-20", endDate: "2027-11-22", kind: "OWNER" });

    const calendar = await getMonthCalendar(prisma, "2027-11");
    expect(calendar.days).toHaveLength(30);
    expect([calendar.previous, calendar.next]).toEqual(["2027-10", "2027-12"]);

    const row = calendar.rows.find((r) => r.unitId === cat.unitIds[0])!;
    const entry = row.entries.find((e) => e.kind === "booking")!;
    expect(entry).toMatchObject({ bookingId: b.id, status: "CONFIRMED", unassigned: true });
    const occupied = calendar.days.filter((d) => occupiesNight(entry, d));
    expect(occupied).toEqual(["2027-11-10", "2027-11-11", "2027-11-12", "2027-11-13"]);

    const blockRow = calendar.rows.find((r) => r.unitId === cat.unitIds[1])!;
    expect(blockRow.entries[0]).toMatchObject({ kind: "block", blockKind: "OWNER", start: "2027-11-20", end: "2027-11-22" });
  });

  it("incluye reservas de un mes anterior que se extienden al mes pedido", async () => {
    const cat = await fx.category("calendario2", 4, 1);
    await fx.booking(cat, cat.unitIds[0], "2028-01-29", "2028-02-03", "CONFIRMED");
    const calendar = await getMonthCalendar(prisma, "2028-02");
    const row = calendar.rows.find((r) => r.unitId === cat.unitIds[0])!;
    expect(row.entries).toHaveLength(1);
    expect(calendar.days.filter((d) => occupiesNight(row.entries[0], d))).toEqual(["2028-02-01", "2028-02-02"]);
  });
});
