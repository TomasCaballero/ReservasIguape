"use server";

import { revalidatePath } from "next/cache";
import { createBlock, deleteBlock } from "@/lib/admin/blocks";
import { assignUnit, changeBookingStatus, markPaymentInfoSent, type ActionResult, type BookingStatus } from "@/lib/admin/bookings";
import type { MutationResult } from "@/lib/admin/catalog";
import { parseBlock, type BlockForm } from "@/lib/admin/validation";
import { requireAdmin } from "@/lib/auth/current-admin";
import { prisma } from "@/lib/prisma";

// Cada acción verifica la sesión (AC-106). Las reservas y el calendario cambian
// la disponibilidad pública, por eso también se refresca "/".

const STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "CANCELLED", "FINISHED"];

function toMutation(result: ActionResult): MutationResult {
  return result.ok ? { ok: true } : { ok: false, errors: { _form: result.message } };
}

function refreshBooking(bookingId: string, result: MutationResult): MutationResult {
  if (result.ok) {
    revalidatePath(`/adminpanel/reservas/${bookingId}`);
    revalidatePath("/adminpanel/reservas");
    revalidatePath("/adminpanel/calendario");
    revalidatePath("/adminpanel");
    revalidatePath("/");
  }
  return result;
}

export async function changeStatusAction(bookingId: string, to: string): Promise<MutationResult> {
  await requireAdmin();
  if (!STATUSES.includes(to as BookingStatus)) return { ok: false, errors: { _form: "Transición no permitida" } };
  return refreshBooking(bookingId, toMutation(await changeBookingStatus(prisma, bookingId, to as BookingStatus)));
}

export async function assignUnitAction(bookingId: string, unitId: string): Promise<MutationResult> {
  await requireAdmin();
  if (!unitId) return { ok: false, errors: { _form: "Elegí una unidad" } };
  return refreshBooking(bookingId, toMutation(await assignUnit(prisma, bookingId, unitId)));
}

export async function markPaymentInfoSentAction(bookingId: string): Promise<MutationResult> {
  await requireAdmin();
  return refreshBooking(bookingId, toMutation(await markPaymentInfoSent(prisma, bookingId)));
}

export async function createBlockAction(form: BlockForm): Promise<MutationResult> {
  await requireAdmin();
  const parsed = parseBlock(form);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const { note, ...rest } = parsed.value;
  const result = toMutation(await createBlock(prisma, { ...rest, note }));
  if (result.ok) {
    revalidatePath("/adminpanel/calendario");
    revalidatePath("/");
  }
  return result;
}

export async function deleteBlockAction(blockId: string): Promise<MutationResult> {
  await requireAdmin();
  const result = toMutation(await deleteBlock(prisma, blockId));
  if (result.ok) {
    revalidatePath("/adminpanel/calendario");
    revalidatePath("/");
  }
  return result;
}
