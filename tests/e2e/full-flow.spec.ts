import type { Page } from "@playwright/test";
import { addDays, todayInBuenosAires } from "../../lib/booking/dates";
import { bookingsFor, cleanupCrmE2e, cleanupE2e, clearLoginThrottles, sql } from "./db";
import { expect, test } from "./fixtures";

// Recorrido único: huésped (portal) → administrador (reserva) → CRM → feed iCal de la unidad.
// El titular usa un documento 95xxxxxx, que limpia `cleanupCrmE2e`.

const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

const IN = addDays(todayInBuenosAires(), 40);
const OUT = addDays(IN, 3);
const DOC = `95${String(Date.now() % 1_000_000).padStart(6, "0")}`;

const cleanup = async () => {
  await cleanupE2e(IN);
  await cleanupCrmE2e([]);
  await clearLoginThrottles();
};
test.beforeEach(cleanup);
test.afterEach(cleanup);

async function login(page: Page) {
  await page.goto("/adminpanel");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
}

test("portal → panel → CRM → feed iCal (AC-33, 42, 43, 66, 73, 76, 82, 88, 98)", async ({ page, request }) => {
  // 1. El huésped busca, elige, completa sus datos y confirma.
  await page.goto(`/?checkin=${IN}&checkout=${OUT}`);
  await page
    .getByTestId("category-card")
    .filter({ has: page.getByRole("heading", { name: "De Luxe" }) })
    .getByRole("button", { name: "Elegir" })
    .click();
  await page.getByRole("button", { name: "Continuar" }).click();
  const fields = { firstName: "Flor", lastName: "Flujo", email: "flor@mail.com", phoneNumber: "1155557777", documentNumber: DOC, birthDate: "03/04/1988" };
  for (const [field, value] of Object.entries(fields)) await page.locator(`#holder-${field}`).fill(value);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("¡Recibimos tu solicitud!")).toBeVisible();

  const [created] = await bookingsFor(DOC);
  expect(created).toMatchObject({ status: "PENDING", source: "WEB_DIRECT", unitAssigned: false });

  // 2. El administrador la ve Pendiente, sin unidad y Web Directa; asigna, envía el método de pago, cobra y confirma.
  await login(page);
  await page.goto("/adminpanel/reservas");
  await page.getByTestId("booking-item").filter({ hasText: "Flor Flujo" }).getByRole("link").first().click();
  await expect(page.getByTestId("booking-status")).toHaveText("Pendiente");
  await expect(page.getByText("Web Directa")).toBeVisible();
  await expect(page.getByText("(sin asignar)")).toBeVisible();

  const unitValue = await page.locator("#assign-unit option:not([value=''])").first().getAttribute("value");
  await page.locator("#assign-unit").selectOption(unitValue as string);
  await page.getByRole("button", { name: "Asignar unidad" }).click();
  await expect(page.getByText("(sin asignar)")).toHaveCount(0);

  await page.getByRole("button", { name: "Registrar envío del método de pago" }).click();
  await expect(page.getByTestId("payment-info-sent")).toBeVisible();
  await page.waitForLoadState("networkidle"); // el refresco del servidor pisaría lo que se escriba antes

  await page.locator("#payment-amount").fill("60000");
  await page.locator("#payment-reference").fill("TRF-FLUJO");
  await page.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(page.getByTestId("payment-item").filter({ hasText: "TRF-FLUJO" })).toBeVisible();

  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByTestId("booking-status")).toHaveText("Confirmada");

  // 3. El cliente aparece en el CRM.
  await page.goto(`/adminpanel/clientes?q=${DOC}`);
  const customer = page.getByTestId("customer-item");
  await expect(customer).toHaveCount(1);
  await expect(customer).toContainText("Flor Flujo");

  // 4. El feed de la unidad tiene el evento (check-out libre) sin datos personales.
  const [{ icalToken }] = await sql<{ icalToken: string }>(
    `SELECT u."icalToken" FROM "Booking" b JOIN "Unit" u ON u."id" = b."unitId"
     JOIN "Customer" c ON c."id" = b."customerId" WHERE c."documentNumber" = $1`,
    [DOC],
  );
  const response = await request.get(`/api/ical/${icalToken}.ics`);
  expect(response.status()).toBe(200);
  const feed = await response.text();
  expect(feed).toContain(`DTSTART;VALUE=DATE:${IN.replaceAll("-", "")}`);
  expect(feed).toContain(`DTEND;VALUE=DATE:${OUT.replaceAll("-", "")}`);
  for (const personal of ["Flor", "Flujo", DOC, "flor@mail.com", "1155557777", "TRF-FLUJO"]) {
    expect(feed).not.toContain(personal);
  }
});
