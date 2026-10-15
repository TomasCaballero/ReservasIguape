import { NextResponse, type NextRequest } from "next/server";
import { releaseSoftLock, takeSoftLock } from "@/lib/booking/claim";
import { isValidISODate, todayInBuenosAires } from "@/lib/booking/dates";
import { validateGuests, validateStayDates } from "@/lib/booking/stay-rules";
import { prisma } from "@/lib/prisma";

// RF-25: bloqueo temporal de una unidad al entrar al formulario de huéspedes.
// No se devuelve qué unidad es: el cliente solo recibe un token opaco.

const bad = (code: string, message: string, status = 400) =>
  NextResponse.json({ error: { code, message } }, { status });

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const slug = typeof body?.categorySlug === "string" ? body.categorySlug : "";
  const checkIn = typeof body?.checkIn === "string" ? body.checkIn : "";
  const checkOut = typeof body?.checkOut === "string" ? body.checkOut : "";
  const adults = Number(body?.adults);
  const children = Number(body?.children ?? 0);
  const previousToken = typeof body?.previousToken === "string" ? body.previousToken : undefined;

  if (!slug || !isValidISODate(checkIn) || !isValidISODate(checkOut) || !Number.isInteger(adults) || !Number.isInteger(children)) {
    return bad("INVALID_PARAMS", "Parámetros inválidos");
  }

  const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
  const stayError =
    validateGuests(adults) ?? validateStayDates(checkIn, checkOut, todayInBuenosAires(), settings);
  if (stayError) return NextResponse.json({ error: stayError }, { status: 400 });

  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) return bad("CATEGORY_NOT_FOUND", "La categoría no existe", 404);
  if (adults + children > category.maxCapacity) {
    return bad("CAPACITY", `Esta categoría admite hasta ${category.maxCapacity} huéspedes`);
  }

  const lock = await takeSoftLock(prisma, { categoryId: category.id, checkIn, checkOut, previousToken });
  if (!lock) return bad("UNAVAILABLE", "Las fechas seleccionadas ya no están disponibles", 409);

  return NextResponse.json(
    { token: lock.token, expiresAt: lock.expiresAt.toISOString() },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

/** Libera el soft lock (el usuario vuelve a la búsqueda). */
export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  if (typeof body?.token === "string") await releaseSoftLock(prisma, body.token);
  return new NextResponse(null, { status: 204 });
}
