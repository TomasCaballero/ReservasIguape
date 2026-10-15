import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchStays } from "@/lib/booking/search";
import { isValidISODate } from "@/lib/booking/dates";

// Endpoint público: devuelve solo categorías, disponibilidad y precios.
// Nunca datos de reservas ni de huéspedes (AC-107).

const int = (value: string | null, max: number): number | null => {
  if (value === null || !/^\d{1,3}$/.test(value)) return null;
  const n = Number(value);
  return n <= max ? n : null;
};

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const checkIn = p.get("checkin") ?? "";
  const checkOut = p.get("checkout") ?? "";
  const adults = int(p.get("adults"), 50);
  const children = int(p.get("children"), 50);
  const currency = p.get("currency");

  if (
    !isValidISODate(checkIn) ||
    !isValidISODate(checkOut) ||
    adults === null ||
    children === null ||
    (currency !== "ARS" && currency !== "USD")
  ) {
    return NextResponse.json(
      { error: { code: "INVALID_PARAMS", message: "Parámetros de búsqueda inválidos" } },
      { status: 400 },
    );
  }

  const result = await searchStays(prisma, { checkIn, checkOut, adults, children, currency });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
