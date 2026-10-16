import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { addDays, todayInBuenosAires } from "../../lib/booking/dates";
import { cleanupE2e, clearLoginThrottles } from "./db";
import { expect, test } from "./fixtures";

// RNF-02 · AC-103 · D-14 · P-06: la guía son los tokens de app/globals.css. Se recorren las
// pantallas y se compara `color`, `background-color`, `border-color` y `font-family` de cada
// elemento visible con esos tokens (ignorando el alfa) y con las dos tipografías.

const EMAIL = process.env.ADMIN_EMAIL ?? "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const IN = addDays(todayInBuenosAires(), 50);
const OUT = addDays(IN, 3);
const DOC = `97${String(Date.now() % 1_000_000).padStart(6, "0")}`;

const css = readFileSync("app/globals.css", "utf-8");
const ALLOWED_COLORS = [...new Set([...css.matchAll(/--color-[\w-]+:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1].toLowerCase()))];
const ALLOWED_FONTS = ["DM Serif Display", "Source Sans 3"];
const GENERICS = new Set(["serif", "sans-serif"]);

test.afterEach(async () => {
  await cleanupE2e(IN);
  await clearLoginThrottles();
});

/** Devuelve los "elemento · propiedad · valor" que quedan fuera de la guía en la pantalla actual. */
async function offenders(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ colors, fonts, generics }) => {
      const canvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
      const hex = (value: string) => {
        canvas.clearRect(0, 0, 1, 1);
        canvas.fillStyle = "#000";
        canvas.fillStyle = value; // el navegador convierte rgb/oklab/color-mix a sRGB
        canvas.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
        return { hex: "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join(""), a };
      };
      const found = new Set<string>();
      for (const el of document.querySelectorAll<HTMLElement>("body, body *")) {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (box.width === 0 || box.height === 0 || style.visibility === "hidden" || style.display === "none") continue;
        if (["SCRIPT", "STYLE", "NEXTJS-PORTAL"].includes(el.tagName) || el.closest("nextjs-portal")) continue;
        const name = `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}`;
        const checks: [string, string][] = [
          ["color", style.color],
          ["background-color", style.backgroundColor],
          ...(["Top", "Right", "Bottom", "Left"] as const)
            .filter((side) => parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== "none")
            .map((side) => [`border-${side.toLowerCase()}-color`, style[`border${side}Color`]] as [string, string]),
        ];
        for (const [prop, value] of checks) {
          const { hex: h, a } = hex(value);
          if (a === 0) continue; // transparente
          if (!colors.includes(h)) found.add(`${name} · ${prop} · ${value} (${h})`);
        }
        if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())) {
          const families = style.fontFamily.split(",").map((f) => f.trim().replace(/^["']|["']$/g, ""));
          const bad = families.filter((f) => !generics.includes(f) && !fonts.some((allowed) => f.startsWith(allowed)));
          if (bad.length) found.add(`${name} · font-family · ${style.fontFamily}`);
        }
      }
      return [...found];
    },
    { colors: ALLOWED_COLORS, fonts: ALLOWED_FONTS, generics: [...GENERICS] },
  );
}

async function expectClean(page: Page, label: string) {
  expect(await offenders(page), `fuera de la guía en ${label}`).toEqual([]);
}

test("la auditoría detecta un color y una tipografía fuera de la guía", async ({ page }) => {
  expect(ALLOWED_COLORS).toHaveLength(8); // tokens de globals.css sin repetidos
  await page.goto("/");
  await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<p style="color:#ff0000;font-family:Arial">x</p>'));
  const found = await offenders(page);
  expect(found.some((f) => f.includes("color"))).toBe(true);
  expect(found.some((f) => f.includes("font-family"))).toBe(true);
});

test("portal: búsqueda, resultados, formulario, modal y confirmación (AC-103)", async ({ page }) => {
  await page.goto("/");
  await expectClean(page, "búsqueda");

  await page.goto(`/?checkin=${IN}&checkout=${OUT}`);
  const card = page.getByTestId("category-card").filter({ has: page.getByRole("heading", { name: "De Luxe" }) });
  await expect(card).toBeVisible();
  await expectClean(page, "resultados");

  await card.getByRole("button", { name: "Elegir" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Datos del titular" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click(); // errores de validación visibles
  await expectClean(page, "formulario con errores");

  const values = { firstName: "Esti", lastName: "Lo", email: "esti@mail.com", phoneNumber: "1155550002", documentNumber: DOC, birthDate: "01/05/1990" };
  for (const [field, value] of Object.entries(values)) await page.locator(`#holder-${field}`).fill(value);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectClean(page, "modal");

  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("¡Recibimos tu solicitud!")).toBeVisible();
  await expectClean(page, "confirmación");
});

test("panel: login y pantallas principales (por consistencia)", async ({ page }) => {
  await clearLoginThrottles();
  await page.goto("/adminpanel");
  await expectClean(page, "login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
  await expectClean(page, "inicio");
  for (const path of ["reservas", "calendario", "clientes", "ical", "categorias", "unidades", "temporadas", "descuentos", "parametros"]) {
    await page.goto(`/adminpanel/${path}`);
    await expectClean(page, path);
  }
});
