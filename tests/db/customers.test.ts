import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getCustomer, listAnonymizationRequests, listCustomers } from "@/lib/admin/customers";
import { createBooking } from "@/lib/booking/create-booking";
import { prisma } from "@/lib/prisma";
import { createFixture } from "./helpers";

const fx = createFixture();
const NOW = new Date("2027-01-02T12:00:00Z");
let category: { id: string; unitIds: string[]; slug: string };

beforeAll(async () => {
  category = { ...(await fx.category("crm", 4, 2)), slug: `${fx.tag}-crm` };
});

afterAll(async () => {
  await fx.cleanup();
  await prisma.$disconnect();
});

describe("listado de clientes (RF-57)", () => {
  it("un cliente nuevo aparece con todos sus datos (AC-88)", async () => {
    const c = await fx.customer({ firstName: "Marta", lastName: `Listado${fx.tag}`, birthDate: "1975-03-09" });
    const rows = await listCustomers(prisma, `Listado${fx.tag}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: c.id,
      firstName: "Marta",
      lastName: `Listado${fx.tag}`,
      email: "fixture@example.com",
      phone: "+54 1100000000",
      documentType: "DNI",
      documentNumber: c.documentNumber,
      birthDate: "1975-03-09",
      anonymized: false,
    });
  });

  it("busca por documento", async () => {
    const c = await fx.customer();
    const rows = await listCustomers(prisma, c.documentNumber);
    expect(rows.map((r) => r.id)).toEqual([c.id]);
  });

  it("el mismo documento con otro email deja 1 solo cliente en el listado (AC-89)", async () => {
    const holder = fx.holder({ lastName: `Mismo${fx.tag}` });
    const stay = { categorySlug: category.slug, adults: 2, children: 0, currency: "ARS" as const, companions: [] };
    const first = await createBooking(prisma, { ...stay, checkIn: "2027-05-10", checkOut: "2027-05-12", holder }, NOW);
    const second = await createBooking(
      prisma,
      { ...stay, checkIn: "2027-06-10", checkOut: "2027-06-12", holder: { ...holder, email: "otro@mail.com" } },
      NOW,
    );
    expect(first.ok && second.ok).toBe(true);
    const rows = await listCustomers(prisma, holder.documentNumber);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("otro@mail.com");
  });
});

describe("ficha e historial (RF-59)", () => {
  it("lista las dos estadías Finalizadas con sus fechas, recientes primero (AC-90)", async () => {
    const c = await fx.customer();
    for (const [i, [checkIn, checkOut]] of [["2027-01-10", "2027-01-12"], ["2027-03-01", "2027-03-04"]].entries()) {
      await prisma.booking.create({
        data: {
          customerId: c.id,
          categoryId: category.id,
          categoryName: "crm",
          unitId: category.unitIds[i],
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          adults: 2,
          status: "FINISHED",
          currency: "ARS",
          subtotal: 0,
          total: 0,
        },
      });
    }
    const detail = await getCustomer(prisma, c.id, "2027-06-01");
    expect(detail?.bookings.map((b) => [b.checkIn, b.checkOut, b.status])).toEqual([
      ["2027-03-01", "2027-03-04", "FINISHED"],
      ["2027-01-10", "2027-01-12", "FINISHED"],
    ]);
    expect(detail?.activeBookings).toBe(0);
  });

  it("devuelve null si el cliente no existe", async () => {
    expect(await getCustomer(prisma, "00000000-0000-0000-0000-000000000000", "2027-06-01")).toBeNull();
  });
});

describe("plazo vencido (RNF-08, AC-97)", () => {
  it("la solicitud de 30 d 0 h figura vencida y la de 29 d 23 h no", async () => {
    const { anonymizationDays } = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
    const old = await fx.customer();
    const recent = await fx.customer();
    // Ambas con el reloj de la base: 30 d 0 h exactos y 29 d 23 h.
    await prisma.$executeRaw`
      INSERT INTO "AnonymizationRequest" ("id", "customerId", "requestedAt")
      VALUES (gen_random_uuid(), ${old.id}::uuid, now() - make_interval(days => ${anonymizationDays}::int)),
             (gen_random_uuid(), ${recent.id}::uuid, now() - make_interval(days => ${anonymizationDays}::int) + interval '1 hour')`;

    const rows = await listAnonymizationRequests(prisma);
    expect(rows.find((r) => r.customerId === old.id)?.overdue).toBe(true);
    expect(rows.find((r) => r.customerId === recent.id)?.overdue).toBe(false);
  });
});
