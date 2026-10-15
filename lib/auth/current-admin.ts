import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./session";

export type CurrentAdmin = { id: string; email: string };

/** Admin de la sesión actual, verificando que todavía exista; null si no hay sesión válida. */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const session = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const admin = await prisma.admin.findUnique({
    where: { id: session.adminId },
    select: { id: true, email: true },
  });
  return admin;
}

/** Para pantallas del panel: sin sesión redirige al login (AC-106). */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/adminpanel");
  return admin;
}

export async function startSession(adminId: string) {
  (await cookies()).set(SESSION_COOKIE, signSession(adminId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * IP del cliente para el bloqueo por IP. Se toma del primer valor de
 * X-Forwarded-For: en producción el servicio debe estar detrás de un proxy de
 * confianza que lo establezca, si no el encabezado puede falsificarse.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "local";
}
