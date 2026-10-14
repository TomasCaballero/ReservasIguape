import { eachNight, type ISODate } from "./dates";

export type Currency = "ARS" | "USD";

export type PriceByCurrency = { ars: number; usd: number };

export type SeasonInput = {
  startDate: ISODate; // inclusive
  endDate: ISODate; // inclusive
  minNights: number;
  /** Precio de la temporada para la categoría; si falta, rige el precio base. */
  price: PriceByCurrency | null;
};

export type DiscountRuleInput = { minNights: number; percent: number; active: boolean };

export type NightPrice = { date: ISODate; price: number };

export type Quote = {
  currency: Currency;
  nights: NightPrice[];
  nightCount: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  /** RF-15: estadía mínima exigida por las temporadas que toca la estadía. */
  minStayRequired: number;
  minStayError: string | null;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Temporada que contiene la noche; si hay varias, la que empieza más tarde. */
function seasonForNight(night: ISODate, seasons: SeasonInput[]): SeasonInput | null {
  let found: SeasonInput | null = null;
  for (const s of seasons) {
    if (night >= s.startDate && night <= s.endDate) {
      if (!found || s.startDate > found.startDate) found = s;
    }
  }
  return found;
}

/**
 * RF-14: precio noche por noche (temporada o base). RF-15: estadía mínima.
 * RF-16: descuento de mayor porcentaje entre las reglas activas cuyo mínimo se
 * cumple, sobre el total de la estadía; no se acumulan.
 */
export function quoteStay(input: {
  checkIn: ISODate;
  checkOut: ISODate;
  currency: Currency;
  basePrice: PriceByCurrency;
  seasons: SeasonInput[];
  discountRules: DiscountRuleInput[];
}): Quote {
  const { currency, basePrice, seasons, discountRules } = input;
  const pick = (p: PriceByCurrency) => (currency === "ARS" ? p.ars : p.usd);

  const nights: NightPrice[] = [];
  let minStayRequired = 1;
  for (const date of eachNight(input.checkIn, input.checkOut)) {
    const season = seasonForNight(date, seasons);
    if (season) minStayRequired = Math.max(minStayRequired, season.minNights);
    nights.push({ date, price: pick(season?.price ?? basePrice) });
  }

  const nightCount = nights.length;
  const subtotal = round2(nights.reduce((sum, n) => sum + n.price, 0));
  const discountPercent = discountRules
    .filter((r) => r.active && nightCount >= r.minNights)
    .reduce((max, r) => Math.max(max, r.percent), 0);
  const discountAmount = round2((subtotal * discountPercent) / 100);

  return {
    currency,
    nights,
    nightCount,
    subtotal,
    discountPercent,
    discountAmount,
    total: round2(subtotal - discountAmount),
    minStayRequired,
    minStayError:
      nightCount < minStayRequired ? `La estadía mínima es de ${minStayRequired} noches` : null,
  };
}
