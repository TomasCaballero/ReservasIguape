import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { addDays, addMonths, formatDMY, todayInBuenosAires } from "../../lib/booking/dates";

// Los precios esperados salen del seed de desarrollo (De Luxe $40.000 / USD 40,
// Loft capacidad 2, De Luxe capacidad 5) sin temporadas ni descuentos cargados.

const today = todayInBuenosAires();
/** Un día del mes que no sea el 1, para que el día anterior siga visible en el calendario. */
const startDay = (() => {
  const d = addDays(today, 10);
  return d.endsWith("-01") ? addDays(d, 1) : d;
})();

const card = (page: Page, name: string) =>
  page.getByTestId("category-card").filter({ has: page.getByRole("heading", { name }) });

// Next.js agrega su propio role="alert" (anunciador de rutas): se acota al contenido.
const alerts = (page: Page) => page.locator('main [role="alert"]');

const search = (checkIn: string, nights: number, extra = "") =>
  `/?checkin=${checkIn}&checkout=${addDays(checkIn, nights)}${extra}`;

test("una ruta inexistente redirige a / (AC-44)", async ({ page }) => {
  await page.goto("/ruta-que-no-existe");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("el portal no enlaza al panel de administración (AC-49)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('a[href*="adminpanel"]')).toHaveCount(0);
});

test.describe("preselección por URL", () => {
  test("fechas y categoría (AC-06, AC-07, AC-02)", async ({ page }) => {
    await page.goto(search(startDay, 4, "&categoria=de-luxe"));
    await expect(page.getByTestId("date-summary")).toContainText(
      `${formatDMY(startDay)} – ${formatDMY(addDays(startDay, 4))}`,
    );
    await expect(page.getByTestId("date-summary")).toContainText("4 noches");
    await expect(card(page, "De Luxe").getByRole("button", { name: "Seleccionada" })).toBeVisible();
  });

  test("parámetros inválidos se ignoran sin error (AC-08)", async ({ page }) => {
    await page.goto("/?checkin=2026-13-45&categoria=inexistente");
    await expect(page.getByTestId("date-summary")).toContainText("Elegí el check-in");
    await expect(alerts(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Seleccionada" })).toHaveCount(0);
  });
});

test.describe("fechas", () => {
  test("con el check-in elegido no se puede elegir un check-out anterior (AC-01)", async ({ page }) => {
    await page.goto(`/?checkin=${startDay}`);
    await expect(page.locator(`[data-day="${addDays(startDay, -1)}"] button`)).toBeDisabled();
    await expect(page.locator(`[data-day="${startDay}"] button`)).toBeDisabled(); // AC-11
    await expect(page.locator(`[data-day="${addDays(startDay, 1)}"] button`)).toBeEnabled();
  });

  test("elegir check-in y check-out con el calendario (AC-02)", async ({ page }) => {
    await page.goto(`/?checkin=${startDay}`);
    await page.locator(`[data-day="${addDays(startDay, 4)}"] button`).click();
    await expect(page.getByTestId("date-summary")).toContainText("4 noches");
  });

  test("el máximo de 30 noches se rechaza con mensaje; 30 se acepta (AC-12)", async ({ page }) => {
    await page.goto(search(startDay, 31));
    await expect(alerts(page)).toHaveText("El máximo es de 30 noches");
    await page.goto(search(startDay, 30));
    await expect(card(page, "De Luxe")).toBeVisible();
  });

  test("la anticipación máxima es de 12 meses (AC-13)", async ({ page }) => {
    const limit = addMonths(today, 12);
    await page.goto(search(limit, 2));
    await expect(card(page, "De Luxe")).toBeVisible();
    await page.goto(search(addDays(limit, 1), 2));
    await expect(alerts(page)).toBeVisible();
  });

  test("no permite check-in anterior a hoy (AC-09)", async ({ page }) => {
    await page.goto(search(addDays(today, -1), 2));
    await expect(alerts(page)).toBeVisible();
    await page.goto(search(today, 2));
    await expect(card(page, "De Luxe")).toBeVisible();
  });
});

test.describe("huéspedes", () => {
  test("resumen de adultos y niños (AC-03)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Agregar niños" }).click();
    await expect(page.getByTestId("guests-summary")).toHaveText("2 adultos, 1 niño");
  });

  test("exige al menos 1 adulto (AC-04)", async ({ page }) => {
    await page.goto(search(startDay, 3));
    await page.getByRole("button", { name: "Agregar niños" }).click();
    await page.getByRole("button", { name: "Quitar adultos" }).click();
    await page.getByRole("button", { name: "Quitar adultos" }).click();
    await expect(alerts(page)).toHaveText("Se requiere al menos 1 adulto");
    await expect(page.getByTestId("category-card")).toHaveCount(0);
  });

  test("excluye categorías con capacidad insuficiente (AC-05)", async ({ page }) => {
    await page.goto(search(startDay, 3));
    await expect(card(page, "Loft")).toBeVisible();
    await page.getByRole("button", { name: "Agregar niños" }).click();
    await expect(card(page, "De Luxe")).toBeVisible();
    await expect(card(page, "Loft")).toHaveCount(0);
  });
});

test.describe("precios", () => {
  test("tarifa, noches y total (AC-18)", async ({ page }) => {
    await page.goto(search(startDay, 3));
    const deluxe = card(page, "De Luxe");
    await expect(deluxe).toContainText("$40.000/noche");
    await expect(deluxe).toContainText("3 noches");
    await expect(deluxe).toContainText("Total: $120.000");
  });

  test("al cambiar a USD todo el flujo pasa a dólares (AC-17)", async ({ page }) => {
    await page.goto(search(startDay, 3));
    await page.getByRole("button", { name: "Dólares (USD)" }).click();
    const deluxe = card(page, "De Luxe");
    await expect(deluxe).toContainText("USD 40/noche");
    await expect(deluxe).toContainText("Total: USD 120");
  });
});

test.describe("responsive (RNF-01, AC-102)", () => {
  for (const width of [360, 768, 1920]) {
    test(`sin scroll horizontal a ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(search(startDay, 3, "&categoria=de-luxe"));
      await expect(card(page, "De Luxe")).toBeVisible();
      const { scroll, inner } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(inner);
    });
  }
});
