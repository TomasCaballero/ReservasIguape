import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymizeCustomer, requestAnonymization } from "@/lib/admin/customers";
import { prisma } from "@/lib/prisma";
import { createFixture } from "./helpers";

const fx = createFixture();
let category: { id: string; unitIds: string[] };

beforeAll(async () => {
  category = await fx.category("anon", 4, 2);
});

afterAll(async () => {
  await fx.cleanup();
  await prisma.$disconnect();
});

describe("solicitud de anonimización (RF-61)", () => {
  it("guarda la fecha de la base y queda pendiente (AC-95)", async () => {
    const c = await fx.customer();
    expect(await requestAnonymization(prisma, c.id)).toEqual({ ok: true });
    const [request] = await prisma.anonymizationRequest.findMany({ where: { customerId: c.id } });
    expect(request.completedAt).toBeNull();
    expect(Math.abs(Date.now() - request.requestedAt.getTime())).toBeLessThan(60_000);
  });

  it("una segunda solicitud pendiente del mismo cliente se rechaza (D-04)", async () => {
    const c = await fx.customer();
    await requestAnonymization(prisma, c.id);
    expect(await requestAnonymization(prisma, c.id)).toMatchObject({ ok: false, httpStatus: 409, code: "ALREADY_PENDING" });
    expect(await prisma.anonymizationRequest.count({ where: { customerId: c.id } })).toBe(1);
  });

  it("responde 404 si el cliente no existe", async () => {
    expect(await requestAnonymization(prisma, "00000000-0000-0000-0000-000000000000")).toMatchObject({
      ok: false,
      httpStatus: 404,
    });
  });
});

describe("anonimizar (RF-62)", () => {
  async function customerWithStay() {
    const c = await fx.customer({ firstName: "Rosa", lastName: "Real", birthDate: "1970-02-02" });
    const booking = await prisma.booking.create({
      data: {
        customerId: c.id,
        categoryId: category.id,
        categoryName: "anon",
        unitId: category.unitIds[0],
        checkIn: new Date("2027-04-10"),
        checkOut: new Date("2027-04-13"),
        adults: 2,
        status: "FINISHED",
        currency: "ARS",
        subtotal: 90000,
        total: 90000,
        guests: {
          create: [{ firstName: "Luis", lastName: "Real", documentNumber: "30111222", birthDate: new Date("1971-03-03") }],
        },
      },
    });
    return { c, booking };
  }

  it("reemplaza titular y acompañantes y conserva las fechas de estadía (AC-96)", async () => {
    const { c, booking } = await customerWithStay();
    await requestAnonymization(prisma, c.id);
    expect(await anonymizeCustomer(prisma, c.id)).toEqual({ ok: true });

    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(customer).toMatchObject({
      firstName: "Anonimizado",
      lastName: "Anonimizado",
      email: "anonimizado@anonimizado.invalid",
      phone: "-",
      documentNumber: `ANON-${c.id}`,
    });
    expect(customer.birthDate.toISOString().slice(0, 10)).toBe("1900-01-01");
    expect(customer.anonymizedAt).not.toBeNull();

    const guest = await prisma.guest.findFirstOrThrow({ where: { bookingId: booking.id } });
    expect(guest).toMatchObject({ firstName: "Anonimizado", lastName: "Anonimizado", documentNumber: `ANON-${guest.id}` });

    const kept = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(kept.checkIn.toISOString().slice(0, 10)).toBe("2027-04-10");
    expect(kept.checkOut.toISOString().slice(0, 10)).toBe("2027-04-13");
    expect(Number(kept.total)).toBe(90000);

    const [request] = await prisma.anonymizationRequest.findMany({ where: { customerId: c.id } });
    expect(request.completedAt).not.toBeNull();
  });

  it("anonimizar dos clientes no choca con la unicidad del documento (D-03)", async () => {
    const a = await fx.customer();
    const b = await fx.customer();
    expect(await anonymizeCustomer(prisma, a.id)).toEqual({ ok: true });
    expect(await anonymizeCustomer(prisma, b.id)).toEqual({ ok: true });
  });

  it("anonimizar dos veces responde 409 sin cambios (D-04)", async () => {
    const c = await fx.customer();
    await anonymizeCustomer(prisma, c.id);
    const before = await prisma.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(await anonymizeCustomer(prisma, c.id)).toMatchObject({ ok: false, httpStatus: 409 });
    expect(await prisma.customer.findUniqueOrThrow({ where: { id: c.id } })).toEqual(before);
  });

  it("no se puede pedir la solicitud de un cliente ya anonimizado", async () => {
    const c = await fx.customer();
    await anonymizeCustomer(prisma, c.id);
    expect(await requestAnonymization(prisma, c.id)).toMatchObject({ ok: false, httpStatus: 409, code: "ALREADY_ANONYMIZED" });
  });

  it("se puede anonimizar sin solicitud previa (P-09)", async () => {
    const c = await fx.customer();
    expect(await anonymizeCustomer(prisma, c.id)).toEqual({ ok: true });
  });
});
