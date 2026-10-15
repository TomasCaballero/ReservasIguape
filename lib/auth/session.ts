import { createHmac, timingSafeEqual } from "node:crypto";

// Sesión del administrador: cookie firmada con HMAC-SHA256 (sin Supabase Auth).
// Formato: base64url(JSON {sub, exp}) + "." + firma. Solo usa node:crypto, así que
// puede importarse desde `proxy.ts` y desde los tests.

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 horas

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  }
  return Buffer.from(secret);
}

const sign = (payload: string) => createHmac("sha256", key()).update(payload).digest("base64url");

export function signSession(adminId: string, nowMs: number = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: adminId, exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Devuelve el id del admin si el token es auténtico y no venció; si no, null. */
export function verifySession(
  token: string | undefined,
  nowMs: number = Date.now(),
): { adminId: string } | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      sub?: unknown;
      exp?: unknown;
    };
    if (typeof data.sub !== "string" || typeof data.exp !== "number") return null;
    if (data.exp * 1000 <= nowMs) return null;
    return { adminId: data.sub };
  } catch {
    return null;
  }
}
