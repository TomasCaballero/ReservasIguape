import { describe, expect, it } from "vitest";
import { quoteStay, type DiscountRuleInput, type SeasonInput } from "@/lib/booking/pricing";

const base = { ars: 40000, usd: 40 };
const high: SeasonInput = {
  startDate: "2026-12-20",
  endDate: "2027-02-28",
  minNights: 1,
  price: { ars: 55000, usd: 55 },
};
const rule = (minNights: number, percent: number, active = true): DiscountRuleInput => ({
  minNights,
  percent,
  active,
});

const quote = (
  checkIn: string,
  checkOut: string,
  opts: { seasons?: SeasonInput[]; rules?: DiscountRuleInput[]; currency?: "ARS" | "USD" } = {},
) =>
  quoteStay({
    checkIn,
    checkOut,
    currency: opts.currency ?? "ARS",
    basePrice: base,
    seasons: opts.seasons ?? [],
    discountRules: opts.rules ?? [],
  });

describe("tarifas base (RF-11..13)", () => {
  it("3 noches sin temporada ni descuento (AC-18)", () => {
    const q = quote("2026-11-10", "2026-11-13");
    expect(q.nightCount).toBe(3);
    expect(q.nights.every((n) => n.price === 40000)).toBe(true);
    expect(q.total).toBe(120000);
  });

  it("muestra los montos en USD (AC-17)", () => {
    const q = quote("2026-11-10", "2026-11-13", { currency: "USD" });
    expect(q.nights[0].price).toBe(40);
    expect(q.total).toBe(120);
  });
});

describe("temporadas (RF-14)", () => {
  it("4 noches dentro de la temporada (AC-19)", () => {
    const q = quote("2026-12-26", "2026-12-30", { seasons: [high] });
    expect(q.nights[0].price).toBe(55000);
    expect(q.total).toBe(220000);
  });

  it("estadía que cruza el borde: 2 × 40.000 + 2 × 55.000 (AC-20)", () => {
    const q = quote("2026-12-18", "2026-12-22", { seasons: [high] });
    expect(q.nights.map((n) => n.price)).toEqual([40000, 40000, 55000, 55000]);
    expect(q.total).toBe(190000);
  });

  it("el último día de la temporada es inclusivo", () => {
    const q = quote("2027-02-28", "2027-03-02", { seasons: [high] });
    expect(q.nights.map((n) => n.price)).toEqual([55000, 40000]);
  });

  it("usa el precio base si la temporada no tiene precio para la categoría", () => {
    const q = quote("2026-12-26", "2026-12-28", { seasons: [{ ...high, price: null }] });
    expect(q.total).toBe(80000);
  });
});

describe("estadía mínima (RF-15)", () => {
  const withMin = [{ ...high, minNights: 4 }];

  it("rechaza 2 noches dentro de la temporada (AC-21)", () => {
    const q = quote("2026-12-21", "2026-12-23", { seasons: withMin });
    expect(q.minStayError).toBe("La estadía mínima es de 4 noches");
  });

  it("2 noches fuera de temporada pueden continuar; con una noche dentro no (AC-22)", () => {
    expect(quote("2026-12-18", "2026-12-20", { seasons: withMin }).minStayError).toBeNull();
    expect(quote("2026-12-19", "2026-12-21", { seasons: withMin }).minStayError).toBe(
      "La estadía mínima es de 4 noches",
    );
  });

  it("al bajar el mínimo a 3, 3 noches continúan (AC-63)", () => {
    const q = quote("2026-12-26", "2026-12-29", { seasons: [{ ...high, minNights: 3 }] });
    expect(q.minStayError).toBeNull();
  });
});

describe("descuentos (RF-16)", () => {
  it("15% desde 5 noches (AC-23)", () => {
    const q = quote("2026-11-10", "2026-11-15", { rules: [rule(5, 15)] });
    expect([q.subtotal, q.discountPercent, q.discountAmount, q.total]).toEqual([
      200000, 15, 30000, 170000,
    ]);
  });

  it("aplica solo el mayor porcentaje (AC-24)", () => {
    const q = quote("2026-11-10", "2026-11-16", { rules: [rule(3, 10), rule(5, 15)] });
    expect([q.subtotal, q.discountPercent, q.discountAmount, q.total]).toEqual([
      240000, 15, 36000, 204000,
    ]);
  });

  it("con 4 noches aplica solo el 10% (AC-25)", () => {
    const q = quote("2026-11-10", "2026-11-14", { rules: [rule(3, 10), rule(5, 15)] });
    expect([q.subtotal, q.discountPercent, q.discountAmount, q.total]).toEqual([
      160000, 10, 16000, 144000,
    ]);
  });

  it("ignora reglas desactivadas (AC-61)", () => {
    const q = quote("2026-11-10", "2026-11-15", { rules: [rule(5, 15, false)] });
    expect(q.total).toBe(200000);
  });

  it("cambiar el porcentaje a 20% descuenta 40.000 (AC-60)", () => {
    const q = quote("2026-11-10", "2026-11-15", { rules: [rule(5, 20)] });
    expect(q.discountAmount).toBe(40000);
  });

  it("el descuento se aplica sobre el total de la estadía, no por noche", () => {
    const q = quote("2026-12-18", "2026-12-22", { seasons: [high], rules: [rule(3, 10)] });
    expect([q.subtotal, q.discountAmount, q.total]).toEqual([190000, 19000, 171000]);
  });
});
