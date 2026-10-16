import type { PrismaClient } from "@/app/generated/prisma/client";
import { expirePendingBookings } from "@/lib/admin/expiry";
import { syncAll } from "@/lib/ical/sync";
import type { ReceiptStorage } from "@/lib/storage/receipts";

// Tareas programadas que dispara POST /api/cron/tick (D-11). Los resúmenes solo llevan
// cantidades: nunca datos de huéspedes.

type Db = PrismaClient;

/** RF-56: borra el archivo de los comprobantes de más de 3 meses y conserva los datos del cobro. */
export async function cleanupReceipts(db: Db, storage: ReceiptStorage): Promise<number> {
  const rows = await db.$queryRaw<{ id: string; receiptPath: string }[]>`
    SELECT "id", "receiptPath" FROM "Payment"
    WHERE "receiptPath" IS NOT NULL AND "receiptUploadedAt" <= now() - interval '3 months'`;
  let removed = 0;
  for (const row of rows) {
    try {
      await storage.remove(row.receiptPath); // primero el archivo (D-13)
      await db.payment.update({ where: { id: row.id }, data: { receiptPath: null } });
      removed++;
    } catch {
      // queda la fila: se reintenta en el próximo tick
    }
  }
  return removed;
}

/** RNF-07: soft locks vencidos (su ocupación cae en cascada). */
export async function cleanupSoftLocks(db: Db): Promise<number> {
  return db.$executeRaw`DELETE FROM "SoftLock" WHERE "expiresAt" <= now()`;
}

/** P-04: throttles de login de más de 24 h sin bloqueo vigente. */
export async function cleanupThrottles(db: Db): Promise<number> {
  return db.$executeRaw`
    DELETE FROM "LoginThrottle"
    WHERE "updatedAt" < now() - interval '24 hours'
      AND ("lockedUntil" IS NULL OR "lockedUntil" <= now())`;
}

export type JobResult = { ok: true; detail: string } | { ok: false };
export type JobsSummary = Record<string, JobResult>;

async function guarded(run: () => Promise<string>): Promise<JobResult> {
  try {
    return { ok: true, detail: await run() };
  } catch {
    return { ok: false }; // sin mensaje: podría arrastrar datos personales
  }
}

/** Corre todas las tareas; si una falla, las demás siguen. */
export async function runJobs(db: Db, storage: ReceiptStorage): Promise<JobsSummary> {
  return {
    sync: await guarded(async () => (await syncAll(db, "CRON")).ok ? "ok" : "con errores"),
    expiry: await guarded(async () => `${await expirePendingBookings(db)} vencidas`),
    receipts: await guarded(async () => `${await cleanupReceipts(db, storage)} borrados`),
    softLocks: await guarded(async () => `${await cleanupSoftLocks(db)} liberados`),
    throttles: await guarded(async () => `${await cleanupThrottles(db)} borrados`),
  };
}
