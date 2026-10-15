import { describe, expect, it } from "vitest";
import {
  parseCategory,
  parseDiscount,
  parseMoney,
  parseSeason,
  parseSettings,
  type SeasonForm,
} from "@/lib/admin/validation";
import { slugify } from "@/lib/admin/catalog";

describe("parseMoney", () => {
  it("acepta enteros y hasta 2 decimales; rechaza separador de miles y no positivos", () => {
    expect(parseMoney("40000")).toBe(40000);
    expect(parseMoney("40000,50")).toBe(40000.5);
    expect(parseMoney("40000.5")).toBe(40000.5);
    expect(parseMoney("40.000")).toBe("invalid"); // ambiguo
    expect(parseMoney("0")).toBe("invalid");
    expect(parseMoney("-5")).toBe("invalid");
    expect(parseMoney("abc")).toBe("invalid");
    expect(parseMoney("  ")).toBe("empty");
  });
});

describe("parseCategory (RF-34)", () => {
  const valid = { name: "Suite", description: "Con vista", maxCapacity: "4", basePriceArs: "60000", basePriceUsd: "60" };

  it("devuelve los valores convertidos (AC-50)", () => {
    expect(parseCategory(valid)).toEqual({
      ok: true,
      value: { name: "Suite", description: "Con vista", maxCapacity: 4, basePriceArs: 60000, basePriceUsd: 60 },
    });
  });

  it("marca cada campo inválido o vacío", () => {
    const r = parseCategory({ name: " ", description: "", maxCapacity: "0", basePriceArs: "", basePriceUsd: "x" });
    if (r.ok) throw new Error("debía fallar");
    expect(Object.keys(r.errors).sort()).toEqual(["basePriceArs", "basePriceUsd", "description", "maxCapacity", "name"]);
  });
});

describe("parseDiscount (RF-40)", () => {
  it("15% desde 5 noches (AC-59)", () => {
    expect(parseDiscount({ minNights: "5", percent: "15" })).toEqual({ ok: true, value: { minNights: 5, percent: 15 } });
    expect(parseDiscount({ minNights: "3", percent: "12,5" })).toEqual({ ok: true, value: { minNights: 3, percent: 12.5 } });
  });

  it("rechaza porcentaje 0, mayor a 100 y noches inválidas", () => {
    for (const percent of ["0", "101", "abc", ""]) {
      expect(parseDiscount({ minNights: "5", percent }).ok, percent).toBe(false);
    }
    expect(parseDiscount({ minNights: "0", percent: "10" }).ok).toBe(false);
  });
});

describe("parseSeason (RF-43)", () => {
  const form: SeasonForm = {
    name: "Verano",
    startDate: "20/12/2026",
    endDate: "28/02/2027",
    minNights: "4",
    prices: { "cat-1": { ars: "55000", usd: "55" }, "cat-2": { ars: "", usd: "" } },
  };

  it("convierte fechas y omite las categorías sin precio propio (AC-62)", () => {
    expect(parseSeason(form)).toEqual({
      ok: true,
      value: {
        name: "Verano",
        startDate: "2026-12-20",
        endDate: "2027-02-28",
        minNights: 4,
        prices: [{ categoryId: "cat-1", ars: 55000, usd: 55 }],
      },
    });
  });

  it("rechaza fin anterior al inicio, fechas inexistentes y precios incompletos", () => {
    const backwards = parseSeason({ ...form, startDate: "10/01/2027", endDate: "09/01/2027" });
    if (backwards.ok) throw new Error("debía fallar");
    expect(backwards.errors.endDate).toBeDefined();

    const invalid = parseSeason({ ...form, startDate: "31/02/2027" });
    if (invalid.ok) throw new Error("debía fallar");
    expect(invalid.errors.startDate).toBeDefined();

    const half = parseSeason({ ...form, prices: { "cat-1": { ars: "55000", usd: "" } } });
    if (half.ok) throw new Error("debía fallar");
    expect(half.errors["prices.cat-1.usd"]).toBe("Falta el precio en USD");
  });
});

describe("parseSettings (RF-46)", () => {
  const form = {
    pendingNoticeHours: "24",
    pendingExpiryDays: "7",
    maxNights: "30",
    maxAdvanceMonths: "12",
    anonymizationDays: "30",
  };

  it("acepta valores dentro de rango (AC-65)", () => {
    expect(parseSettings(form)).toEqual({
      ok: true,
      value: { pendingNoticeHours: 24, pendingExpiryDays: 7, maxNights: 30, maxAdvanceMonths: 12, anonymizationDays: 30 },
    });
  });

  it("rechaza vacíos, decimales y fuera de rango", () => {
    const r = parseSettings({ ...form, pendingExpiryDays: "0", maxNights: "1.5", maxAdvanceMonths: "" });
    if (r.ok) throw new Error("debía fallar");
    expect(Object.keys(r.errors).sort()).toEqual(["maxAdvanceMonths", "maxNights", "pendingExpiryDays"]);
  });
});

describe("slugify", () => {
  it("normaliza acentos, espacios y símbolos", () => {
    expect(slugify("King Suite")).toBe("king-suite");
    expect(slugify("  Suite Ñandú #1 ")).toBe("suite-nandu-1");
    expect(slugify("De Luxe")).toBe("de-luxe");
  });
});
