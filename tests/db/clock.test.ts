import { afterAll, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

afterAll(() => prisma.$disconnect());

// Regresión: con el servidor Postgres en otra zona horaria (ej. Buenos Aires), el
// adaptador de pg corría los instantes. La conexión se fuerza a UTC (RNF-07).
it("la hora de la base de datos coincide con la del servidor de la app", async () => {
  const [row] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
  expect(Math.abs(row.now.getTime() - Date.now())).toBeLessThan(5_000);
});

it("un instante guardado con Prisma se compara bien con now() de la base", async () => {
  const [row] = await prisma.$queryRaw<{ expired: boolean }[]>`
    SELECT ${new Date(Date.now() - 60_000)}::timestamptz <= now() AS expired`;
  expect(row.expired).toBe(true);
});
