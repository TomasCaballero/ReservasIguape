import { NextResponse, type NextRequest } from "next/server";
import { createBooking, type CreateBookingInput } from "@/lib/booking/create-booking";
import { prisma } from "@/lib/prisma";

// RF-28, RF-29: la reserva nace Pendiente con origen Web Directa. La respuesta
// solo trae una referencia corta: nunca datos de huéspedes (AC-107).

const str = (v: unknown) => (typeof v === "string" ? v : "");
const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : NaN);

function parse(body: Record<string, unknown>): CreateBookingInput | null {
  const holder = body.holder as Record<string, unknown> | undefined;
  const companions = body.companions;
  const currency = body.currency;
  if (!holder || typeof holder !== "object") return null;
  if (!Array.isArray(companions) || companions.length > 20) return null;
  if (currency !== "ARS" && currency !== "USD") return null;
  const adults = int(body.adults);
  const children = int(body.children);
  if (Number.isNaN(adults) || Number.isNaN(children)) return null;

  return {
    categorySlug: str(body.categorySlug),
    checkIn: str(body.checkIn),
    checkOut: str(body.checkOut),
    adults,
    children,
    currency,
    holder: {
      firstName: str(holder.firstName),
      lastName: str(holder.lastName),
      email: str(holder.email),
      phonePrefix: str(holder.phonePrefix),
      phoneNumber: str(holder.phoneNumber),
      documentType: holder.documentType === "PASSPORT" ? "PASSPORT" : holder.documentType === "DNI" ? "DNI" : ("" as "DNI"),
      documentNumber: str(holder.documentNumber),
      birthDate: str(holder.birthDate),
    },
    companions: companions.map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        firstName: str(o.firstName),
        lastName: str(o.lastName),
        documentNumber: str(o.documentNumber),
        birthDate: str(o.birthDate),
      };
    }),
    softLockToken: str(body.softLockToken) || undefined,
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const input = body ? parse(body) : null;
  if (!input) {
    return NextResponse.json(
      { error: { code: "INVALID_PARAMS", message: "Solicitud inválida" } },
      { status: 400 },
    );
  }

  const result = await createBooking(prisma, input);
  if (!result.ok) {
    const { ok, status, ...payload } = result;
    void ok;
    return NextResponse.json(payload, { status });
  }
  return NextResponse.json(
    { reference: result.booking.reference },
    { status: result.created ? 201 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
