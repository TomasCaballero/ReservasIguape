import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { clearLoginThrottles } from "./db";

const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

test.beforeEach(() => clearLoginThrottles());
test.afterEach(() => clearLoginThrottles());

async function login(page: Page, email = EMAIL, password = PASSWORD) {
  await page.goto("/adminpanel");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

const alerts = (page: Page) => page.locator('main [role="alert"]');

test("las credenciales del .env están configuradas", () => {
  expect(EMAIL).not.toBe("");
  expect(PASSWORD).not.toBe("");
});

test.describe("login (RF-31)", () => {
  test("con credenciales correctas entra a /adminpanel con sesión iniciada (AC-45)", async ({ page, context }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
    await expect(page).toHaveURL(/\/adminpanel$/);

    const cookie = (await context.cookies()).find((c) => c.name === "admin_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");

    const me = await page.request.get("/api/admin/me");
    expect(me.status()).toBe(200);
    expect((await me.json()).email.toLowerCase()).toBe(EMAIL.toLowerCase());
  });

  test("con contraseña incorrecta se rechaza, queda en el login y no hay sesión (AC-46)", async ({ page, context }) => {
    await login(page, EMAIL, "contraseña-incorrecta");
    await expect(alerts(page)).toHaveText("Email o contraseña incorrectos.");
    await expect(page.locator("#email")).toHaveValue(EMAIL); // el email no se borra
    await expect(page).toHaveURL(/\/adminpanel$/);
    expect((await context.cookies()).some((c) => c.name === "admin_session")).toBe(false);
    expect((await page.request.get("/api/admin/me")).status()).toBe(401);
  });

  test("tras 3 intentos fallidos bloquea 15 minutos aunque la clave sea correcta (AC-47)", async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await login(page, EMAIL, `incorrecta-${i}`);
      await expect(alerts(page)).toHaveText("Email o contraseña incorrectos.");
    }
    await login(page);
    await expect(alerts(page)).toContainText("15 minutos");
    await expect(page.getByRole("heading", { name: "Bienvenido" })).toHaveCount(0);
  });

  test("salir cierra la sesión", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page.locator("#email")).toBeVisible();
    expect((await page.request.get("/api/admin/me")).status()).toBe(401);
  });
});

test.describe("control de acceso (AC-106)", () => {
  test("una pantalla del panel sin sesión redirige al login", async ({ page }) => {
    await page.goto("/adminpanel/reservas");
    await expect(page).toHaveURL(/\/adminpanel$/);
    await expect(page.locator("#email")).toBeVisible();
  });

  test("todas las rutas del panel sin sesión muestran el login y ninguna API admin devuelve datos", async ({ page, request }) => {
    const routes = ["", "reservas", "calendario", "clientes", "ical", "categorias", "unidades", "temporadas", "descuentos", "parametros"];
    for (const route of routes) {
      await page.goto(`/adminpanel/${route}`);
      await expect(page).toHaveURL(/\/adminpanel$/);
      await expect(page.locator("#email")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Bienvenido" })).toHaveCount(0);
    }
    const id = "00000000-0000-4000-8000-000000000000";
    for (const [method, url] of [
      ["get", "/api/admin/me"],
      ["get", `/api/admin/payments/${id}/receipt`],
      ["post", `/api/admin/bookings/${id}/payments`],
    ] as const) {
      const res = await request[method](url);
      expect(res.status(), `${method} ${url}`).toBe(401);
      expect(await res.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "No autorizado" } });
    }
  });

  test("la API administrativa responde 401 sin datos", async ({ request }) => {
    const res = await request.get("/api/admin/me");
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "No autorizado" } });
  });

  test("una cookie falsificada no da acceso", async ({ page, context }) => {
    await context.addCookies([
      { name: "admin_session", value: "eyJzdWIiOiJ4IiwiZXhwIjo5OTk5OTk5OTk5fQ.firma-falsa", url: "http://localhost:7777" },
    ]);
    expect((await page.request.get("/api/admin/me")).status()).toBe(401);
    await page.goto("/adminpanel");
    await expect(page.locator("#email")).toBeVisible();
  });
});

test.describe("no indexación (RF-33, AC-49)", () => {
  test("el panel lleva noindex en el HTML y en el encabezado", async ({ page }) => {
    const response = await page.goto("/adminpanel");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    expect(response?.headers()["x-robots-tag"]).toBe("noindex");
  });

  test("el portal público no enlaza al panel", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href*="adminpanel"]')).toHaveCount(0);
  });
});
