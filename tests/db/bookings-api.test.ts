import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/bookings/route";
import { prisma } from "@/lib/prisma";
import { createFixture } from "./helpers";

const fx = createFixture();
let slug: string;
let categoryId: string;

beforeAll(async () => {
  const cat = await fx.category("api", 5, 1);
  categoryId = cat.id;
  slug = `${fx.tag}-api`;
});
afterAll(async () => {
  await fx.cleanup();
  await prisma.$disconnect();
});

// Fechas relativas a la fecha real: el endpoint usa el "hoy" del servidor.
const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const call = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const body = (checkIn: string, checkOut: string) => ({
  categorySlug: slug,
  checkIn,
  checkOut,
  adults: 2,
  children: 0,
  currency: "ARS",
  holder: fx.holder(),
  companions: [],
});

describe("POST /api/bookings", () => {
  it("20 solicitudes concurrentes sobre la última unidad: 1 respuesta 201 y 19 con 409 (RNF-03, AC-41)", async () => {
    const [checkIn, checkOut] = [ahead(40), ahead(42)];
    const responses = await Promise.all(Array.from({ length: 20 }, () => call(body(checkIn, checkOut))));
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(19);

    const conflict = await responses.find((r) => r.status === 409)!.json();
    expect(conflict.error.message).toBe("Las fechas seleccionadas ya no están disponibles");
    expect(await prisma.booking.count({ where: { categoryId } })).toBe(1);
  });

  it("la respuesta solo trae una referencia, sin datos del huésped (AC-107)", async () => {
    const res = await call(body(ahead(50), ahead(52)));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(Object.keys(json)).toEqual(["reference"]);
  });

  it("rechaza cuerpos inválidos con 400", async () => {
    expect((await call({ nada: true })).status).toBe(400);
    const res = await call({ ...body(ahead(60), ahead(62)), holder: { ...fx.holder(), email: "juan@" } });
    expect(res.status).toBe(400);
    expect((await res.json()).errors.email).toBeDefined();
  });
});
