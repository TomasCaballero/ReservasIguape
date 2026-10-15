import { afterAll, describe, expect, it } from "vitest";
import {
  createCategory,
  createDiscountRule,
  createSeason,
  createUnit,
  deleteCategory,
  deleteSeason,
  deleteUnit,
  setDiscountRuleActive,
  updateCategory,
  updateDiscountRule,
  updateSeason,
  updateSettings,
  updateUnit,
} from "@/lib/admin/catalog";
import { prisma } from "@/lib/prisma";
import { createFixture } from "./helpers";

const fx = createFixture();
const tag = fx.tag;
// "Hoy" fijo: Dic-2026 es pasado y Feb-2027 es futuro.
const NOW = new Date("2027-01-02T12:00:00Z");
const category = (name: string) => ({
  name: `${tag} ${name}`,
  description: "fixture",
  maxCapacity: 4,
  basePriceArs: 60000,
  basePriceUsd: 60,
});
const ids = { rules: [] as string[] };

const bySlug = (name: string) => prisma.category.findUnique({ where: { slug: `${tag}-${name}` } });

afterAll(async () => {
  await fx.cleanup();
  await prisma.unit.deleteMany({ where: { category: { slug: { startsWith: tag } } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: tag } } });
  await prisma.discountRule.deleteMany({ where: { id: { in: ids.rules } } });
  await prisma.season.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.$disconnect();
});

describe("categorías (RF-34, 35, 36)", () => {
  it("crea con slug derivado del nombre y lo repite con sufijo (AC-50)", async () => {
    await createCategory(prisma, category("Suite"));
    await createCategory(prisma, category("Suite"));
    const first = await bySlug("suite");
    expect(first).toMatchObject({ maxCapacity: 4 });
    expect(Number(first?.basePriceArs)).toBe(60000);
    expect(await bySlug("suite-2")).not.toBeNull();
  });

  it("al editar cambia el precio y conserva el slug (AC-51)", async () => {
    const suite = (await bySlug("suite"))!;
    await updateCategory(prisma, suite.id, { ...category("Suite renombrada"), basePriceArs: 65000 });
    const after = await prisma.category.findUniqueOrThrow({ where: { id: suite.id } });
    expect(Number(after.basePriceArs)).toBe(65000);
    expect(after.slug).toBe(`${tag}-suite`);
  });

  it("elimina una categoría sin reservas junto con sus unidades (AC-52)", async () => {
    await createCategory(prisma, category("Vacia"));
    const empty = (await bySlug("vacia"))!;
    await createUnit(prisma, { name: `${tag} u`, categoryId: empty.id });
    expect(await deleteCategory(prisma, empty.id, NOW)).toEqual({ ok: true });
    expect(await bySlug("vacia")).toBeNull();
    expect(await prisma.unit.count({ where: { categoryId: empty.id } })).toBe(0);
  });

  it("con una reserva Pendiente futura se rechaza y lista las reservas con el titular (AC-53)", async () => {
    const cat = await fx.category("conreserva", 4, 1);
    await fx.booking(cat, cat.unitIds[0], "2027-02-10", "2027-02-12", "PENDING");
    const result = await deleteCategory(prisma, cat.id, NOW);
    if (result.ok || !("blocked" in result)) throw new Error("debía bloquearse");
    expect(result.message).toBe("No se puede eliminar la categoría: tiene 1 reserva futura Pendiente o Confirmada.");
    expect(result.blocked.total).toBe(1);
    expect(result.blocked.items[0]).toMatchObject({
      checkIn: "2027-02-10",
      checkOut: "2027-02-12",
      status: "PENDING",
      holderName: "Test Fixture",
    });
    expect(await prisma.category.findUnique({ where: { id: cat.id } })).not.toBeNull();
  });

  it("si las reservas son pasadas o canceladas se elimina y conservan su historial (AC-54)", async () => {
    const cat = await fx.category("historial", 4, 2);
    const past = await fx.booking(cat, cat.unitIds[0], "2026-12-10", "2026-12-12", "CONFIRMED");
    const cancelled = await fx.booking(cat, cat.unitIds[1], "2027-02-10", "2027-02-12", "PENDING");
    await prisma.booking.update({ where: { id: cancelled.id }, data: { status: "CANCELLED" } });

    expect(await deleteCategory(prisma, cat.id, NOW)).toEqual({ ok: true });
    const kept = await prisma.booking.findUniqueOrThrow({ where: { id: past.id } });
    expect(kept.categoryId).toBeNull();
    expect(kept.categoryName).toBe("fixture");
    expect(await prisma.booking.count({ where: { id: cancelled.id } })).toBe(1);
  });
});

describe("unidades (RF-37, 38, 39)", () => {
  it("crea una unidad en la categoría con token iCal de 128 bits (AC-55)", async () => {
    const cat = (await bySlug("suite"))!;
    await createUnit(prisma, { name: `${tag} Apart 7`, categoryId: cat.id });
    const unit = await prisma.unit.findFirstOrThrow({ where: { name: `${tag} Apart 7` } });
    expect(unit.icalToken).toMatch(/^[0-9a-f]{32}$/);
    expect(await prisma.unit.count({ where: { categoryId: cat.id } })).toBe(1);
  });

  it("la reasigna a otra categoría (AC-56)", async () => {
    const [from, to] = [(await bySlug("suite"))!, (await bySlug("suite-2"))!];
    const unit = await prisma.unit.findFirstOrThrow({ where: { name: `${tag} Apart 7` } });
    expect(await updateUnit(prisma, unit.id, { name: unit.name, categoryId: to.id }, NOW)).toEqual({ ok: true });
    expect(await prisma.unit.count({ where: { categoryId: from.id } })).toBe(0);
    expect(await prisma.unit.count({ where: { categoryId: to.id } })).toBe(1);
  });

  it("rechaza eliminar o reasignar una unidad con una reserva Confirmada futura (AC-57)", async () => {
    const cat = await fx.category("unidad", 4, 1);
    const other = await fx.category("otra", 4, 1);
    await fx.booking(cat, cat.unitIds[0], "2027-02-10", "2027-02-12", "CONFIRMED");

    const del = await deleteUnit(prisma, cat.unitIds[0], NOW);
    expect(del).toMatchObject({ ok: false, message: expect.stringContaining("eliminar la unidad") });
    const move = await updateUnit(prisma, cat.unitIds[0], { name: "x", categoryId: other.id }, NOW);
    expect(move).toMatchObject({ ok: false, message: expect.stringContaining("cambiar la unidad de categoría") });
    expect(await prisma.unit.findUnique({ where: { id: cat.unitIds[0] } })).not.toBeNull();
  });

  it("permite renombrar una unidad con reservas y eliminar una sin reservas futuras (AC-58)", async () => {
    const cat = await fx.category("libre", 4, 2);
    await fx.booking(cat, cat.unitIds[0], "2027-02-10", "2027-02-12", "CONFIRMED");
    expect(await updateUnit(prisma, cat.unitIds[0], { name: "Renombrada", categoryId: cat.id }, NOW)).toEqual({ ok: true });
    expect(await deleteUnit(prisma, cat.unitIds[1], NOW)).toEqual({ ok: true });
    expect(await prisma.unit.count({ where: { categoryId: cat.id } })).toBe(1);
  });
});

describe("reglas de descuento (RF-40, 41, 42)", () => {
  it("se crea activa, se edita y se desactiva (AC-59, 60, 61)", async () => {
    await createDiscountRule(prisma, { minNights: 5, percent: 15 });
    const rule = await prisma.discountRule.findFirstOrThrow({ orderBy: { id: "desc" }, where: { minNights: 5, percent: 15 } });
    ids.rules.push(rule.id);
    expect(rule.active).toBe(true);

    await updateDiscountRule(prisma, rule.id, { minNights: 5, percent: 20 });
    expect(Number((await prisma.discountRule.findUniqueOrThrow({ where: { id: rule.id } })).percent)).toBe(20);

    await setDiscountRuleActive(prisma, rule.id, false);
    expect((await prisma.discountRule.findUniqueOrThrow({ where: { id: rule.id } })).active).toBe(false);
  });
});

describe("temporadas (RF-43, 44, 45)", () => {
  const season = (name: string, startDate: string, endDate: string, categoryId?: string) => ({
    name: `${tag} ${name}`,
    startDate,
    endDate,
    minNights: 4,
    prices: categoryId ? [{ categoryId, ars: 55000, usd: 55 }] : [],
  });
  const find = (name: string) => prisma.season.findFirst({ where: { name: `${tag} ${name}` }, include: { prices: true } });

  it("crea una temporada con precio por categoría (AC-62)", async () => {
    const cat = (await bySlug("suite"))!;
    expect(await createSeason(prisma, season("Verano", "2031-12-20", "2032-02-28", cat.id))).toEqual({ ok: true });
    const created = await find("Verano");
    expect(created?.minNights).toBe(4);
    expect(created?.prices).toHaveLength(1);
    expect(Number(created?.prices[0].priceArs)).toBe(55000);
  });

  it("rechaza superposiciones, incluido el último día inclusive, y acepta días contiguos", async () => {
    const overlap = await createSeason(prisma, season("Pisa", "2032-02-28", "2032-03-05"));
    expect(overlap).toMatchObject({ ok: false, errors: { startDate: expect.stringContaining("Se superpone con la temporada") } });
    expect(await find("Pisa")).toBeNull();

    expect(await createSeason(prisma, season("Contigua", "2032-02-29", "2032-03-05"))).toEqual({ ok: true });
  });

  it("al editar puede cambiar la estadía mínima y no choca consigo misma (AC-63)", async () => {
    const verano = (await find("Verano"))!;
    const result = await updateSeason(prisma, verano.id, { ...season("Verano", "2031-12-20", "2032-02-28"), minNights: 3 });
    expect(result).toEqual({ ok: true });
    const after = (await find("Verano"))!;
    expect(after.minNights).toBe(3);
    expect(after.prices).toHaveLength(0); // se reemplazaron los precios por los enviados
  });

  it("al eliminar la temporada desaparece con sus precios (AC-64)", async () => {
    const verano = (await find("Verano"))!;
    await deleteSeason(prisma, verano.id);
    expect(await find("Verano")).toBeNull();
    expect(await prisma.seasonPrice.count({ where: { seasonId: verano.id } })).toBe(0);
  });
});

describe("parámetros del sistema (RF-46)", () => {
  it("se guardan en la base de datos (AC-65)", async () => {
    const before = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
    try {
      await updateSettings(prisma, {
        pendingNoticeHours: before.pendingNoticeHours,
        pendingExpiryDays: 7,
        maxNights: before.maxNights,
        maxAdvanceMonths: before.maxAdvanceMonths,
        anonymizationDays: before.anonymizationDays,
      });
      expect((await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } })).pendingExpiryDays).toBe(7);
    } finally {
      await prisma.systemSettings.update({ where: { id: 1 }, data: { pendingExpiryDays: before.pendingExpiryDays } });
    }
  });
});
