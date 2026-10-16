import { createServer, type Server } from "node:http";
import type { Page } from "@playwright/test";
import { addDays, todayInBuenosAires } from "../../lib/booking/dates";
import { cleanupAdminE2e, clearLoginThrottles, seedCategory, sql } from "./db";
import { expect, test } from "./fixtures";

const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

const IN = addDays(todayInBuenosAires(), 60);
const OUT = addDays(IN, 2);
const compact = (d: string) => d.replaceAll("-", "");

// Feed externo de prueba: lo sirve este mismo proceso para que el servidor lo importe sin red.
const FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:e2e-evento-1",
  "SUMMARY:Huésped externo",
  `DTSTART;VALUE=DATE:${compact(IN)}`,
  `DTEND;VALUE=DATE:${compact(OUT)}`,
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

let server: Server;
let feedUrl: string;
const startedAt = new Date();

test.beforeAll(async () => {
  server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/calendar" });
    res.end(FEED);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  feedUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/feed.ics`;
});
test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});
test.beforeEach(async () => {
  await clearLoginThrottles();
  await cleanupAdminE2e();
});
test.afterEach(async () => {
  await cleanupAdminE2e(); // las unidades E2E se borran con sus fuentes y bloqueos
  await sql(`DELETE FROM "IcalSyncRun" WHERE "startedAt" >= $1`, [startedAt]);
  await clearLoginThrottles();
});

async function login(page: Page) {
  await page.goto("/adminpanel");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
}

test("la pantalla iCal exige sesión (AC-106)", async ({ page }) => {
  await page.goto("/adminpanel/ical");
  await expect(page).toHaveURL(/\/adminpanel$/);
  await expect(page.locator("#email")).toBeVisible();
});

test("muestra la URL del feed y al abrirla devuelve text/calendar (AC-98)", async ({ page, request }) => {
  await seedCategory("E2E iCal feed", 1);
  await login(page);
  await page.goto("/adminpanel/ical");

  const url = (await page.getByTestId("feed-url").first().innerText()).trim();
  expect(url).toMatch(/\/api\/ical\/[0-9a-f]{32}\.ics$/);
  const res = await request.get(url);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  expect(await res.text()).toContain("BEGIN:VCALENDAR");
  expect((await request.get("/api/ical/nope.ics")).status()).toBe(404);
});

test("alta de fuente, sincronizar ahora y el bloqueo aparece en el calendario (AC-99, AC-101)", async ({ page }) => {
  await seedCategory("E2E iCal sync", 1);
  await login(page);
  await page.goto("/adminpanel/ical");

  const unit = page.getByTestId("ical-unit").filter({ hasText: "E2E iCal sync u0" });
  await unit.getByLabel("Etiqueta (ej. Booking)").fill("E2E Booking");
  await unit.getByLabel("URL del feed iCal").fill("ftp://no-valida");
  await unit.getByRole("button", { name: "Agregar fuente" }).click();
  await expect(unit.getByText("Ingresá una URL que empiece con http:// o https://")).toBeVisible();

  await unit.getByLabel("URL del feed iCal").fill(feedUrl);
  await unit.getByRole("button", { name: "Agregar fuente" }).click();
  await expect(unit.getByTestId("ical-source")).toContainText("E2E Booking");

  await page.getByRole("button", { name: "Sincronizar ahora" }).click();
  await expect(unit.getByTestId("ical-source")).toContainText("Última sincronización");
  await expect(page.getByTestId("sync-runs").getByText("altas: 1").first()).toBeVisible();

  await page.goto(`/adminpanel/calendario?mes=${IN.slice(0, 7)}`);
  await expect(page.getByTestId("block-item").filter({ hasText: "Reserva externa (iCal)" }).first()).toBeVisible();

  // Quitar la fuente libera las fechas.
  await page.goto("/adminpanel/ical");
  await unit.getByRole("button", { name: /Quitar E2E Booking/ }).click();
  await unit.getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(unit.getByTestId("ical-source")).toHaveCount(0);
  const [left] = await sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "UnitBlock" WHERE "externalUid" = 'e2e-evento-1'`);
  expect(left.n).toBe(0);
});

test("sin scroll horizontal de 360 a 1920 px (RNF-01)", async ({ page }) => {
  await seedCategory("E2E iCal ancho", 1);
  await login(page);
  for (const width of [360, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/adminpanel/ical");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
  }
});
