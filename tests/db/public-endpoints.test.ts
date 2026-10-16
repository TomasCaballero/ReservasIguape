import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as availability } from "@/app/api/availability/route";
import { POST as createBooking } from "@/app/api/bookings/route";
import { GET as feed } from "@/app/api/ical/[token]/route";
import { DELETE as releaseLock, POST as takeLock } from "@/app/api/soft-lock/route";
import { prisma } from "@/lib/prisma";
import { createFixture } from "./helpers";

// AC-107 · RNF-06: ningún endpoint público devuelve datos personales de otros huéspedes,
// con o sin identificadores. Hay una reserva ajena (titular "Test Fixture") en las mismas fechas.

const fx = createFixture();
const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const [checkIn, checkOut] = [ahead(70), ahead(72)];

let slug: string;
let token: string;
let personal: string[];

beforeAll(async () => {
  const cat = await fx.category("pub", 5, 2);
  slug = `${fx.tag}-pub`;
  const booking = await fx.booking(cat, cat.unitIds[0], checkIn, checkOut);
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: booking.customerId } });
  const unit = await prisma.unit.findUniqueOrThrow({ where: { id: cat.unitIds[0] } });
  token = unit.icalToken;
  personal = [customer.firstName, customer.lastName, customer.documentNumber, customer.email, customer.phone, "1100000000", "1990-01-01", "01/01/1990"];
});
afterAll(async () => {
  // Las reservas creadas por la API no pasan por el fixture: se borran con sus titulares.
  const docs = ["99887766", "99887755"];
  await prisma.booking.deleteMany({ where: { customer: { documentNumber: { in: docs } } } });
  await prisma.customer.deleteMany({ where: { documentNumber: { in: docs } } });
  await fx.cleanup();
  await prisma.$disconnect();
});

const get = (path: string) => new NextRequest(`http://localhost${path}`);
const post = (path: string, body: unknown) =>
  new NextRequest(`http://localhost${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function expectNoPersonalData(res: Response) {
  const text = await res.text();
  for (const value of personal) expect(text, `la respuesta trae "${value}"`).not.toContain(value);
}

describe("endpoints públicos sin datos de huéspedes (AC-107)", () => {
  it("GET /api/availability, con y sin parámetros", async () => {
    const query = `checkin=${checkIn}&checkout=${checkOut}&adults=2&children=0&currency=ARS`;
    const ok = await availability(get(`/api/availability?${query}`));
    expect(ok.status).toBe(200);
    await expectNoPersonalData(ok);
    for (const path of ["/api/availability", "/api/availability?checkin=x", `/api/availability?${query}&documento=${personal[2]}`]) {
      await expectNoPersonalData(await availability(get(path)));
    }
  });

  it("POST /api/bookings: éxito, conflicto, inválido y vacío", async () => {
    const valid = {
      categorySlug: slug,
      checkIn: ahead(80),
      checkOut: ahead(82),
      adults: 2,
      children: 0,
      currency: "ARS",
      holder: fx.holder({ documentNumber: "99887766" }),
      companions: [],
    };
    const created = await createBooking(post("/api/bookings", valid));
    expect(created.status).toBe(201);
    await expectNoPersonalData(created);
    // La categoría tiene 2 unidades: la 2ª solicitud toma la que queda y la 3ª recibe 409.
    const sameDay = { ...valid, holder: fx.holder({ documentNumber: "99887755" }) };
    await createBooking(post("/api/bookings", sameDay));
    const conflict = await createBooking(post("/api/bookings", sameDay));
    expect(conflict.status).toBe(409);
    await expectNoPersonalData(conflict);
    for (const body of [{}, { ...valid, holder: { ...valid.holder, email: "mal" } }]) {
      const res = await createBooking(post("/api/bookings", body));
      expect(res.status).toBe(400);
      await expectNoPersonalData(res);
    }
  });

  it("POST/DELETE /api/soft-lock: devuelve solo token y vencimiento", async () => {
    const res = await takeLock(post("/api/soft-lock", { categorySlug: slug, checkIn: ahead(90), checkOut: ahead(92), adults: 2, children: 0 }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(Object.keys(json).sort()).toEqual(["expiresAt", "token"]);
    await expectNoPersonalData(new Response(JSON.stringify(json)));
    await expectNoPersonalData(await takeLock(post("/api/soft-lock", {})));
    expect((await releaseLock(post("/api/soft-lock", { token: json.token }))).status).toBe(204);
  });

  it("GET /api/ical/<token>.ics: con token válido trae solo fechas; sin token válido, 404", async () => {
    const ctx = (t: string) => ({ params: Promise.resolve({ token: t }) });
    const ok = await feed(get(`/api/ical/${token}.ics`), ctx(`${token}.ics`) as never);
    expect(ok.status).toBe(200);
    const body = await ok.text();
    expect(body).toContain("DTSTART;VALUE=DATE:");
    for (const value of personal) expect(body).not.toContain(value);
    for (const t of [token, "abc.ics", "", `${"0".repeat(32)}.ics`]) {
      const res = await feed(get(`/api/ical/${t}`), ctx(t) as never);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("");
    }
  });
});
