import type { Currency } from "@/lib/booking/pricing";

const numberFormat = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** ARS → "$40.000"; USD → "USD 40" (AC-17, AC-18). */
export function formatMoney(amount: number, currency: Currency): string {
  const n = numberFormat.format(amount);
  return currency === "ARS" ? `$${n}` : `USD ${n}`;
}

/** Monto negativo para descuentos: "-$30.000". */
export function formatDiscount(amount: number, currency: Currency): string {
  return `-${formatMoney(amount, currency)}`;
}

export function formatNights(count: number): string {
  return `${count} ${count === 1 ? "noche" : "noches"}`;
}

/** AC-03: "2 adultos, 1 niño". */
export function formatGuests(adults: number, children: number): string {
  const a = `${adults} ${adults === 1 ? "adulto" : "adultos"}`;
  if (children === 0) return a;
  return `${a}, ${children} ${children === 1 ? "niño" : "niños"}`;
}
