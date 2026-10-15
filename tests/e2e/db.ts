import { Pool } from "pg";

// Acceso SQL directo para preparar y verificar datos en los e2e (Playwright carga
// el proyecto como CommonJS y no puede importar el cliente generado de Prisma).
const pool = new Pool({ connectionString: process.env.DIRECT_URL, options: "-c timezone=UTC" });

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export const closeDb = () => pool.end();

/** Reservas del titular con ese documento, con su cantidad de acompañantes. */
export function bookingsFor(doc: string) {
  return sql<{
    status: string;
    source: string;
    unitAssigned: boolean;
    total: string;
    guests: number;
  }>(
    `SELECT b."status", b."source", b."unitAssigned", b."total",
            (SELECT COUNT(*)::int FROM "Guest" g WHERE g."bookingId" = b."id") AS guests
     FROM "Booking" b JOIN "Customer" c ON c."id" = b."customerId"
     WHERE c."documentNumber" = $1`,
    [doc],
  );
}

/** Borra los datos que dejan los tests (titulares 97xxxxxx, bloqueos y locks de prueba). */
export async function cleanupE2e(checkIn: string) {
  await sql(`DELETE FROM "Booking" WHERE "customerId" IN (SELECT "id" FROM "Customer" WHERE "documentNumber" LIKE '97%')`);
  await sql(`DELETE FROM "Customer" WHERE "documentNumber" LIKE '97%'`);
  await sql(`DELETE FROM "UnitBlock" WHERE "note" = 'e2e'`);
  await sql(`DELETE FROM "SoftLock" WHERE "checkIn" = $1::date`, [checkIn]);
}

export async function countSoftLocks(checkIn: string): Promise<number> {
  const [row] = await sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "SoftLock" WHERE "checkIn" = $1::date`, [checkIn]);
  return row.n;
}

/** Simula que otros huéspedes ocuparon todas las unidades de la categoría. */
export async function occupyAllUnits(categorySlug: string, checkIn: string, checkOut: string) {
  await sql(`DELETE FROM "SoftLock" WHERE "checkIn" = $1::date`, [checkIn]);
  const units = await sql<{ id: string }>(
    `SELECT u."id" FROM "Unit" u JOIN "Category" c ON c."id" = u."categoryId" WHERE c."slug" = $1`,
    [categorySlug],
  );
  for (const unit of units) {
    const [block] = await sql<{ id: string }>(
      `INSERT INTO "UnitBlock" ("id", "unitId", "startDate", "endDate", "kind", "note")
       VALUES (gen_random_uuid(), $1::uuid, $2::date, $3::date, 'OWNER', 'e2e') RETURNING "id"`,
      [unit.id, checkIn, checkOut],
    );
    await sql(
      `INSERT INTO "UnitOccupancy" ("id", "unitId", "startDate", "endDate", "blockId")
       VALUES (gen_random_uuid(), $1::uuid, $2::date, $3::date, $4::uuid)`,
      [unit.id, checkIn, checkOut, block.id],
    );
  }
}

/** Los tests de login no deben dejar bloqueos que afecten a los siguientes. */
export async function clearLoginThrottles() {
  await sql(`DELETE FROM "LoginThrottle"`);
}
