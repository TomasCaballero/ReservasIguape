import type { PrismaClient } from "@/app/generated/prisma/client";
import { findFreeUnitIds } from "./availability";
import { findOwnLockUnit, isOverlapError, releaseExpiredLocks } from "./claim";
import { todayInBuenosAires, type ISODate } from "./dates";
import {
  normalizeDocument,
  validateCompanions,
  validateHolder,
  type CompanionInput,
  type FieldErrors,
  type HolderInput,
} from "./guest-validation";
import type { Currency } from "./pricing";
import { loadPricingContext, quoteForCategory } from "./quote";
import { validateGuests, validateStayDates } from "./stay-rules";

export const UNAVAILABLE_MESSAGE = "Las fechas seleccionadas ya no están disponibles";

export type CreateBookingInput = {
  categorySlug: string;
  checkIn: ISODate;
  checkOut: ISODate;
  adults: number;
  children: number;
  currency: Currency;
  holder: HolderInput;
  companions: CompanionInput[];
  /** Token del soft lock tomado al entrar al formulario (RF-25). */
  softLockToken?: string;
};

type ApiError = { code: string; message: string };

export type CreateBookingResult =
  | { ok: true; created: boolean; booking: { id: string; reference: string } }
  | { ok: false; status: 400; error: ApiError }
  | { ok: false; status: 400; errors: FieldErrors }
  | { ok: false; status: 404; error: ApiError }
  | { ok: false; status: 409; error: ApiError };

const referenceOf = (id: string) => id.slice(0, 8).toUpperCase();
const success = (id: string, created: boolean): CreateBookingResult => ({
  ok: true,
  created,
  booking: { id, reference: referenceOf(id) },
});
const unavailable: CreateBookingResult = {
  ok: false,
  status: 409,
  error: { code: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE },
};

/**
 * RF-28, RF-29, RF-27: crea la reserva Pendiente con origen Web Directa.
 *
 * El precio se recalcula siempre en el servidor. Se ocupa una unidad concreta
 * (primero la del propio soft lock, si sigue vigente; si venció se intenta
 * renovar con cualquier unidad libre). Si ninguna se puede ocupar: HTTP 409 y el
 * formulario conserva sus datos (AC-40, AC-41). La unidad es provisoria: la
 * reserva queda "sin asignar" hasta que el administrador la asigne (AC-42).
 */
export async function createBooking(
  prisma: PrismaClient,
  input: CreateBookingInput,
  now: Date = new Date(),
): Promise<CreateBookingResult> {
  const today = todayInBuenosAires(now);
  const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });

  const stayError =
    validateGuests(input.adults) ??
    validateStayDates(input.checkIn, input.checkOut, today, settings);
  if (stayError) return { ok: false, status: 400, error: stayError };

  const fieldErrors = {
    ...validateHolder(input.holder, today),
    ...validateCompanions(input.companions, today),
  };
  if (Object.keys(fieldErrors).length > 0) return { ok: false, status: 400, errors: fieldErrors };

  const category = await prisma.category.findUnique({ where: { slug: input.categorySlug } });
  if (!category) {
    return {
      ok: false,
      status: 404,
      error: { code: "CATEGORY_NOT_FOUND", message: "La categoría no existe" },
    };
  }

  const guests = input.adults + input.children;
  if (guests > category.maxCapacity) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "CAPACITY",
        message: `Esta categoría admite hasta ${category.maxCapacity} huéspedes`,
      },
    };
  }
  if (input.companions.length > guests - 1) {
    return {
      ok: false,
      status: 400,
      error: { code: "COMPANIONS", message: "Hay más acompañantes que huéspedes" },
    };
  }

  const context = await loadPricingContext(prisma, input.checkIn, input.checkOut);
  const quote = quoteForCategory(category, context, input);
  if (quote.minStayError) {
    return { ok: false, status: 400, error: { code: "MIN_STAY", message: quote.minStayError } };
  }

  // Idempotencia: un reintento con el mismo token devuelve la reserva ya creada.
  const token = input.softLockToken;
  if (token) {
    const existing = await prisma.booking.findUnique({ where: { requestToken: token } });
    if (existing) return success(existing.id, false);
  }

  const ownUnit = token
    ? await findOwnLockUnit(prisma, { token, categoryId: category.id, ...input })
    : null;
  const free = await findFreeUnitIds(prisma, { categoryId: category.id, ...input });
  const candidates = [...(ownUnit ? [ownUnit] : []), ...free.filter((id) => id !== ownUnit)];

  const documentNumber = normalizeDocument(input.holder.documentType, input.holder.documentNumber);
  const phone = `${input.holder.phonePrefix} ${input.holder.phoneNumber.trim()}`;

  for (const unitId of candidates) {
    try {
      const booking = await prisma.$transaction(async (tx) => {
        // Cliente por documento; solo email y teléfono se pisan con los de la última reserva (RF-58).
        const customer = await tx.customer.upsert({
          where: {
            documentType_documentNumber: {
              documentType: input.holder.documentType,
              documentNumber,
            },
          },
          update: { email: input.holder.email.trim(), phone },
          create: {
            documentType: input.holder.documentType,
            documentNumber,
            firstName: input.holder.firstName.trim(),
            lastName: input.holder.lastName.trim(),
            email: input.holder.email.trim(),
            phone,
            birthDate: new Date(input.holder.birthDate),
          },
        });

        // Se libera el soft lock propio (queda consumido por la reserva) y los vencidos de la unidad.
        await releaseExpiredLocks(tx, unitId, token);

        const created = await tx.booking.create({
          data: {
            customerId: customer.id,
            categoryId: category.id,
            categoryName: category.name,
            unitId,
            unitAssigned: false,
            checkIn: new Date(input.checkIn),
            checkOut: new Date(input.checkOut),
            adults: input.adults,
            children: input.children,
            status: "PENDING",
            source: "WEB_DIRECT",
            currency: input.currency,
            subtotal: quote.subtotal,
            discountPercent: quote.discountPercent,
            total: quote.total,
            requestToken: token ?? null,
            guests: {
              create: input.companions.map((c) => ({
                firstName: c.firstName.trim(),
                lastName: c.lastName.trim(),
                documentNumber: c.documentNumber.trim(),
                birthDate: new Date(c.birthDate),
              })),
            },
          },
        });
        await tx.unitOccupancy.create({
          data: {
            unitId,
            startDate: new Date(input.checkIn),
            endDate: new Date(input.checkOut),
            bookingId: created.id,
          },
        });
        return created;
      });
      return success(booking.id, true);
    } catch (error) {
      if (isOverlapError(error)) continue; // otro la ocupó primero: se prueba con la siguiente
      if (token && isUniqueTokenError(error)) {
        // Dos envíos simultáneos con el mismo token: gana uno y el otro devuelve esa reserva.
        const existing = await prisma.booking.findUnique({ where: { requestToken: token } });
        if (existing) return success(existing.id, false);
      }
      throw error;
    }
  }
  return unavailable;
}

function isUniqueTokenError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002" &&
    JSON.stringify((error as { meta?: unknown }).meta ?? {}).includes("requestToken")
  );
}
