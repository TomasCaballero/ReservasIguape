"use server";

import { revalidatePath } from "next/cache";
import type { MutationResult } from "@/lib/admin/catalog";
import { addIcalSource, removeIcalSource } from "@/lib/admin/ical-sources";
import { parseIcalSource, type IcalSourceForm } from "@/lib/admin/validation";
import { requireAdmin } from "@/lib/auth/current-admin";
import { syncAll } from "@/lib/ical/sync";
import { prisma } from "@/lib/prisma";

// Cada acción verifica la sesión (AC-106). Importar o quitar fuentes cambia la
// disponibilidad pública, por eso se refrescan el calendario y "/".

function refresh(result: MutationResult): MutationResult {
  if (result.ok) {
    revalidatePath("/adminpanel/ical");
    revalidatePath("/adminpanel/calendario");
    revalidatePath("/");
  }
  return result;
}

export async function addIcalSourceAction(form: IcalSourceForm): Promise<MutationResult> {
  await requireAdmin();
  const parsed = parseIcalSource(form);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  return refresh(await addIcalSource(prisma, parsed.value));
}

export async function removeIcalSourceAction(id: string): Promise<MutationResult> {
  await requireAdmin();
  return refresh(await removeIcalSource(prisma, id));
}

/** RF-67: sincronización manual. Falla si alguna fuente falla, para que el botón lo muestre. */
export async function syncNowAction(): Promise<MutationResult> {
  await requireAdmin();
  const run = await syncAll(prisma, "MANUAL");
  refresh({ ok: true });
  return run.ok ? { ok: true } : { ok: false, errors: { _form: "Alguna fuente no pudo sincronizarse; revisá el error indicado" } };
}
