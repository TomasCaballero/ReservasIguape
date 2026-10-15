import { isValidISODate, type ISODate } from "@/lib/booking/dates";
import type { FieldErrors } from "@/lib/booking/guest-validation";

// Validación de los formularios del panel (RF-34, 40, 43, 46). Recibe lo que se
// escribió en los campos (texto) y devuelve los valores ya convertidos o los
// errores por campo. Se usa en el servidor: el navegador solo muestra el resultado.

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const REQUIRED = "Este campo es obligatorio";
const MAX_MONEY = 9_999_999_999.99; // Decimal(12,2)

/** "40000", "40000,50", "40000.5". Sin separador de miles: "40.000" se rechaza para evitar ambigüedad. */
export function parseMoney(text: string): number | "invalid" | "empty" {
  const t = text.trim();
  if (!t) return "empty";
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return "invalid";
  const n = Number(t.replace(",", "."));
  return n > 0 && n <= MAX_MONEY ? n : "invalid";
}

const MONEY_ERROR = "Ingresá un monto mayor a 0, sin separador de miles (ej. 40000 o 40000,50)";

function intInRange(text: string, min: number, max: number): number | null {
  const t = text.trim();
  if (!/^\d{1,6}$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= max ? n : null;
}

function text(value: string, max: number, errors: FieldErrors, key: string, label: string) {
  const v = value.trim();
  if (!v) errors[key] = REQUIRED;
  else if (v.length > max) errors[key] = `${label} admite hasta ${max} caracteres`;
  return v;
}

// ───────────── Categorías ─────────────

export type CategoryForm = {
  name: string;
  description: string;
  maxCapacity: string;
  basePriceArs: string;
  basePriceUsd: string;
};
export type CategoryValue = {
  name: string;
  description: string;
  maxCapacity: number;
  basePriceArs: number;
  basePriceUsd: number;
};

export function parseCategory(form: CategoryForm): Parsed<CategoryValue> {
  const errors: FieldErrors = {};
  const name = text(form.name, 60, errors, "name", "El nombre");
  const description = text(form.description, 300, errors, "description", "La descripción");

  const maxCapacity = intInRange(form.maxCapacity, 1, 20);
  if (maxCapacity === null) {
    errors.maxCapacity = form.maxCapacity.trim() ? "Ingresá un número entero entre 1 y 20" : REQUIRED;
  }

  const money = (raw: string, key: "basePriceArs" | "basePriceUsd") => {
    const parsed = parseMoney(raw);
    if (parsed === "empty") errors[key] = REQUIRED;
    else if (parsed === "invalid") errors[key] = MONEY_ERROR;
    return typeof parsed === "number" ? parsed : 0;
  };
  const basePriceArs = money(form.basePriceArs, "basePriceArs");
  const basePriceUsd = money(form.basePriceUsd, "basePriceUsd");

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { name, description, maxCapacity: maxCapacity as number, basePriceArs, basePriceUsd },
  };
}

// ───────────── Unidades ─────────────

export function parseUnit(form: { name: string; categoryId: string }): Parsed<{ name: string; categoryId: string }> {
  const errors: FieldErrors = {};
  const name = text(form.name, 60, errors, "name", "El nombre");
  if (!form.categoryId) errors.categoryId = "Elegí una categoría";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, categoryId: form.categoryId } };
}

// ───────────── Reglas de descuento ─────────────

export type DiscountForm = { minNights: string; percent: string };
export type DiscountValue = { minNights: number; percent: number };

export function parseDiscount(form: DiscountForm): Parsed<DiscountValue> {
  const errors: FieldErrors = {};
  const minNights = intInRange(form.minNights, 1, 365);
  if (minNights === null) {
    errors.minNights = form.minNights.trim() ? "Ingresá un número entero entre 1 y 365" : REQUIRED;
  }
  const raw = form.percent.trim().replace(",", ".");
  let percent = NaN;
  if (!raw) errors.percent = REQUIRED;
  else if (!/^\d{1,3}(\.\d{1,2})?$/.test(raw) || !((percent = Number(raw)) > 0 && percent <= 100)) {
    errors.percent = "Ingresá un porcentaje mayor a 0 y hasta 100";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { minNights: minNights as number, percent } };
}

// ───────────── Temporadas ─────────────

/** dd/mm/aaaa → AAAA-MM-DD, o null si está vacío o es inexistente. */
export function dmyToISODate(value: string): ISODate | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isValidISODate(iso) ? iso : null;
}

export type SeasonForm = {
  name: string;
  startDate: string; // dd/mm/aaaa
  endDate: string;
  minNights: string;
  /** Por categoría; si ambos montos quedan vacíos, rige el precio base. */
  prices: Record<string, { ars: string; usd: string }>;
};
export type SeasonValue = {
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  minNights: number;
  prices: { categoryId: string; ars: number; usd: number }[];
};

export function parseSeason(form: SeasonForm): Parsed<SeasonValue> {
  const errors: FieldErrors = {};
  const name = text(form.name, 60, errors, "name", "El nombre");

  const startDate = dmyToISODate(form.startDate);
  const endDate = dmyToISODate(form.endDate);
  if (!form.startDate.trim()) errors.startDate = REQUIRED;
  else if (!startDate) errors.startDate = "Ingresá una fecha válida (dd/mm/aaaa)";
  if (!form.endDate.trim()) errors.endDate = REQUIRED;
  else if (!endDate) errors.endDate = "Ingresá una fecha válida (dd/mm/aaaa)";
  if (startDate && endDate && endDate < startDate) {
    errors.endDate = "La fecha de fin no puede ser anterior a la de inicio";
  }

  const minNights = intInRange(form.minNights, 1, 365);
  if (minNights === null) {
    errors.minNights = form.minNights.trim() ? "Ingresá un número entero entre 1 y 365" : REQUIRED;
  }

  const prices: SeasonValue["prices"] = [];
  for (const [categoryId, p] of Object.entries(form.prices)) {
    const ars = parseMoney(p.ars);
    const usd = parseMoney(p.usd);
    if (ars === "empty" && usd === "empty") continue; // sin precio propio: rige el base
    if (ars === "invalid" || ars === "empty") errors[`prices.${categoryId}.ars`] = ars === "empty" ? "Falta el precio en ARS" : MONEY_ERROR;
    if (usd === "invalid" || usd === "empty") errors[`prices.${categoryId}.usd`] = usd === "empty" ? "Falta el precio en USD" : MONEY_ERROR;
    if (typeof ars === "number" && typeof usd === "number") prices.push({ categoryId, ars, usd });
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      startDate: startDate as ISODate,
      endDate: endDate as ISODate,
      minNights: minNights as number,
      prices,
    },
  };
}

// ───────────── Parámetros del sistema ─────────────

export const SETTINGS_FIELDS = {
  pendingNoticeHours: { label: "Aviso de reserva Pendiente sin contacto (horas)", min: 1, max: 720 },
  pendingExpiryDays: { label: "Vencimiento de reserva Pendiente (días)", min: 1, max: 60 },
  maxNights: { label: "Máximo de noches por reserva", min: 1, max: 365 },
  maxAdvanceMonths: { label: "Máxima anticipación (meses)", min: 1, max: 36 },
  anonymizationDays: { label: "Plazo de anonimización (días)", min: 1, max: 365 },
} as const;

export type SettingsKey = keyof typeof SETTINGS_FIELDS;
export type SettingsForm = Record<SettingsKey, string>;
export type SettingsValue = Record<SettingsKey, number>;

export function parseSettings(form: SettingsForm): Parsed<SettingsValue> {
  const errors: FieldErrors = {};
  const value = {} as SettingsValue;
  for (const key of Object.keys(SETTINGS_FIELDS) as SettingsKey[]) {
    const { min, max } = SETTINGS_FIELDS[key];
    const n = intInRange(form[key], min, max);
    if (n === null) errors[key] = form[key].trim() ? `Ingresá un número entero entre ${min} y ${max}` : REQUIRED;
    else value[key] = n;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}
