import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

// Corte temprano (AC-106): sin sesión válida, la API administrativa responde 401 y
// las pantallas del panel vuelven al login. Es una primera barrera: cada pantalla y
// cada endpoint vuelven a verificar la sesión (`requireAdmin` / `getCurrentAdmin`).
export function proxy(request: NextRequest) {
  const valid = verifySession(request.cookies.get(SESSION_COOKIE)?.value) !== null;
  if (valid) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/admin")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "No autorizado" } },
      { status: 401 },
    );
  }
  return NextResponse.redirect(new URL("/adminpanel", request.url));
}

// `/adminpanel` (exacto) es el login y queda fuera: `:path+` exige al menos un tramo más.
export const config = {
  matcher: ["/api/admin/:path*", "/adminpanel/:path+"],
};
