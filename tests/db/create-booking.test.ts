import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findAvailableCategories } from "@/lib/booking/availability";
import { releaseSoftLock, takeSoftLock } from "@/lib/booking/claim";
import { createBooking, UNAVAILABLE_MESSAGE, type CreateBookingInput } from "@/lib/booking/create-booking";
import { prisma } from "@/lib/prisma";
import { createFixture } from "./helpers";

const fx = createFixture();
// "Hoy" fijo para que los tests no dependan de la fecha real.
const NOW = new Date("2027-01-02T12:00:00Z");

type Cat = Awaited<ReturnType<typeof fx.category>> & { slug: string };
let single: Cat; // 1 unidad
let double: Cat; // 2 unidades

const slugOf = (name: string) => `${fx.tag}-${name}`;

beforeAll(async () => {
  single = { ...(await fx.category("single", 5, 1)), slug: slugOf("single") };
  double = { ...(await fx.category("double", 5, 2)), slug: slugOf("double") };
});
afterAll(async () => {
  await fx.cleanup();
  await prisma.$disconnect();
});

const input = (cat: Cat, checkIn: string, checkOut: string, extra: Partial<CreateBookingInput> = {}): CreateBookingInput => ({
  categorySlug: cat.slug,
  checkIn,
  checkOut,
  adults: 2,
  children: 0,
  currency: "ARS",
  holder: fx.holder(),
  companions: [],
  ...extra,
});

const countBookings = (cat: Cat) => prisma.booking.count({ where: { categoryId: cat.id } });

describe("creación de la reserva (RF-28, RF-29)", () => {
  it("crea una reserva Pendiente, Web Directa, sin unidad asignada y con el precio del servidor (AC-33, 42, 43)", async () => {
    const r = await createBooking(prisma, input(double, "2027-02-10", "2027-02-13"), NOW);
    if (!r.ok) throw new Error(JSON.stringify(r));
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: r.booking.id },
      include: { guests: true, occupancy: true },
    });
    expect(booking.status).toBe("PENDING");
    expect(booking.source).toBe("WEB_DIRECT");
    expect(booking.unitAssigned).toBe(false);
    expect(booking.guests).toHaveLength(0);
    expect(booking.occupancy).not.toBeNull(); // ocupa una unidad provisoria
    expect(Number(booking.total)).toBe(120000); // 3 noches × $40.000
    expect(r.booking.reference).toHaveLength(8);
  });

  it("guarda los acompañantes (AC-34)", async () => {
    const r = await createBooking(
      prisma,
      input(double, "2027-03-10", "2027-03-12", {
        companions: [
          { firstName: "Ana", lastName: "Gómez", documentNumber: "30111222", birthDate: "1992-02-02" },
          { firstName: "Luis", lastName: "Gómez", documentNumber: "30111223", birthDate: "2015-03-03" },
        ],
        adults: 2,
        children: 1,
      }),
      NOW,
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(await prisma.guest.count({ where: { bookingId: r.booking.id } })).toBe(2);
  });

  it("rechaza datos inválidos con errores por campo y no crea nada (AC-26..32)", async () => {
    const before = await countBookings(double);
    const r = await createBooking(
      prisma,
      input(double, "2027-04-10", "2027-04-12", {
        holder: fx.holder({ email: "juan@", phoneNumber: "123", documentNumber: "123", birthDate: "2015-01-01" }),
      }),
      NOW,
    );
    expect(r).toMatchObject({ ok: false, status: 400 });
    if (r.ok || !("errors" in r)) throw new Error("se esperaban errores por campo");
    expect(Object.keys(r.errors).sort()).toEqual(["birthDate", "documentNumber", "email", "phoneNumber"]);
    expect(await countBookings(double)).toBe(before);
  });

  it("recalcula la estadía mínima y la capacidad en el servidor", async () => {
    const r = await createBooking(prisma, input(double, "2027-04-10", "2027-04-12", { adults: 5, children: 1 }), NOW);
    expect(r).toMatchObject({ ok: false, status: 400, error: { code: "CAPACITY" } });
  });

  it("actualiza email y teléfono del cliente existente: 1 solo cliente (AC-89)", async () => {
    const holder = fx.holder();
    await createBooking(prisma, input(double, "2027-05-10", "2027-05-12", { holder }), NOW);
    await createBooking(
      prisma,
      input(double, "2027-06-10", "2027-06-12", { holder: { ...holder, email: "b@mail.com", phoneNumber: "1166667777" } }),
      NOW,
    );
    const customers = await prisma.customer.findMany({ where: { documentNumber: holder.documentNumber } });
    expect(customers).toHaveLength(1);
    expect(customers[0].email).toBe("b@mail.com");
    expect(customers[0].phone).toBe("+54 1166667777");
  });
});

describe("soft lock y disponibilidad (RF-25, RF-27)", () => {
  it("con la unidad bloqueada por A, B no puede reservarla (AC-37) y A sí (AC-39)", async () => {
    const dates = ["2027-07-10", "2027-07-12"] as const;
    const lock = await takeSoftLock(prisma, { categoryId: single.id, checkIn: dates[0], checkOut: dates[1] });
    expect(lock).not.toBeNull();

    const b = await createBooking(prisma, input(single, ...dates), NOW);
    expect(b).toMatchObject({ ok: false, status: 409, error: { message: UNAVAILABLE_MESSAGE } });

    const a = await createBooking(prisma, input(single, ...dates, { softLockToken: lock!.token }), NOW);
    expect(a.ok).toBe(true);
    expect(await prisma.softLock.count({ where: { token: lock!.token } })).toBe(0); // consumido
  });

  it("si el soft lock venció y la unidad sigue libre, se renueva y se crea la reserva (AC-39)", async () => {
    const dates = ["2027-08-10", "2027-08-12"] as const;
    await fx.softLock(single, single.unitIds[0], ...dates, new Date(Date.now() - 60_000)); // venció
    const r = await createBooking(prisma, input(single, ...dates), NOW);
    expect(r.ok).toBe(true);
  });

  it("si el lock venció y otro tomó la última unidad: 409 y no se crea nada (AC-40)", async () => {
    const dates = ["2027-09-10", "2027-09-12"] as const;
    const first = await takeSoftLock(prisma, { categoryId: single.id, checkIn: dates[0], checkOut: dates[1] });
    // Vence el lock de A (a mano) y B se queda con la unidad.
    await prisma.softLock.updateMany({ where: { token: first!.token }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const b = await createBooking(prisma, input(single, ...dates), NOW);
    expect(b.ok).toBe(true);

    const before = await countBookings(single);
    const a = await createBooking(prisma, input(single, ...dates, { softLockToken: first!.token }), NOW);
    expect(a).toMatchObject({ ok: false, status: 409, error: { message: UNAVAILABLE_MESSAGE } });
    expect(await countBookings(single)).toBe(before);
  });

  it("tomar y soltar un soft lock oculta y devuelve la categoría", async () => {
    const dates = ["2027-10-10", "2027-10-12"] as const;
    const visible = async () =>
      (await findAvailableCategories(prisma, { checkIn: dates[0], checkOut: dates[1], guests: 2 })).some(
        (c) => c.categoryId === single.id,
      );
    const lock = await takeSoftLock(prisma, { categoryId: single.id, checkIn: dates[0], checkOut: dates[1] });
    expect(await visible()).toBe(false);
    await releaseSoftLock(prisma, lock!.token);
    expect(await visible()).toBe(true);
  });

  it("un reintento con el mismo token no duplica la reserva", async () => {
    const dates = ["2027-11-10", "2027-11-12"] as const;
    const lock = await takeSoftLock(prisma, { categoryId: double.id, checkIn: dates[0], checkOut: dates[1] });
    const body = input(double, ...dates, { softLockToken: lock!.token });
    const [x, y] = await Promise.all([createBooking(prisma, body, NOW), createBooking(prisma, body, NOW)]);
    expect(x.ok && y.ok).toBe(true);
    if (x.ok && y.ok) expect(x.booking.id).toBe(y.booking.id);
    expect(await prisma.booking.count({ where: { requestToken: lock!.token } })).toBe(1);
  });
});

describe("concurrencia (RNF-03, AC-41)", () => {
  it("20 confirmaciones sobre la última unidad: 1 reserva y 19 con 409", async () => {
    const cat = { ...(await fx.category("race", 5, 1)), slug: slugOf("race") };
    const dates = ["2027-12-10", "2027-12-12"] as const;
    const results = await Promise.all(
      Array.from({ length: 20 }, () => createBooking(prisma, input(cat, ...dates), NOW)),
    );
    const ok = results.filter((r) => r.ok);
    const conflicts = results.filter((r) => !r.ok && r.status === 409);
    expect(ok).toHaveLength(1);
    expect(conflicts).toHaveLength(19);
    for (const c of conflicts) {
      if (!c.ok && "error" in c) expect(c.error.message).toBe(UNAVAILABLE_MESSAGE);
    }
    expect(await countBookings(cat)).toBe(1);
  });
});
