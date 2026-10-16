import { rm } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

// Acceso SQL directo para preparar y verificar datos en los e2e (Playwright carga
// el proyecto como CommonJS y no puede importar el cliente generado de Prisma).
const pool = new Pool({ connectionString: process.env.DIRECT_URL, options: "-c timezone=UTC" });

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

// El pool se comparte entre archivos del mismo proceso: no se cierra a mano (termina con el worker).

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

// ───────────── Datos de prueba del panel (categorías "E2E ...", titulares 96xxxxxx) ─────────────

export async function cleanupAdminE2e() {
  // Comprobantes subidos por los tests: se borran los archivos antes que las filas.
  const receipts = await sql<{ receiptPath: string }>(
    `SELECT p."receiptPath" FROM "Payment" p JOIN "Booking" b ON b."id" = p."bookingId"
     JOIN "Customer" c ON c."id" = b."customerId"
     WHERE c."documentNumber" LIKE '96%' AND p."receiptPath" IS NOT NULL`,
  );
  const dir = process.env.RECEIPTS_DIR ?? path.join(process.cwd(), "storage", "receipts");
  for (const r of receipts) await rm(path.join(dir, r.receiptPath), { force: true });
  await sql(`DELETE FROM "Booking" WHERE "customerId" IN (SELECT "id" FROM "Customer" WHERE "documentNumber" LIKE '96%')`);
  await sql(`DELETE FROM "Customer" WHERE "documentNumber" LIKE '96%'`);
  await sql(`DELETE FROM "Unit" WHERE "categoryId" IN (SELECT "id" FROM "Category" WHERE "name" LIKE 'E2E %')`);
  await sql(`DELETE FROM "Category" WHERE "name" LIKE 'E2E %'`);
  await sql(`DELETE FROM "UnitBlock" WHERE "note" = 'e2e-admin'`);
  await sql(`DELETE FROM "Season" WHERE "name" LIKE 'E2E %'`);
  await sql(`DELETE FROM "DiscountRule" WHERE "minNights" = 2 AND "percent" IN (13, 21)`);
}

export async function seedCategory(name: string, units = 0): Promise<{ id: string; unitIds: string[] }> {
  const [category] = await sql<{ id: string }>(
    `INSERT INTO "Category" ("id", "slug", "name", "description", "maxCapacity", "basePriceArs", "basePriceUsd")
     VALUES (gen_random_uuid(), $1, $2, 'e2e', 4, 60000, 60) RETURNING "id"`,
    [`e2e-${name.toLowerCase().replace(/\W+/g, "-")}-${Date.now() % 100000}`, name],
  );
  const unitIds: string[] = [];
  for (let i = 0; i < units; i++) {
    const [unit] = await sql<{ id: string }>(
      `INSERT INTO "Unit" ("id", "name", "categoryId", "icalToken")
       VALUES (gen_random_uuid(), $1, $2::uuid, replace(gen_random_uuid()::text, '-', '')) RETURNING "id"`,
      [`${name} u${i}`, category.id],
    );
    unitIds.push(unit.id);
  }
  return { id: category.id, unitIds };
}

/** Reserva Pendiente futura de "Laura Gómez" sobre la unidad, con su ocupación. */
export async function seedPendingBooking(categoryId: string, unitId: string, checkIn: string, checkOut: string) {
  const [customer] = await sql<{ id: string }>(
    `INSERT INTO "Customer" ("id", "documentType", "documentNumber", "firstName", "lastName", "email", "phone", "birthDate", "updatedAt")
     VALUES (gen_random_uuid(), 'DNI', $1, 'Laura', 'Gómez', 'laura@mail.com', '+54 1155550000', '1990-01-01', now()) RETURNING "id"`,
    [`96${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`],
  );
  const [booking] = await sql<{ id: string }>(
    `INSERT INTO "Booking" ("id", "customerId", "categoryId", "categoryName", "unitId", "checkIn", "checkOut", "adults", "currency", "subtotal", "total", "updatedAt")
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'e2e', $3::uuid, $4::date, $5::date, 2, 'ARS', 0, 0, now()) RETURNING "id"`,
    [customer.id, categoryId, unitId, checkIn, checkOut],
  );
  await sql(
    `INSERT INTO "UnitOccupancy" ("id", "unitId", "startDate", "endDate", "bookingId")
     VALUES (gen_random_uuid(), $1::uuid, $2::date, $3::date, $4::uuid)`,
    [unitId, checkIn, checkOut, booking.id],
  );
  return booking.id;
}

export async function pendingExpiryDays(): Promise<number> {
  const [row] = await sql<{ d: number }>(`SELECT "pendingExpiryDays" AS d FROM "SystemSettings" WHERE "id" = 1`);
  return row.d;
}

export async function setPendingExpiryDays(days: number) {
  await sql(`UPDATE "SystemSettings" SET "pendingExpiryDays" = $1 WHERE "id" = 1`, [days]);
}
