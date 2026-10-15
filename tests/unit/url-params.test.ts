import { describe, expect, it } from "vitest";
import { parsePrefill } from "@/lib/booking/url-params";
import { formatDiscount, formatGuests, formatMoney, formatNights } from "@/lib/format";

describe("parsePrefill (RF-05, RF-06, RF-07)", () => {
  it("lee fechas válidas (AC-06) y el slug de la categoría (AC-07)", () => {
    expect(
      parsePrefill({ checkin: "2026-11-10", checkout: "2026-11-14", categoria: "de-luxe" }),
    ).toEqual({ checkIn: "2026-11-10", checkOut: "2026-11-14", categorySlug: "de-luxe" });
  });

  it("ignora valores inválidos sin error y deja los campos vacíos (AC-08)", () => {
    expect(parsePrefill({ checkin: "2026-13-45", categoria: "Inexistente!" })).toEqual({
      checkIn: null,
      checkOut: null,
      categorySlug: null,
    });
  });

  it("ignora el check-out si no hay check-in válido o no es posterior", () => {
    expect(parsePrefill({ checkout: "2026-11-14" }).checkOut).toBeNull();
    expect(parsePrefill({ checkin: "2026-11-10", checkout: "2026-11-10" }).checkOut).toBeNull();
    expect(parsePrefill({ checkin: "2026-11-10", checkout: "2026-11-09" }).checkOut).toBeNull();
  });

  it("ignora fechas con formato válido pero inexistentes y valores repetidos raros", () => {
    expect(parsePrefill({ checkin: "2026-02-30" }).checkIn).toBeNull();
    expect(parsePrefill({ checkin: ["2026-11-10", "x"] }).checkIn).toBe("2026-11-10");
  });
});

describe("formato", () => {
  it("muestra pesos y dólares como en los criterios (AC-17, AC-18)", () => {
    expect(formatMoney(40000, "ARS")).toBe("$40.000");
    expect(formatMoney(40, "USD")).toBe("USD 40");
    expect(formatMoney(120000, "ARS")).toBe("$120.000");
    expect(formatDiscount(30000, "ARS")).toBe("-$30.000");
  });

  it("pluraliza noches y huéspedes (AC-02, AC-03)", () => {
    expect(formatNights(1)).toBe("1 noche");
    expect(formatNights(4)).toBe("4 noches");
    expect(formatGuests(2, 1)).toBe("2 adultos, 1 niño");
    expect(formatGuests(1, 0)).toBe("1 adulto");
    expect(formatGuests(2, 3)).toBe("2 adultos, 3 niños");
  });
});
