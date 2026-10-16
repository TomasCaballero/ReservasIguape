import type { Page } from "@playwright/test";
import { addDays, formatDMY, todayInBuenosAires } from "../../lib/booking/dates";
import { cleanupAdminE2e, clearLoginThrottles, seedCategory, seedPendingBooking, sql } from "./db";
import { expect, test } from "./fixtures";

const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

const IN = addDays(todayInBuenosAires(), 60);
const OUT = addDays(IN, 3);

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2048)]);

test.beforeEach(async () => {
  await clearLoginThrottles();
  await cleanupAdminE2e();
});
test.afterEach(async () => {
  await cleanupAdminE2e();
  await clearLoginThrottles();
});

async function login(page: Page) {
  await page.goto("/adminpanel");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
}

/** Categoría "E2E Reservas" con dos unidades y una reserva Pendiente de Laura Gómez en la primera. */
async function seed() {
  const category = await seedCategory("E2E Reservas", 2);
  const bookingId = await seedPendingBooking(category.id, category.unitIds[0], IN, OUT);
  return { category, bookingId };
}

test("reservas y calendario exigen sesión (AC-106)", async ({ page, request }) => {
  const { bookingId } = await seed();
  for (const path of ["reservas", `reservas/${bookingId}`, "calendario"]) {
    await page.goto(`/adminpanel/${path}`);
    await expect(page).toHaveURL(/\/adminpanel$/);
    await expect(page.locator("#email")).toBeVisible();
  }
  expect((await request.get(`/api/admin/payments/${bookingId}/receipt`)).status()).toBe(401);
  expect((await request.post(`/api/admin/bookings/${bookingId}/payments`, { multipart: { amount: "1" } })).status()).toBe(401);
});

test("lista de reservas con filtro por estado (RF-47)", async ({ page }) => {
  await seed();
  await login(page);
  await page.goto("/adminpanel/reservas");
  await expect(page.getByTestId("booking-item").filter({ hasText: "Laura Gómez" })).toBeVisible();

  await page.getByRole("link", { name: "Confirmada" }).click();
  await expect(page).toHaveURL(/estado=CONFIRMED/);
  await expect(page.getByTestId("booking-item").filter({ hasText: "Laura Gómez" })).toHaveCount(0);

  await page.getByRole("link", { name: "Pendiente" }).click();
  await expect(page.getByTestId("booking-item").filter({ hasText: "Laura Gómez" })).toBeVisible();
});

test("detalle: titular, origen y cambios de estado (RF-48, RF-49)", async ({ page }) => {
  const { bookingId } = await seed();
  await login(page);
  await page.goto(`/adminpanel/reservas/${bookingId}`);

  await expect(page.getByText("Laura Gómez · DNI")).toBeVisible();
  await expect(page.getByText("Web Directa")).toBeVisible();
  await expect(page.getByTestId("booking-status")).toHaveText("Pendiente");
  await expect(page.getByRole("button", { name: "Volver a Pendiente" })).toHaveCount(0); // Pendiente → Pendiente no existe

  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByTestId("booking-status")).toHaveText("Confirmada");

  await page.getByRole("button", { name: "Cancelar reserva" }).click();
  await expect(page.getByTestId("booking-status")).toHaveText("Cancelada");
  const [freed] = await sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "UnitOccupancy" WHERE "bookingId" = $1::uuid`, [bookingId]);
  expect(freed.n).toBe(0);

  await page.getByRole("button", { name: "Reactivar como Confirmada" }).click();
  await expect(page.getByTestId("booking-status")).toHaveText("Confirmada");
  const [back] = await sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "UnitOccupancy" WHERE "bookingId" = $1::uuid`, [bookingId]);
  expect(back.n).toBe(1);
});

test("reactivar sin disponibilidad se rechaza con 409 y no cambia el estado (AC-72)", async ({ page }) => {
  const { category, bookingId } = await seed();
  await login(page);
  await page.goto(`/adminpanel/reservas/${bookingId}`);
  await page.getByRole("button", { name: "Cancelar reserva" }).click();
  await expect(page.getByTestId("booking-status")).toHaveText("Cancelada");

  // Mientras tanto otras reservas toman las dos unidades en esas fechas.
  for (const unitId of category.unitIds) {
    await seedPendingBooking(category.id, unitId, IN, OUT);
  }

  await page.getByRole("button", { name: "Reactivar como Pendiente" }).click();
  await expect(page.getByTestId("action-error")).toHaveText("No hay disponibilidad en esas fechas");
  await expect(page.getByTestId("booking-status")).toHaveText("Cancelada");
});

test("asignar unidad y registrar el envío del método de pago (RF-50, RF-52)", async ({ page }) => {
  const { category, bookingId } = await seed();
  await login(page);
  await page.goto(`/adminpanel/reservas/${bookingId}`);

  await expect(page.getByText("(sin asignar)")).toBeVisible();
  await page.locator("#assign-unit").selectOption(category.unitIds[1]);
  await page.getByRole("button", { name: "Asignar unidad" }).click();
  await expect(page.locator("p", { hasText: "E2E Reservas u1" })).toBeVisible();
  await expect(page.getByText("(sin asignar)")).toHaveCount(0);

  await page.getByRole("button", { name: "Registrar envío del método de pago" }).click();
  await expect(page.getByTestId("payment-info-sent")).toHaveText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  await expect(page.getByRole("button", { name: "Registrar envío del método de pago" })).toHaveCount(0);
});

test("cobros: referencia, comprobante y errores (RF-55)", async ({ page }) => {
  const { bookingId } = await seed();
  await login(page);
  await page.goto(`/adminpanel/reservas/${bookingId}`);

  // Sin referencia ni archivo (AC-84).
  await page.locator("#payment-amount").fill("50000");
  await page.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(page.getByText("Cargá una referencia o un archivo")).toBeVisible();

  // Con referencia (AC-82).
  await page.locator("#payment-reference").fill("TRF-123456");
  await page.getByRole("button", { name: "Registrar cobro" }).click();
  const first = page.getByTestId("payment-item").filter({ hasText: "TRF-123456" });
  await expect(first).toContainText("$50.000");
  await expect(first).toContainText("Transferencia");

  // Archivo no permitido (AC-85).
  await page.locator("#payment-amount").fill("1000");
  await page.locator("#payment-file").setInputFiles({ name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
  await page.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(page.getByText("Solo se admiten archivos PDF, JPG o PNG")).toBeVisible();

  // PNG válido sin referencia (AC-83), en USD (AC-86).
  await page.locator("#payment-currency").selectOption("USD");
  await page.locator("#payment-file").setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Registrar cobro" }).click();
  const withFile = page.getByTestId("payment-item").filter({ hasText: "USD 1.000" });
  await expect(withFile).toContainText("Ver comprobante");

  const href = await withFile.getByRole("link", { name: "Ver comprobante" }).getAttribute("href");
  const response = await page.request.get(href as string);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect((await response.body()).equals(PNG)).toBe(true);
});

test("calendario: bloquear una unidad, ver la ocupación y quitar el bloqueo (RF-47, RF-51)", async ({ page }) => {
  const { category } = await seed();
  await login(page);
  await page.goto(`/adminpanel/calendario?mes=${IN.slice(0, 7)}`);

  const [{ id }] = await sql<{ id: string }>(`SELECT "id" FROM "Booking" WHERE "categoryId" = $1::uuid`, [category.id]);
  const reference = id.slice(0, 8).toUpperCase();
  await expect(
    page.locator(`[aria-label="E2E Reservas u0, ${formatDMY(IN)}: Laura Gómez (sin asignar) · #${reference}"]`),
  ).toBeVisible();
  // La noche del check-out queda libre (AC-66).
  await expect(page.locator(`[aria-label="E2E Reservas u0, ${formatDMY(OUT)}: libre"]`)).toBeVisible();

  // Bloqueo en la otra unidad.
  await page.locator("#block-unitId").selectOption(category.unitIds[1]);
  await page.locator("#block-startDate").fill(formatDMY(IN).replaceAll("/", ""));
  await page.locator("#block-endDate").fill(formatDMY(OUT).replaceAll("/", ""));
  await page.locator("#block-note").fill("e2e-admin");
  await page.getByRole("button", { name: "Bloquear" }).click();
  const block = page.getByTestId("block-item").filter({ hasText: "E2E Reservas u1" });
  await expect(block).toContainText("Mantenimiento");
  await expect(block).toContainText("e2e-admin");

  // Superpuesto con la reserva de la otra unidad: 409 con mensaje (AC-76).
  await page.locator("#block-unitId").selectOption(category.unitIds[0]);
  await page.locator("#block-startDate").fill(formatDMY(IN).replaceAll("/", ""));
  await page.locator("#block-endDate").fill(formatDMY(OUT).replaceAll("/", ""));
  await page.getByRole("button", { name: "Bloquear" }).click();
  await expect(page.getByTestId("block-error")).toHaveText("La unidad ya tiene una reserva o un bloqueo en esas fechas");

  // Quitar el bloqueo libera la unidad.
  await block.getByRole("button", { name: "Quitar bloqueo de E2E Reservas u1" }).click();
  await block.getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(page.getByTestId("block-item").filter({ hasText: "E2E Reservas u1" })).toHaveCount(0);
});

test("el inicio avisa de reservas Pendiente sin contactar pasado el plazo (RF-53)", async ({ page }) => {
  const { bookingId } = await seed();
  await sql(`UPDATE "Booking" SET "createdAt" = now() - interval '25 hours' WHERE "id" = $1::uuid`, [bookingId]);
  await login(page);
  const notice = page.getByTestId("uncontacted-notice");
  await expect(notice).toContainText("Laura Gómez");

  await notice.getByRole("link").first().click();
  await page.getByRole("button", { name: "Registrar envío del método de pago" }).click();
  await expect(page.getByTestId("payment-info-sent")).toBeVisible();
  await page.goto("/adminpanel");
  await expect(page.getByTestId("uncontacted-notice")).toHaveCount(0);
});
