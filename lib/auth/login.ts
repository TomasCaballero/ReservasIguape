import type { PrismaClient } from "@/app/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";

// RF-32: 3 intentos fallidos bloquean el login por 15 minutos, de forma
// independiente por IP y por email. El contador se incrementa ANTES de verificar la
// contraseña (de forma atómica), así que intentos en paralelo no pueden superar el
// máximo. Los tiempos son los de la base de datos.

export const MAX_ATTEMPTS = 3;
export const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; adminId: string }
  | { ok: false; reason: "INVALID" | "LOCKED" };

type Db = Pick<PrismaClient, "$queryRaw" | "$executeRaw" | "admin">;
type Key = { kind: "IP" | "EMAIL"; key: string };

/** Registra el intento y devuelve cuántos lleva la clave en la ventana actual. */
async function registerAttempt(db: Db, { kind, key }: Key): Promise<number> {
  const rows = await db.$queryRaw<{ failures: number }[]>`
    INSERT INTO "LoginThrottle" AS t ("kind", "key", "failures", "lockedUntil", "updatedAt")
    VALUES (${kind}::"ThrottleKind", ${key}, 1, NULL, now())
    ON CONFLICT ("kind", "key") DO UPDATE SET
      "failures" = CASE
        WHEN t."lockedUntil" IS NOT NULL AND t."lockedUntil" <= now() THEN 1
        ELSE t."failures" + 1 END,
      "lockedUntil" = CASE
        WHEN t."lockedUntil" > now() THEN t."lockedUntil"
        WHEN (CASE WHEN t."lockedUntil" IS NOT NULL THEN 1 ELSE t."failures" + 1 END) >= ${MAX_ATTEMPTS}::int
          THEN now() + make_interval(mins => ${LOCK_MINUTES}::int)
        ELSE NULL END,
      "updatedAt" = now()
    RETURNING "failures"`;
  return rows[0].failures;
}

/** Login correcto: el email vuelve a cero y la IP descuenta solo este intento. */
async function registerSuccess(db: Db, ip: Key, email: Key) {
  await db.$executeRaw`DELETE FROM "LoginThrottle" WHERE "kind" = 'EMAIL'::"ThrottleKind" AND "key" = ${email.key}`;
  await db.$executeRaw`
    UPDATE "LoginThrottle" SET
      "failures" = GREATEST("failures" - 1, 0),
      "lockedUntil" = CASE WHEN "failures" - 1 < ${MAX_ATTEMPTS}::int THEN NULL ELSE "lockedUntil" END
    WHERE "kind" = 'IP'::"ThrottleKind" AND "key" = ${ip.key}`;
}

// Hash de relleno: se verifica igual cuando el email no existe, para no revelar por
// tiempo de respuesta qué emails están registrados.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("relleno-sin-uso"));

export async function attemptLogin(
  db: Db,
  input: { email: string; password: string; ip: string },
): Promise<LoginResult> {
  const emailKey = input.email.trim().toLowerCase().slice(0, 254);
  const ip: Key = { kind: "IP", key: input.ip.slice(0, 64) || "desconocida" };
  const email: Key = { kind: "EMAIL", key: emailKey };

  const [ipAttempts, emailAttempts] = await Promise.all([
    registerAttempt(db, ip),
    registerAttempt(db, email),
  ]);
  if (ipAttempts > MAX_ATTEMPTS || emailAttempts > MAX_ATTEMPTS) {
    return { ok: false, reason: "LOCKED" };
  }

  const admin = await db.admin.findFirst({
    where: { email: { equals: emailKey, mode: "insensitive" } },
  });
  const valid = admin
    ? await verifyPassword(admin.passwordHash, input.password)
    : (await verifyPassword(await getDummyHash(), input.password), false);

  if (!admin || !valid) return { ok: false, reason: "INVALID" };
  await registerSuccess(db, ip, email);
  return { ok: true, adminId: admin.id };
}
