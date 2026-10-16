import type { Locator, Page } from "@playwright/test";
import { addDays, todayInBuenosAires } from "../../lib/booking/dates";
import { bookingsFor, cleanupE2e } from "./db";
import { expect, test } from "./fixtures";

// RNF-01 · AC-102: el flujo del portal (búsqueda, resultados, formulario, modal) no tiene scroll
// horizontal de 360 a 1920 px y se opera con teclado. Titulares 97xxxxxx (se limpian solos).

const today = todayInBuenosAires();
const IN = (() => {
  const d = addDays(today, 30);
  return d.endsWith("-01") ? addDays(d, 1) : d;
})();
const OUT = addDays(IN, 3);
const DOC = `97${String(Date.now() % 1_000_000).padStart(6, "0")}`;

test.afterEach(() => cleanupE2e(IN));

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const width of [360, 768, 1920]) {
  test(`sin scroll horizontal en cada paso a ${width}px (AC-102)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    await page.goto("/");
    expect(await noHorizontalScroll(page)).toBe(true); // búsqueda

    await page.goto(`/?checkin=${IN}&checkout=${OUT}`);
    const card = page.getByTestId("category-card").filter({ has: page.getByRole("heading", { name: "De Luxe" }) });
    await expect(card).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true); // resultados

    await card.getByRole("button", { name: "Elegir" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("heading", { name: "Datos del titular" })).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true); // formulario

    await page.locator("#holder-firstName").fill("Tabi");
    await page.locator("#holder-lastName").fill("Teclado");
    await page.locator("#holder-email").fill("tabi@mail.com");
    await page.locator("#holder-phoneNumber").fill("1155550001");
    await page.locator("#holder-documentNumber").fill(DOC);
    await page.locator("#holder-birthDate").fill("01/05/1990");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true); // modal
  });
}

/** Avanza con Tab hasta que el control tenga el foco; falla si no lo alcanza. */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 200; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`No se llegó con Tab a ${target}`);
}

test("el flujo completo se opera solo con teclado (AC-102)", async ({ page }) => {
  await page.goto(`/?checkin=${IN}`);

  // Check-out con el calendario: Tab entra a la grilla (un solo día es tabulable) y las flechas
  // mueven el foco hasta el día; Enter lo elige.
  const focusedDay = () => page.evaluate(() => document.activeElement?.closest("[data-day]")?.getAttribute("data-day") ?? "");
  for (let i = 0; i < 200 && !(await focusedDay()); i++) await page.keyboard.press("Tab");
  expect(await focusedDay()).not.toBe("");
  for (let i = 0; i < 60 && (await focusedDay()) !== OUT; i++) {
    await page.keyboard.press((await focusedDay()) < OUT ? "ArrowRight" : "ArrowLeft");
  }
  expect(await focusedDay()).toBe(OUT);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("date-summary")).toContainText("3 noches");

  // Huéspedes: Espacio sobre el botón de agregar niños.
  await tabTo(page, page.getByRole("button", { name: "Agregar niños" }));
  await page.keyboard.press("Space");
  await expect(page.getByTestId("guests-summary")).toHaveText("2 adultos, 1 niño");

  // Elegir categoría y continuar.
  const card = page.getByTestId("category-card").filter({ has: page.getByRole("heading", { name: "De Luxe" }) });
  await tabTo(page, card.getByRole("button", { name: "Elegir" }));
  await page.keyboard.press("Enter");
  await expect(card.getByRole("button", { name: "Seleccionada" })).toBeVisible();
  await tabTo(page, page.getByRole("button", { name: "Continuar" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Datos del titular" })).toBeVisible();

  // Formulario: cada campo se alcanza con Tab y se escribe sin puntero.
  const values: Record<string, string> = {
    firstName: "Tabi",
    lastName: "Teclado",
    email: "tabi@mail.com",
    phoneNumber: "1155550001",
    documentNumber: DOC,
    birthDate: "01/05/1990",
  };
  for (const [field, value] of Object.entries(values)) {
    await tabTo(page, page.locator(`#holder-${field}`));
    await page.keyboard.type(value);
  }
  await tabTo(page, page.getByRole("button", { name: "Continuar" }));
  await page.keyboard.press("Enter");

  // Modal: confirmar con teclado.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await tabTo(page, dialog.getByRole("button", { name: "Confirmar" }));
  await page.keyboard.press("Enter");
  await expect(page.getByText("¡Recibimos tu solicitud!")).toBeVisible();
  expect(await bookingsFor(DOC)).toHaveLength(1);
});
