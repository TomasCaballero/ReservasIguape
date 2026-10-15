import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { addDays, todayInBuenosAires } from "../../lib/booking/dates";
import { bookingsFor, cleanupE2e, countSoftLocks, occupyAllUnits } from "./db";

// Flujo completo del portal contra la base de desarrollo (seed: De Luxe con 4 unidades).
// Los titulares de prueba usan documentos 97xxxxxx y se borran después de cada test.

const today = todayInBuenosAires();
const startDay = (() => {
  const d = addDays(today, 20);
  return d.endsWith("-01") ? addDays(d, 1) : d;
})();
const endDay = addDays(startDay, 3);

const alerts = (page: Page) => page.locator('main [role="alert"]');

let docCounter = 0;
const newDoc = () => `97${String((Date.now() + docCounter++) % 1_000_000).padStart(6, "0")}`;

test.afterEach(() => cleanupE2e(startDay));


async function openForm(page: Page, opts: { extraAdults?: number } = {}) {
  await page.goto(`/?checkin=${startDay}&checkout=${endDay}`);
  for (let i = 0; i < (opts.extraAdults ?? 0); i++) {
    await page.getByRole("button", { name: "Agregar adultos" }).click();
  }
  const card = page
    .getByTestId("category-card")
    .filter({ has: page.getByRole("heading", { name: "De Luxe" }) });
  await card.getByRole("button", { name: "Elegir" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Datos del titular" })).toBeVisible();
}

const FIELDS = {
  firstName: "Juan",
  lastName: "Pérez",
  email: "juan@mail.com",
  phoneNumber: "1155551234",
  documentNumber: "",
  birthDate: "01/05/1990",
};

async function fillHolder(page: Page, doc: string, skip?: keyof typeof FIELDS) {
  const values = { ...FIELDS, documentNumber: doc };
  for (const [field, value] of Object.entries(values)) {
    if (field === skip) continue;
    await page.locator(`#holder-${field}`).fill(value);
  }
}

test.describe("formulario del titular (RF-17 a RF-22)", () => {
  for (const field of Object.keys(FIELDS) as (keyof typeof FIELDS)[]) {
    test(`falta ${field}: no abre el modal ni crea la reserva (AC-26)`, async ({ page }) => {
      const doc = newDoc();
      await openForm(page);
      await fillHolder(page, doc, field);
      await page.getByRole("button", { name: "Continuar" }).click();

      const input = page.locator(`#holder-${field}`);
      await expect(input).toHaveAttribute("aria-invalid", "true");
      const describedBy = await input.getAttribute("aria-describedby");
      await expect(page.locator(`#${describedBy}`)).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await bookingsFor(doc)).toHaveLength(0);
    });
  }

  test("muestra el prefijo del país elegido (AC-29)", async ({ page }) => {
    await openForm(page);
    await expect(page.getByTestId("phone-prefix")).toHaveText("+54");
    await page.locator("#holder-phonePrefix").selectOption({ label: "Uruguay (+598)" });
    await expect(page.getByTestId("phone-prefix")).toHaveText("+598");
  });

  test("bloquea email, teléfono, documento y menor de edad (AC-27, 28, 30, 31)", async ({ page }) => {
    await openForm(page);
    await fillHolder(page, "123456");
    await page.locator("#holder-email").fill("juan@");
    await page.locator("#holder-phoneNumber").fill("12345");
    await page.locator("#holder-birthDate").fill("01/01/2020");
    await page.getByRole("button", { name: "Continuar" }).click();
    for (const field of ["email", "phoneNumber", "documentNumber", "birthDate"]) {
      await expect(page.locator(`#holder-${field}`)).toHaveAttribute("aria-invalid", "true");
    }
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("modal de confirmación (RF-24)", () => {
  test("muestra el teléfono completo, no crea la reserva y Volver conserva los datos (AC-35, AC-36)", async ({ page }) => {
    const doc = newDoc();
    await openForm(page);
    await fillHolder(page, doc);
    await page.getByRole("button", { name: "Continuar" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("confirm-phone")).toHaveText("+54 1155551234");
    await expect(dialog).toContainText("WhatsApp");
    await expect(dialog.getByRole("button", { name: "Confirmar" })).toBeVisible();
    expect(await bookingsFor(doc)).toHaveLength(0);

    await dialog.getByRole("button", { name: "Volver" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("#holder-firstName")).toHaveValue("Juan");
    await expect(page.locator("#holder-documentNumber")).toHaveValue(doc);
    await expect(page.locator("#holder-phoneNumber")).toBeEditable();
  });
});

test.describe("creación de la reserva (RF-28, RF-29)", () => {
  test("confirmar crea una reserva Pendiente, Web Directa, sin acompañantes (AC-33, 42, 43)", async ({ page }) => {
    const doc = newDoc();
    await openForm(page);
    await fillHolder(page, doc);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByText("¡Recibimos tu solicitud!")).toBeVisible();
    await expect(page.getByTestId("booking-reference")).toContainText(/[0-9A-F]{8}/);

    const [booking] = await bookingsFor(doc);
    expect(booking.status).toBe("PENDING");
    expect(booking.source).toBe("WEB_DIRECT");
    expect(booking.unitAssigned).toBe(false);
    expect(booking.guests).toBe(0);
    expect(Number(booking.total)).toBe(120000);
  });

  test("con 2 acompañantes cargados quedan asociados a la reserva (AC-34)", async ({ page }) => {
    const doc = newDoc();
    await openForm(page, { extraAdults: 1 }); // 3 huéspedes → hasta 2 acompañantes
    await fillHolder(page, doc);
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Agregar acompañante" }).click();
      await page.locator(`#companion-${i}-firstName`).fill(`Ana${i}`);
      await page.locator(`#companion-${i}-lastName`).fill("Gómez");
      await page.locator(`#companion-${i}-documentNumber`).fill(`3011122${i}`);
      await page.locator(`#companion-${i}-birthDate`).fill("02/02/1992");
    }
    await expect(page.getByRole("button", { name: "Agregar acompañante" })).toHaveCount(0);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("¡Recibimos tu solicitud!")).toBeVisible();

    const [booking] = await bookingsFor(doc);
    expect(booking.guests).toBe(2);
  });
});

test.describe("soft lock (RF-25, RF-27)", () => {
  test("entrar al formulario bloquea una unidad y volver a la búsqueda la libera (AC-37)", async ({ page }) => {
    const locks = () => countSoftLocks(startDay);
    await openForm(page);
    expect(await locks()).toBe(1);
    await page.getByRole("button", { name: "Volver a la búsqueda" }).first().click();
    await expect(page.getByRole("heading", { name: "Aparts disponibles" })).toBeVisible();
    await expect.poll(locks).toBe(0);
  });

  test("si otro tomó las unidades, confirmar da 409 y el formulario conserva los datos (AC-40)", async ({ page }) => {
    const doc = newDoc();
    await openForm(page);
    await fillHolder(page, doc);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Mientras A completa el formulario su lock vence y otros ocupan todas las unidades.
    await occupyAllUnits("de-luxe", startDay, endDay);

    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(alerts(page)).toContainText("Las fechas seleccionadas ya no están disponibles");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("#holder-firstName")).toHaveValue("Juan");
    await expect(page.locator("#holder-documentNumber")).toHaveValue(doc);
    expect(await bookingsFor(doc)).toHaveLength(0);
  });
});

test.describe("responsive del formulario (RNF-01)", () => {
  for (const width of [360, 768, 1920]) {
    test(`sin scroll horizontal a ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openForm(page);
      await page.getByRole("button", { name: "Agregar acompañante" }).click();
      const { scroll, inner } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(inner);
    });
  }
});
