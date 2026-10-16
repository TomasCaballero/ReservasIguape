import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/ical/[token]/route";
import { prisma } from "@/lib/prisma";
import { createFixture } from "./helpers";

const fx = createFixture();
let token: string;
let otherToken: string;

const call = (t: string) =>
  GET(new NextRequest(`http://localhost/api/ical/${t}`), { params: Promise.resolve({ token: t }) } as never);

beforeAll(async () => {
  const cat = await fx.category("feed", 2, 2);
  const [u1, u2] = cat.unitIds;
  token = (await prisma.unit.findUniqueOrThrow({ where: { id: u1 } })).icalToken;
  otherToken = (await prisma.unit.findUniqueOrThrow({ where: { id: u2 } })).icalToken;
  await fx.booking(cat, u1, "2027-03-10", "2027-03-14", "CONFIRMED");
  await fx.booking(cat, u1, "2027-03-20", "2027-03-22", "PENDING");
  await fx.softLock(cat, u1, "2027-04-01", "2027-04-03", new Date(Date.now() + 600_000));
  await fx.block(u1, "2027-05-01", "2027-05-03");
  const source = await fx.icalSource(u1);
  const imported = await prisma.unitBlock.create({
    data: { unitId: u1, startDate: new Date("2027-06-01"), endDate: new Date("2027-06-03"), kind: "ICAL", icalSourceId: source.id, externalUid: "x" },
  });
  await prisma.unitOccupancy.create({
    data: { unitId: u1, startDate: new Date("2027-06-01"), endDate: new Date("2027-06-03"), blockId: imported.id },
  });
});
afterAll(async () => {
  await fx.cleanup();
  await prisma.$disconnect();
});

describe("GET /api/ical/<token>.ics", () => {
  it("entrega reservas y bloqueos manuales, sin soft locks ni eco de OTAs (AC-98)", async () => {
    const res = await call(`${token}.ics`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.text();
    expect(body).toContain("DTSTART;VALUE=DATE:20270310");
    expect(body).toContain("DTEND;VALUE=DATE:20270314");
    expect(body).toContain("DTSTART;VALUE=DATE:20270320");
    expect(body).toContain("DTSTART;VALUE=DATE:20270501");
    expect(body).not.toContain("20270401");
    expect(body).not.toContain("20270601");
    expect(body).not.toMatch(/Fixture|fixture@|\+54/);
  });

  it("el feed de otra unidad no trae esas reservas", async () => {
    const body = await (await call(`${otherToken}.ics`)).text();
    expect(body).not.toContain("BEGIN:VEVENT");
  });

  it("token inexistente, mal formado o sin .ics → 404 sin cuerpo (AC-108)", async () => {
    for (const t of [`${"0".repeat(32)}.ics`, "abc.ics", token, `${token.toUpperCase()}.ics`, `${token}x.ics`, ".ics"]) {
      const res = await call(t);
      expect(res.status, t).toBe(404);
      expect(await res.text()).toBe("");
    }
  });

  it("el token tiene 32 hex (128 bits) (RNF-06)", () => {
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });
});
