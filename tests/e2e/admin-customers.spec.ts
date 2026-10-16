import type { Page } from "@playwright/test";
import { addDays, formatDMY, todayInBuenosAires } from "../../lib/booking/dates";
import { cleanupCrmE2e, clearLoginThrottles, seedCategory, seedCrmCustomer, sql } from "./db";
import { expect, test } from "./fixtures";

const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

const TODAY = todayInBuenosAires();
const IN = addDays(TODAY, 60);
const OUT = addDays(IN, 3);
// Cumpleaños dentro de 10 días (año de nacimiento 1985, para que el día caiga seguro en la ventana).
const BIRTHDAY = addDays(TODAY, 10);
const BIRTH_DATE = `1985${BIRTHDAY.slice(4)}`;

const created: string[] = [];

test.beforeEach(async () => {
  await clearLoginThrottles();
  await cleanupCrmE2e(created);
});
test.afterEach(async () => {
  await cleanupCrmE2e(created);
  await clearLoginThrottles();
});

async function login(page: Page) {
  await page.goto("/adminpanel");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
}

async function seed() {
  const category = await seedCategory("E2E CRM", 1);
  const customer = await seedCrmCustomer(BIRTH_DATE, category.id, category.unitIds[0], IN, OUT);
  created.push(customer.id);
  return customer;
}

test("el widget de Inicio lista al cumpleañero con email y teléfono (AC-91)", async ({ page }) => {
  await seed();
  await login(page);
  const item = page.getByTestId("birthday-item").filter({ hasText: "Carmen Cumple" });
  await expect(item).toBeVisible();
  await expect(item).toContainText("carmen@mail.com");
  await expect(item).toContainText("+54 1155559999");
  await expect(item).toContainText(formatDMY(BIRTHDAY));
});

test("desde la reserva se llega a la ficha, se solicita y se anonimiza (AC-95, AC-96)", async ({ page }) => {
  const { id, bookingId } = await seed();
  await login(page);

  await page.goto(`/adminpanel/reservas/${bookingId}`);
  await page.getByRole("link", { name: "Carmen Cumple" }).click();
  await expect(page).toHaveURL(new RegExp(`/adminpanel/clientes/${id}$`));
  await expect(page.getByTestId("customer-booking")).toHaveCount(1);

  await page.getByRole("button", { name: "Solicitar anonimización" }).click();
  await page.getByRole("button", { name: "Confirmar solicitud" }).click();
  await expect(page.getByTestId("request-status")).toContainText("Pendiente");
  const [row] = await sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "AnonymizationRequest" WHERE "customerId" = $1::uuid AND "completedAt" IS NULL`, [id]);
  expect(row.n).toBe(1);

  await page.getByRole("button", { name: "Anonimizar" }).click();
  await expect(page.getByText(/reserva Pendiente o Confirmada/)).toBeVisible(); // P-09
  await page.getByRole("button", { name: "Confirmar anonimización" }).click();
  await expect(page.getByTestId("customer-anonymized")).toBeVisible();
  await expect(page.getByTestId("request-status")).toContainText("Anonimizada el");

  const [customer] = await sql<{ firstName: string; email: string }>(`SELECT "firstName", "email" FROM "Customer" WHERE "id" = $1::uuid`, [id]);
  expect(customer).toEqual({ firstName: "Anonimizado", email: "anonimizado@anonimizado.invalid" });
  await page.goto(`/adminpanel/reservas/${bookingId}`);
  await expect(page.getByText("Cliente anonimizado")).toBeVisible();
  // Ya no aparece en el widget de cumpleaños.
  await page.goto("/adminpanel");
  await expect(page.getByTestId("birthday-item").filter({ hasText: "Carmen" })).toHaveCount(0);
});

test("el listado muestra los datos del cliente y no hay scroll horizontal (AC-88, RNF-01)", async ({ page }) => {
  await seed();
  await login(page);
  for (const width of [360, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/adminpanel/clientes?q=Cumple");
    const item = page.getByTestId("customer-item");
    await expect(item).toHaveCount(1);
    await expect(item).toContainText("carmen@mail.com");
    await expect(item).toContainText(formatDMY(BIRTH_DATE));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test("sin sesión /adminpanel/clientes redirige al login (AC-106)", async ({ page }) => {
  const { id } = await seed();
  for (const path of ["clientes", `clientes/${id}`]) {
    await page.goto(`/adminpanel/${path}`);
    await expect(page).toHaveURL(/\/adminpanel$/);
    await expect(page.locator("#email")).toBeVisible();
  }
});
