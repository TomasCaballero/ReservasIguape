"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/admin/bookings";
import { anonymizeCustomer, requestAnonymization } from "@/lib/admin/customers";
import type { MutationResult } from "@/lib/admin/catalog";
import { requireAdmin } from "@/lib/auth/current-admin";
import { prisma } from "@/lib/prisma";

// Cada acción verifica la sesión (AC-106).

function refreshCustomer(customerId: string, result: ActionResult): MutationResult {
  if (!result.ok) return { ok: false, errors: { _form: result.message } };
  revalidatePath(`/adminpanel/clientes/${customerId}`);
  revalidatePath("/adminpanel/clientes");
  revalidatePath("/adminpanel/reservas");
  revalidatePath("/adminpanel");
  return { ok: true };
}

export async function requestAnonymizationAction(customerId: string): Promise<MutationResult> {
  await requireAdmin();
  return refreshCustomer(customerId, await requestAnonymization(prisma, customerId));
}

export async function anonymizeCustomerAction(customerId: string): Promise<MutationResult> {
  await requireAdmin();
  return refreshCustomer(customerId, await anonymizeCustomer(prisma, customerId));
}
