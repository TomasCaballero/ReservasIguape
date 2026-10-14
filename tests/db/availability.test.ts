import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findAvailableCategories } from "@/lib/booking/availability";
import { searchStays } from "@/lib/booking/search";
import { prisma } from "@/lib/prisma";
import { createFixture } from "./helpers";

type Cat = Awaited<ReturnType<ReturnType<typeof createFixture>["category"]>>;

const fx = createFixture();
let deluxe: Cat;
let classic: Cat;
let loft: Cat;

const found = async (checkIn: string, checkOut: string, guests = 2, at?: Date) =>
  (await findAvailableCategories(prisma, { checkIn, checkOut, guests, at })).map(
    (r) => r.categoryId,
  );

beforeAll(async () => {
  deluxe = await fx.category("De Luxe", 5, 1);
  classic = await fx.category("Classic", 2, 1);
  loft = await fx.category("Loft", 2, 1);
});

afterAll(async () => {
  await fx.cleanup();
  await prisma.$disconnect();
});

describe("disponibilidad (RF-09)", () => {
  it("sin ocupación aparecen todas las categorías", async () => {
    expect(await found("2026-11-11", "2026-11-13")).toEqual(
      expect.arrayContaining([deluxe.id, classic.id, loft.id]),
    );
  });

  it("una categoría con todas sus unidades Confirmadas no aparece (AC-14)", async () => {
    await fx.booking(deluxe, deluxe.unitIds[0], "2026-11-10", "2026-11-14", "CONFIRMED");
    const ids = await found("2026-11-11", "2026-11-13");
    expect(ids).toContain(classic.id);
    expect(ids).not.toContain(deluxe.id);
  });

  it("una reserva Pendiente también ocupa la última unidad (AC-15)", async () => {
    await fx.booking(classic, classic.unitIds[0], "2026-12-10", "2026-12-12", "PENDING");
    expect(await found("2026-12-10", "2026-12-12")).not.toContain(classic.id);
  });

  it("la noche del check-out queda libre (AC-16)", async () => {
    expect(await found("2026-11-14", "2026-11-16")).toContain(deluxe.id);
  });

  it("un bloqueo manual reduce la disponibilidad en 1 (AC-75)", async () => {
    await fx.block(loft.unitIds[0], "2026-12-01", "2026-12-05");
    expect(await found("2026-12-02", "2026-12-04")).not.toContain(loft.id);
  });
});

describe("capacidad (RF-04)", () => {
  it("excluye categorías con capacidad menor a los huéspedes (AC-05)", async () => {
    const ids = await found("2027-03-01", "2027-03-03", 3);
    expect(ids).toContain(deluxe.id);
    expect(ids).not.toContain(loft.id);
  });
});

describe("soft lock (RF-25, RF-26, RNF-07)", () => {
  it("oculta la categoría mientras el lock está vigente (AC-37)", async () => {
    const cat = await fx.category("Locked", 2, 1);
    await fx.softLock(cat, cat.unitIds[0], "2027-04-10", "2027-04-12", new Date("2027-04-01T12:15:00Z"));
    const ids = await found("2027-04-10", "2027-04-12", 2, new Date("2027-04-01T12:05:00Z"));
    expect(ids).not.toContain(cat.id);
  });

  it("vence con tolerancia 0: oculta a T+14:59 y muestra a T+15:00 (AC-38)", async () => {
    const cat = await fx.category("Boundary", 2, 1);
    const t = new Date("2027-05-01T12:00:00Z");
    const expiresAt = new Date(t.getTime() + 15 * 60_000);
    await fx.softLock(cat, cat.unitIds[0], "2027-05-10", "2027-05-12", expiresAt);

    const before = new Date(t.getTime() + (14 * 60 + 59) * 1000);
    expect(await found("2027-05-10", "2027-05-12", 2, before)).not.toContain(cat.id);
    expect(await found("2027-05-10", "2027-05-12", 2, expiresAt)).toContain(cat.id);
  });

  it("el soft lock nuevo vence a 15 min con la hora de la base de datos", async () => {
    const cat = await fx.category("DbClock", 2, 1);
    const [row] = await prisma.$queryRaw<{ secs: number }[]>`
      INSERT INTO "SoftLock" ("id", "categoryId", "unitId", "checkIn", "checkOut", "token")
      VALUES (gen_random_uuid(), ${cat.id}::uuid, ${cat.unitIds[0]}::uuid,
              '2027-07-10', '2027-07-12', ${`tok-${fx.tag}`})
      RETURNING EXTRACT(EPOCH FROM ("expiresAt" - "createdAt"))::int AS secs`;
    expect(row.secs).toBe(900);
  });
});

describe("searchStays (RF-08, RF-16)", () => {
  const now = new Date("2027-05-01T12:00:00Z");

  it("rechaza sin adultos y devuelve el mensaje (AC-04)", async () => {
    const r = await searchStays(
      prisma,
      { checkIn: "2027-06-10", checkOut: "2027-06-12", adults: 0, children: 1, currency: "ARS" },
      now,
    );
    expect(r).toEqual({ error: { code: "NO_ADULTS", message: "Se requiere al menos 1 adulto" } });
  });

  it("cotiza las categorías disponibles al precio base (AC-18)", async () => {
    const r = await searchStays(
      prisma,
      { checkIn: "2027-06-10", checkOut: "2027-06-13", adults: 2, children: 0, currency: "ARS" },
      now,
    );
    if (!("results" in r)) throw new Error("se esperaban resultados");
    const mine = r.results.find((x) => x.category.id === deluxe.id);
    expect(mine?.quote.nightCount).toBe(3);
    expect(mine?.quote.total).toBe(120000);
  });
});
