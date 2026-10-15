import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

// Toda la API administrativa vive bajo /api/admin y responde 401 sin datos si no
// hay sesión (AC-106). `proxy.ts` lo corta antes; esta verificación es la definitiva.
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "No autorizado" } },
      { status: 401 },
    );
  }
  return NextResponse.json({ email: admin.email }, { headers: { "Cache-Control": "no-store" } });
}
