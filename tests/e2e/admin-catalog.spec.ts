import type { Page } from "@playwright/test";
import { addDays, todayInBuenosAires } from "../../lib/booking/dates";
import {
  cleanupAdminE2e,
  clearLoginThrottles,
  pendingExpiryDays,
  seedCategory,
  seedPendingBooking,
  setPendingExpiryDays,
  sql,
} from "./db";
import { expect, test } from "./fixtures";

const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";

let originalExpiryDays = 5;

test.beforeAll(async () => {
  originalExpiryDays = await pendingExpiryDays();
});
test.beforeEach(async () => {
  await clearLoginThrottles();
  await cleanupAdminE2e();
});
test.afterEach(async () => {
  await cleanupAdminE2e();
  await setPendingExpiryDays(originalExpiryDays);
  await clearLoginThrottles();
});

async function openSection(page: Page, path: string) {
  await page.goto("/adminpanel");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
  await page.goto(path);
}

const item = (page: Page, testId: string, text: string) =>
  page.getByTestId(testId).filter({ hasText: text });

test("las secciones del panel exigen sesión (AC-106)", async ({ page }) => {
  for (const path of ["categorias", "unidades", "descuentos", "temporadas", "parametros"]) {
    await page.goto(`/adminpanel/${path}`);
    await expect(page).toHaveURL(/\/adminpanel$/);
    await expect(page.locator("#email")).toBeVisible();
  }
});

test.describe("categorías (RF-34, 35, 36)", () => {
  test("crear, editar el precio y eliminar (AC-50, 51, 52)", async ({ page }) => {
    await openSection(page, "/adminpanel/categorias");

    await page.locator("#cat-name").fill("E2E Suite");
    await page.locator("#cat-description").fill("Suite de prueba");
    await page.locator("#cat-maxCapacity").fill("4");
    await page.locator("#cat-basePriceArs").fill("60000");
    await page.locator("#cat-basePriceUsd").fill("60");
    await page.getByRole("button", { name: "Crear categoría" }).click();
    const created = item(page, "category-item", "E2E Suite");
    await expect(created).toContainText("$60.000/noche");
    await expect(created).toContainText("Hasta 4 huéspedes");

    await created.getByRole("link", { name: "Editar E2E Suite" }).click();
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible(); // ya está en modo edición
    await page.locator("#cat-basePriceArs").fill("65000");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page).toHaveURL(/\/adminpanel\/categorias$/);
    await expect(item(page, "category-item", "E2E Suite")).toContainText("$65.000/noche");

    await page.getByRole("button", { name: "Eliminar E2E Suite" }).click();
    await page.getByRole("button", { name: "Confirmar eliminación" }).click();
    await expect(item(page, "category-item", "E2E Suite")).toHaveCount(0);
  });

  test("muestra errores por campo y no crea nada", async ({ page }) => {
    await openSection(page, "/adminpanel/categorias");
    await page.locator("#cat-basePriceArs").fill("40.000");
    await page.getByRole("button", { name: "Crear categoría" }).click();
    for (const field of ["name", "description", "maxCapacity", "basePriceArs", "basePriceUsd"]) {
      await expect(page.locator(`#cat-${field}`)).toHaveAttribute("aria-invalid", "true");
    }
  });

  test("con una reserva Pendiente futura se rechaza y lista las reservas con el titular (AC-53)", async ({ page }) => {
    const cat = await seedCategory("E2E Bloqueada", 1);
    const checkIn = addDays(todayInBuenosAires(), 30);
    await seedPendingBooking(cat.id, cat.unitIds[0], checkIn, addDays(checkIn, 2));

    await openSection(page, "/adminpanel/categorias");
    await page.getByRole("button", { name: "Eliminar E2E Bloqueada" }).click();
    await page.getByRole("button", { name: "Confirmar eliminación" }).click();

    const notice = page.getByTestId("blocked-notice");
    await expect(notice).toContainText("No se puede eliminar la categoría: tiene 1 reserva futura");
    await expect(notice).toContainText("Pendiente");
    await expect(notice).toContainText("Laura Gómez");
    await expect(item(page, "category-item", "E2E Bloqueada")).toHaveCount(1);
  });
});

test.describe("unidades (RF-37, 38, 39)", () => {
  test("crear, reasignar de categoría y eliminar (AC-55, 56, 58)", async ({ page }) => {
    await seedCategory("E2E Uno");
    await seedCategory("E2E Dos");
    await openSection(page, "/adminpanel/unidades");

    await page.locator("#unit-name").fill("E2E Apart 7");
    await page.locator("#unit-categoryId").selectOption({ label: "E2E Uno" });
    await page.getByRole("button", { name: "Crear unidad" }).click();
    await expect(item(page, "unit-item", "E2E Apart 7")).toContainText("E2E Uno");

    await page.getByRole("link", { name: "Editar E2E Apart 7" }).click();
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible(); // ya está en modo edición
    await page.locator("#unit-categoryId").selectOption({ label: "E2E Dos" });
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(item(page, "unit-item", "E2E Apart 7")).toContainText("E2E Dos");

    await page.getByRole("button", { name: "Eliminar E2E Apart 7" }).click();
    await page.getByRole("button", { name: "Confirmar eliminación" }).click();
    await expect(item(page, "unit-item", "E2E Apart 7")).toHaveCount(0);
  });

  test("una unidad con reserva futura no se puede eliminar (AC-57)", async ({ page }) => {
    const cat = await seedCategory("E2E Ocupada", 1);
    const checkIn = addDays(todayInBuenosAires(), 30);
    await seedPendingBooking(cat.id, cat.unitIds[0], checkIn, addDays(checkIn, 2));

    await openSection(page, "/adminpanel/unidades");
    await page.getByRole("button", { name: "Eliminar E2E Ocupada u0" }).click();
    await page.getByRole("button", { name: "Confirmar eliminación" }).click();
    await expect(page.getByTestId("blocked-notice")).toContainText("No se puede eliminar la unidad");
    await expect(item(page, "unit-item", "E2E Ocupada u0")).toHaveCount(1);
  });
});

test.describe("descuentos (RF-40, 41, 42)", () => {
  const nights = 5;
  const searchUrl = () => {
    const checkIn = addDays(todayInBuenosAires(), 40);
    return `/?checkin=${checkIn}&checkout=${addDays(checkIn, nights)}`;
  };
  const deluxe = (page: Page) =>
    page.getByTestId("category-card").filter({ has: page.getByRole("heading", { name: "De Luxe" }) });

  test("crear, editar y desactivar se refleja en el portal público (AC-59, 60, 61)", async ({ page }) => {
    await openSection(page, "/adminpanel/descuentos");
    await page.locator("#disc-minNights").fill("2");
    await page.locator("#disc-percent").fill("13");
    await page.getByRole("button", { name: "Crear regla" }).click();
    await expect(item(page, "discount-item", "13% desde 2 noches")).toContainText("Activa");

    await page.goto(searchUrl());
    await expect(deluxe(page)).toContainText("Descuento (13%)");
    await expect(deluxe(page)).toContainText("-$26.000");

    await page.goto("/adminpanel/descuentos");
    await page.getByRole("link", { name: "Editar 13% desde 2 noches" }).click();
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible(); // ya está en modo edición
    await page.locator("#disc-percent").fill("21");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(item(page, "discount-item", "21% desde 2 noches")).toBeVisible();
    await page.goto(searchUrl());
    await expect(deluxe(page)).toContainText("-$42.000");

    await page.goto("/adminpanel/descuentos");
    await page.getByRole("button", { name: "Desactivar 21% desde 2 noches" }).click();
    await expect(item(page, "discount-item", "21% desde 2 noches")).toContainText("Inactiva");
    await page.goto(searchUrl());
    await expect(deluxe(page)).toContainText("Total: $200.000");
    await expect(deluxe(page)).not.toContainText("Descuento");
  });

  test("rechaza porcentajes inválidos", async ({ page }) => {
    await openSection(page, "/adminpanel/descuentos");
    await page.locator("#disc-minNights").fill("5");
    await page.locator("#disc-percent").fill("150");
    await page.getByRole("button", { name: "Crear regla" }).click();
    await expect(page.locator("#disc-percent")).toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("temporadas (RF-43, 44, 45)", () => {
  const fillSeason = async (page: Page, name: string, start: string, end: string, min = "4") => {
    await page.locator("#season-name").fill(name);
    await page.locator("#season-startDate").fill(start);
    await page.locator("#season-endDate").fill(end);
    await page.locator("#season-minNights").fill(min);
  };

  test("crear con precio por categoría, impedir superposición, editar y eliminar (AC-62, 63, 64)", async ({ page }) => {
    await openSection(page, "/adminpanel/temporadas");
    await fillSeason(page, "E2E Verano", "20/12/2031", "28/02/2032");
    await page.getByLabel("De Luxe (ARS)", { exact: true }).fill("55000");
    await page.getByLabel("De Luxe (USD)", { exact: true }).fill("55");
    await page.getByRole("button", { name: "Crear temporada" }).click();
    const created = item(page, "season-item", "E2E Verano");
    await expect(created).toContainText("20/12/2031 – 28/02/2032");
    await expect(created).toContainText("estadía mínima 4 noches");
    await expect(created).toContainText("De Luxe: $55.000 / USD 55");

    // Una temporada que comparte el último día (inclusive) se rechaza.
    await fillSeason(page, "E2E Pisa", "28/02/2032", "05/03/2032");
    await page.getByRole("button", { name: "Crear temporada" }).click();
    await expect(page.locator("#season-startDate")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Se superpone con la temporada «E2E Verano»")).toBeVisible();
    await expect(item(page, "season-item", "E2E Pisa")).toHaveCount(0);

    await page.getByRole("link", { name: "Editar E2E Verano" }).click();
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible(); // ya está en modo edición
    await page.locator("#season-minNights").fill("3");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(item(page, "season-item", "E2E Verano")).toContainText("estadía mínima 3 noches");

    await page.getByRole("button", { name: "Eliminar E2E Verano" }).click();
    await page.getByRole("button", { name: "Confirmar eliminación" }).click();
    await expect(item(page, "season-item", "E2E Verano")).toHaveCount(0);
  });
});

test.describe("parámetros del sistema (RF-46)", () => {
  test("el cambio queda guardado en la base de datos y sobrevive a una recarga (AC-65)", async ({ page }) => {
    await openSection(page, "/adminpanel/parametros");
    await expect(page.locator("#setting-pendingExpiryDays")).toHaveValue(String(originalExpiryDays));
    await page.locator("#setting-pendingExpiryDays").fill("7");
    await page.getByRole("button", { name: "Guardar parámetros" }).click();
    await expect(page.getByRole("status")).toHaveText("Parámetros guardados.");

    await page.reload();
    await expect(page.locator("#setting-pendingExpiryDays")).toHaveValue("7");
    const [row] = await sql<{ d: number }>(`SELECT "pendingExpiryDays" AS d FROM "SystemSettings" WHERE "id" = 1`);
    expect(row.d).toBe(7);
  });

  test("rechaza valores fuera de rango", async ({ page }) => {
    await openSection(page, "/adminpanel/parametros");
    await page.locator("#setting-maxNights").fill("0");
    await page.getByRole("button", { name: "Guardar parámetros" }).click();
    await expect(page.locator("#setting-maxNights")).toHaveAttribute("aria-invalid", "true");
  });
});

test("las secciones del panel no desbordan en pantallas chicas (RNF-01)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openSection(page, "/adminpanel");
  for (const path of ["", "/categorias", "/unidades", "/descuentos", "/temporadas", "/parametros"]) {
    await page.goto(`/adminpanel${path}`);
    const { scroll, inner } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(scroll, path || "inicio").toBeLessThanOrEqual(inner);
  }
});
