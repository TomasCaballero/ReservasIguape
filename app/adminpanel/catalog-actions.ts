"use server";

import { revalidatePath } from "next/cache";
import * as catalog from "@/lib/admin/catalog";
import type { MutationResult } from "@/lib/admin/catalog";
import {
  parseCategory,
  parseDiscount,
  parseSeason,
  parseSettings,
  parseUnit,
  type CategoryForm,
  type DiscountForm,
  type SeasonForm,
  type SettingsForm,
} from "@/lib/admin/validation";
import { requireAdmin } from "@/lib/auth/current-admin";
import { prisma } from "@/lib/prisma";

// Cada acción verifica la sesión: una Server Action es un endpoint POST y puede
// invocarse sin pasar por las pantallas (AC-106).

const PATHS = {
  categories: "/adminpanel/categorias",
  units: "/adminpanel/unidades",
  discounts: "/adminpanel/descuentos",
  seasons: "/adminpanel/temporadas",
  settings: "/adminpanel/parametros",
} as const;

/** Refresca el listado del panel y el catálogo público (los precios y la disponibilidad cambian). */
function refresh(path: string, result: MutationResult): MutationResult {
  if (result.ok) {
    revalidatePath(path);
    revalidatePath("/");
  }
  return result;
}

// ───────────── Categorías ─────────────

export async function saveCategoryAction(id: string | null, form: CategoryForm): Promise<MutationResult> {
  await requireAdmin();
  const parsed = parseCategory(form);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const result = id
    ? await catalog.updateCategory(prisma, id, parsed.value)
    : await catalog.createCategory(prisma, parsed.value);
  return refresh(PATHS.categories, result);
}

export async function deleteCategoryAction(id: string): Promise<MutationResult> {
  await requireAdmin();
  const result = await catalog.deleteCategory(prisma, id);
  if (result.ok) revalidatePath(PATHS.units);
  return refresh(PATHS.categories, result);
}

// ───────────── Unidades ─────────────

export async function saveUnitAction(
  id: string | null,
  form: { name: string; categoryId: string },
): Promise<MutationResult> {
  await requireAdmin();
  const parsed = parseUnit(form);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const result = id
    ? await catalog.updateUnit(prisma, id, parsed.value)
    : await catalog.createUnit(prisma, parsed.value);
  if (result.ok) revalidatePath(PATHS.categories);
  return refresh(PATHS.units, result);
}

export async function deleteUnitAction(id: string): Promise<MutationResult> {
  await requireAdmin();
  const result = await catalog.deleteUnit(prisma, id);
  if (result.ok) revalidatePath(PATHS.categories);
  return refresh(PATHS.units, result);
}

// ───────────── Descuentos ─────────────

export async function saveDiscountAction(id: string | null, form: DiscountForm): Promise<MutationResult> {
  await requireAdmin();
  const parsed = parseDiscount(form);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const result = id
    ? await catalog.updateDiscountRule(prisma, id, parsed.value)
    : await catalog.createDiscountRule(prisma, parsed.value);
  return refresh(PATHS.discounts, result);
}

export async function toggleDiscountAction(id: string, active: boolean): Promise<MutationResult> {
  await requireAdmin();
  return refresh(PATHS.discounts, await catalog.setDiscountRuleActive(prisma, id, active));
}

// ───────────── Temporadas ─────────────

export async function saveSeasonAction(id: string | null, form: SeasonForm): Promise<MutationResult> {
  await requireAdmin();
  const parsed = parseSeason(form);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const result = id
    ? await catalog.updateSeason(prisma, id, parsed.value)
    : await catalog.createSeason(prisma, parsed.value);
  return refresh(PATHS.seasons, result);
}

export async function deleteSeasonAction(id: string): Promise<MutationResult> {
  await requireAdmin();
  return refresh(PATHS.seasons, await catalog.deleteSeason(prisma, id));
}

// ───────────── Parámetros ─────────────

export async function saveSettingsAction(form: SettingsForm): Promise<MutationResult> {
  await requireAdmin();
  const parsed = parseSettings(form);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  return refresh(PATHS.settings, await catalog.updateSettings(prisma, parsed.value));
}
