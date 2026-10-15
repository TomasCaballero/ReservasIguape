import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { formatDMY, todayInBuenosAires, type ISODate } from "@/lib/booking/dates";
import type { FieldErrors } from "@/lib/booking/guest-validation";
import type { CategoryValue, DiscountValue, SeasonValue, SettingsValue } from "./validation";

// Operaciones del panel sobre el catálogo, las tarifas y los parámetros (RF-34 a 46).
// Reciben valores ya validados; devuelven errores por campo o las reservas que
// impiden un borrado (RF-36, RF-39).

type Db = PrismaClient;

export type Blocker = {
  reference: string;
  checkIn: ISODate;
  checkOut: ISODate;
  status: "PENDING" | "CONFIRMED";
  holderName: string;
};
export type Blockers = { total: number; items: Blocker[] };

export type MutationResult =
  | { ok: true }
  | { ok: false; errors: FieldErrors }
  | { ok: false; blocked: Blockers; message: string };

const MAX_LISTED = 10;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(db: Db, name: string): Promise<string> {
  const base = slugify(name) || "categoria";
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if (!(await db.category.findUnique({ where: { slug: candidate } }))) return candidate;
  }
}

/** Reservas Pendiente o Confirmada que todavía no terminaron (check-out posterior a hoy). */
async function futureBookings(
  db: Db,
  where: { categoryId: string } | { unitId: string },
  now: Date,
): Promise<Blockers> {
  const filter = {
    ...where,
    status: { in: ["PENDING", "CONFIRMED"] as ("PENDING" | "CONFIRMED")[] },
    checkOut: { gt: new Date(todayInBuenosAires(now)) },
  };
  const [total, rows] = await Promise.all([
    db.booking.count({ where: filter }),
    db.booking.findMany({
      where: filter,
      orderBy: { checkIn: "asc" },
      take: MAX_LISTED,
      include: { customer: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  return {
    total,
    items: rows.map((b) => ({
      reference: b.id.slice(0, 8).toUpperCase(),
      checkIn: iso(b.checkIn),
      checkOut: iso(b.checkOut),
      status: b.status as "PENDING" | "CONFIRMED",
      holderName: `${b.customer.firstName} ${b.customer.lastName}`,
    })),
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const blockedBy = (what: string, blockers: Blockers): MutationResult => ({
  ok: false,
  blocked: blockers,
  message: `No se puede ${what}: tiene ${plural(blockers.total, "reserva futura", "reservas futuras")} Pendiente o Confirmada.`,
});

// ───────────── Categorías (RF-34, 35, 36) ─────────────

export async function createCategory(db: Db, value: CategoryValue): Promise<MutationResult> {
  await db.category.create({ data: { ...value, slug: await uniqueSlug(db, value.name) } });
  return { ok: true };
}

/** El slug no cambia al editar: los enlaces con `?categoria=` siguen funcionando. */
export async function updateCategory(db: Db, id: string, value: CategoryValue): Promise<MutationResult> {
  const found = await db.category.findUnique({ where: { id }, select: { id: true } });
  if (!found) return { ok: false, errors: { _form: "La categoría no existe" } };
  await db.category.update({ where: { id }, data: value });
  return { ok: true };
}

/** Borra la categoría y sus unidades si no hay reservas futuras; las pasadas conservan su historial (AC-54). */
export async function deleteCategory(db: Db, id: string, now: Date = new Date()): Promise<MutationResult> {
  const blockers = await futureBookings(db, { categoryId: id }, now);
  if (blockers.total > 0) return blockedBy("eliminar la categoría", blockers);
  await db.$transaction([
    db.unit.deleteMany({ where: { categoryId: id } }),
    db.category.deleteMany({ where: { id } }),
  ]);
  return { ok: true };
}

// ───────────── Unidades (RF-37, 38, 39) ─────────────

export async function createUnit(db: Db, value: { name: string; categoryId: string }): Promise<MutationResult> {
  const category = await db.category.findUnique({ where: { id: value.categoryId }, select: { id: true } });
  if (!category) return { ok: false, errors: { categoryId: "La categoría no existe" } };
  await db.unit.create({
    data: { ...value, icalToken: randomBytes(16).toString("hex") }, // 128 bits (RNF-06)
  });
  return { ok: true };
}

/** Reasignar a otra categoría se bloquea si la unidad tiene reservas futuras: dejarían de ser coherentes. */
export async function updateUnit(
  db: Db,
  id: string,
  value: { name: string; categoryId: string },
  now: Date = new Date(),
): Promise<MutationResult> {
  const unit = await db.unit.findUnique({ where: { id } });
  if (!unit) return { ok: false, errors: { _form: "La unidad no existe" } };
  const category = await db.category.findUnique({ where: { id: value.categoryId }, select: { id: true } });
  if (!category) return { ok: false, errors: { categoryId: "La categoría no existe" } };

  if (unit.categoryId !== value.categoryId) {
    const blockers = await futureBookings(db, { unitId: id }, now);
    if (blockers.total > 0) return blockedBy("cambiar la unidad de categoría", blockers);
  }
  await db.unit.update({ where: { id }, data: value });
  return { ok: true };
}

export async function deleteUnit(db: Db, id: string, now: Date = new Date()): Promise<MutationResult> {
  const blockers = await futureBookings(db, { unitId: id }, now);
  if (blockers.total > 0) return blockedBy("eliminar la unidad", blockers);
  await db.unit.deleteMany({ where: { id } });
  return { ok: true };
}

// ───────────── Reglas de descuento (RF-40, 41, 42) ─────────────

export async function createDiscountRule(db: Db, value: DiscountValue): Promise<MutationResult> {
  await db.discountRule.create({ data: { ...value, active: true } });
  return { ok: true };
}

export async function updateDiscountRule(db: Db, id: string, value: DiscountValue): Promise<MutationResult> {
  const found = await db.discountRule.findUnique({ where: { id }, select: { id: true } });
  if (!found) return { ok: false, errors: { _form: "La regla no existe" } };
  await db.discountRule.update({ where: { id }, data: value });
  return { ok: true };
}

export async function setDiscountRuleActive(db: Db, id: string, active: boolean): Promise<MutationResult> {
  await db.discountRule.updateMany({ where: { id }, data: { active } });
  return { ok: true };
}

// ───────────── Temporadas (RF-43, 44, 45) ─────────────

/** Las temporadas no pueden superponerse (fin inclusive): así cada noche tiene un único precio. */
async function findOverlap(db: Db, value: SeasonValue, excludeId?: string) {
  return db.season.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startDate: { lte: new Date(value.endDate) },
      endDate: { gte: new Date(value.startDate) },
    },
    orderBy: { startDate: "asc" },
  });
}

async function saveSeason(db: Db, value: SeasonValue, id?: string): Promise<MutationResult> {
  const overlap = await findOverlap(db, value, id);
  if (overlap) {
    return {
      ok: false,
      errors: {
        startDate: `Se superpone con la temporada «${overlap.name}» (${formatDMY(iso(overlap.startDate))} – ${formatDMY(iso(overlap.endDate))})`,
      },
    };
  }
  const knownCategories = await db.category.findMany({
    where: { id: { in: value.prices.map((p) => p.categoryId) } },
    select: { id: true },
  });
  const known = new Set(knownCategories.map((c) => c.id));
  const prices = value.prices.filter((p) => known.has(p.categoryId));

  await db.$transaction(async (tx) => {
    const data = {
      name: value.name,
      startDate: new Date(value.startDate),
      endDate: new Date(value.endDate),
      minNights: value.minNights,
    };
    const season = id ? await tx.season.update({ where: { id }, data }) : await tx.season.create({ data });
    await tx.seasonPrice.deleteMany({ where: { seasonId: season.id } });
    await tx.seasonPrice.createMany({
      data: prices.map((p) => ({
        seasonId: season.id,
        categoryId: p.categoryId,
        priceArs: p.ars,
        priceUsd: p.usd,
      })),
    });
  });
  return { ok: true };
}

export const createSeason = (db: Db, value: SeasonValue) => saveSeason(db, value);

export async function updateSeason(db: Db, id: string, value: SeasonValue): Promise<MutationResult> {
  const found = await db.season.findUnique({ where: { id }, select: { id: true } });
  if (!found) return { ok: false, errors: { _form: "La temporada no existe" } };
  return saveSeason(db, value, id);
}

export async function deleteSeason(db: Db, id: string): Promise<MutationResult> {
  await db.season.deleteMany({ where: { id } });
  return { ok: true };
}

// ───────────── Parámetros del sistema (RF-46) ─────────────

export async function updateSettings(db: Db, value: SettingsValue): Promise<MutationResult> {
  await db.systemSettings.update({ where: { id: 1 }, data: value });
  return { ok: true };
}
