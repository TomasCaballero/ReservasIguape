import type { PrismaClient } from "@/app/generated/prisma/client";
import type { ActionResult } from "@/lib/admin/bookings";
import type { ISODate } from "@/lib/booking/dates";

// CRM del panel: clientes, historial y anonimización (RF-57, RF-59, RF-61, RF-62).
// Nada de esto se loguea: son datos personales (AGENTS.md §8).

type Db = PrismaClient;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const MAX_ROWS = 200;

const fail = (code: string, message: string, httpStatus: 404 | 409): ActionResult => ({
  ok: false,
  code,
  message,
  httpStatus,
});

export type CustomerRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentType: "DNI" | "PASSPORT";
  documentNumber: string;
  birthDate: ISODate;
  anonymized: boolean;
};

/** AC-88: los seis datos del cliente. Busca por nombre, apellido o documento. */
export async function listCustomers(db: Db, q?: string): Promise<CustomerRow[]> {
  const term = q?.trim();
  const rows = await db.customer.findMany({
    where: term
      ? {
          OR: [
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
            { documentNumber: { contains: term, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: MAX_ROWS,
  });
  return rows.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    documentType: c.documentType,
    documentNumber: c.documentNumber,
    birthDate: iso(c.birthDate),
    anonymized: c.anonymizedAt !== null,
  }));
}

export type CustomerBooking = {
  id: string;
  reference: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "FINISHED";
  categoryName: string;
  checkIn: ISODate;
  checkOut: ISODate;
  total: number;
  currency: "ARS" | "USD";
};

export type CustomerDetail = CustomerRow & {
  updatedAt: Date; // P-10: el email y el teléfono se pisan con la última reserva
  bookings: CustomerBooking[];
  request: { requestedAt: Date; completedAt: Date | null } | null;
  activeBookings: number; // Pendiente/Confirmada con check-out futuro (P-09)
};

/** RF-59: datos + todas las reservas, recientes primero (P-11) + la última solicitud (AC-95). */
export async function getCustomer(db: Db, id: string, today: ISODate): Promise<CustomerDetail | null> {
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      bookings: { orderBy: [{ checkIn: "desc" }, { createdAt: "desc" }] },
      anonymizationRequests: { orderBy: { requestedAt: "desc" }, take: 1 },
    },
  });
  if (!c) return null;
  const bookings = c.bookings.map((b) => ({
    id: b.id,
    reference: b.id.slice(0, 8).toUpperCase(),
    status: b.status,
    categoryName: b.categoryName,
    checkIn: iso(b.checkIn),
    checkOut: iso(b.checkOut),
    total: Number(b.total),
    currency: b.currency,
  }));
  const request = c.anonymizationRequests[0];
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    documentType: c.documentType,
    documentNumber: c.documentNumber,
    birthDate: iso(c.birthDate),
    anonymized: c.anonymizedAt !== null,
    updatedAt: c.updatedAt,
    bookings,
    request: request ? { requestedAt: request.requestedAt, completedAt: request.completedAt } : null,
    activeBookings: bookings.filter(
      (b) => (b.status === "PENDING" || b.status === "CONFIRMED") && b.checkOut > today,
    ).length,
  };
}

export type RequestRow = {
  id: string;
  customerId: string;
  customerName: string;
  requestedAt: Date;
  completedAt: Date | null;
  overdue: boolean;
};

/** RF-61, RNF-08: pendientes primero; `overdue` se calcula en SQL con la hora de la base (D-06, AC-97). */
export async function listAnonymizationRequests(db: Db): Promise<RequestRow[]> {
  const rows = await db.$queryRaw<
    {
      id: string;
      customerId: string;
      firstName: string;
      lastName: string;
      requestedAt: Date;
      completedAt: Date | null;
      overdue: boolean;
    }[]
  >`
    SELECT r."id", r."customerId", c."firstName", c."lastName", r."requestedAt", r."completedAt",
           (r."completedAt" IS NULL
             AND r."requestedAt" <= now() - make_interval(days => s."anonymizationDays")) AS overdue
    FROM "AnonymizationRequest" r
    JOIN "Customer" c ON c."id" = r."customerId"
    CROSS JOIN "SystemSettings" s
    WHERE s."id" = 1
    ORDER BY (r."completedAt" IS NULL) DESC, r."requestedAt" ASC
    LIMIT ${MAX_ROWS}`;
  return rows.map((r) => ({
    id: r.id,
    customerId: r.customerId,
    customerName: `${r.firstName} ${r.lastName}`,
    requestedAt: r.requestedAt,
    completedAt: r.completedAt,
    overdue: r.overdue,
  }));
}

const PENDING_INDEX = /AnonymizationRequest_one_pending|23505/;

function isDuplicatePending(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const e = current as { message?: unknown; code?: unknown; cause?: unknown; meta?: unknown };
    if (e.code === "23505") return true;
    if (typeof e.message === "string" && PENDING_INDEX.test(e.message)) return true;
    if (e.meta && PENDING_INDEX.test(JSON.stringify(e.meta))) return true;
    current = e.cause;
  }
  return false;
}

const ANONYMIZED_MSG = "El cliente ya está anonimizado";

/** RF-61: registra la solicitud con la hora de la base. 409 si ya está anonimizado o ya hay una pendiente (D-04). */
export async function requestAnonymization(db: Db, customerId: string): Promise<ActionResult> {
  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { anonymizedAt: true } });
  if (!customer) return fail("NOT_FOUND", "El cliente no existe", 404);
  if (customer.anonymizedAt) return fail("ALREADY_ANONYMIZED", ANONYMIZED_MSG, 409);

  try {
    await db.$executeRaw`
      INSERT INTO "AnonymizationRequest" ("id", "customerId", "requestedAt")
      VALUES (gen_random_uuid(), ${customerId}::uuid, now())`;
    return { ok: true };
  } catch (error) {
    if (isDuplicatePending(error)) return fail("ALREADY_PENDING", "Ya hay una solicitud pendiente", 409);
    throw error;
  }
}

/**
 * RF-62, D-03: reemplaza los datos personales del cliente y de sus acompañantes por valores fijos,
 * completa la solicitud pendiente y marca `anonymizedAt`, todo en una transacción. Se conservan
 * reservas, fechas, montos y cobros (D-05, AC-96).
 */
export async function anonymizeCustomer(db: Db, customerId: string): Promise<ActionResult> {
  return db.$transaction(async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE "Customer"
      SET "documentNumber" = 'ANON-' || "id"::text, "firstName" = 'Anonimizado', "lastName" = 'Anonimizado',
          "email" = 'anonimizado@anonimizado.invalid', "phone" = '-', "birthDate" = DATE '1900-01-01',
          "anonymizedAt" = now(), "updatedAt" = now()
      WHERE "id" = ${customerId}::uuid AND "anonymizedAt" IS NULL`;
    if (updated === 0) {
      const exists = await tx.customer.findUnique({ where: { id: customerId }, select: { id: true } });
      return exists ? fail("ALREADY_ANONYMIZED", ANONYMIZED_MSG, 409) : fail("NOT_FOUND", "El cliente no existe", 404);
    }
    await tx.$executeRaw`
      UPDATE "Guest"
      SET "firstName" = 'Anonimizado', "lastName" = 'Anonimizado', "documentNumber" = 'ANON-' || "id"::text,
          "birthDate" = DATE '1900-01-01'
      WHERE "bookingId" IN (SELECT "id" FROM "Booking" WHERE "customerId" = ${customerId}::uuid)`;
    await tx.$executeRaw`
      UPDATE "AnonymizationRequest" SET "completedAt" = now()
      WHERE "customerId" = ${customerId}::uuid AND "completedAt" IS NULL`;
    return { ok: true } as const;
  });
}
