import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupReceipts, cleanupSoftLocks, cleanupThrottles } from "@/lib/cron/jobs";
import { prisma } from "@/lib/prisma";
import { localReceiptStorage } from "@/lib/storage/receipts";
import { createFixture } from "./helpers";

const fx = createFixture();
let dir: string;
let storage: ReturnType<typeof localReceiptStorage>;
let bookingId: string;
let cat: { id: string; unitIds: string[] };
const throttleKeys: string[] = [];

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "cleanup-"));
  storage = localReceiptStorage(dir);
  cat = await fx.category("cleanup", 2, 3);
  bookingId = (await fx.booking(cat, cat.unitIds[0], "2027-09-10", "2027-09-12", "CONFIRMED")).id;
});
afterAll(async () => {
  await prisma.loginThrottle.deleteMany({ where: { key: { in: throttleKeys } } });
  await fx.cleanup();
  await prisma.$disconnect();
  await rm(dir, { recursive: true, force: true });
});

async function payment(age: string) {
  const key = await storage.save(Buffer.from("%PDF-1.4 comprobante"), "pdf");
  const p = await prisma.payment.create({
    data: { bookingId, amount: 5000, currency: "ARS", method: "Transferencia", receiptPath: key },
  });
  await prisma.$executeRaw`UPDATE "Payment" SET "receiptUploadedAt" = now() - ${age}::interval WHERE "id" = ${p.id}::uuid`;
  return { id: p.id, key };
}

describe("cleanupReceipts", () => {
  it("a los 3 meses y 1 día borra el archivo y conserva los datos del cobro (AC-87)", async () => {
    const old = await payment("3 months 1 day");
    await cleanupReceipts(prisma, storage);
    await expect(readFile(path.join(dir, old.key))).rejects.toThrow();
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: old.id } });
    expect(row.receiptPath).toBeNull();
    expect(row.receiptUploadedAt).not.toBeNull();
    expect(Number(row.amount)).toBe(5000);
  });

  it("con menos de 3 meses no toca nada", async () => {
    const recent = await payment("2 months 29 days");
    await cleanupReceipts(prisma, storage);
    expect((await readFile(path.join(dir, recent.key))).length).toBeGreaterThan(0);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: recent.id } })).receiptPath).toBe(recent.key);
  });

  it("si el borrado falla, la fila queda para el próximo tick (D-13)", async () => {
    const stuck = await payment("4 months");
    const failing = { ...storage, remove: async () => Promise.reject(new Error("disco")) };
    await cleanupReceipts(prisma, failing);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: stuck.id } })).receiptPath).toBe(stuck.key);
    await cleanupReceipts(prisma, storage);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: stuck.id } })).receiptPath).toBeNull();
  });
});

describe("cleanupSoftLocks", () => {
  it("borra los vencidos y deja los vigentes (RNF-07)", async () => {
    const expired = await fx.softLock(cat, cat.unitIds[1], "2027-10-01", "2027-10-03", new Date(Date.now() - 1000));
    const live = await fx.softLock(cat, cat.unitIds[2], "2027-10-01", "2027-10-03", new Date(Date.now() + 600_000));
    await cleanupSoftLocks(prisma);
    expect(await prisma.softLock.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await prisma.unitOccupancy.count({ where: { softLockId: expired.id } })).toBe(0);
    expect(await prisma.softLock.findUnique({ where: { id: live.id } })).not.toBeNull();
  });
});

describe("cleanupThrottles", () => {
  it("borra los de más de 24 h sin bloqueo vigente (P-04)", async () => {
    const keys = [`${fx.tag}-old`, `${fx.tag}-locked`, `${fx.tag}-recent`];
    throttleKeys.push(...keys);
    for (const key of keys) await prisma.loginThrottle.create({ data: { kind: "EMAIL", key, failures: 3 } });
    await prisma.$executeRaw`UPDATE "LoginThrottle" SET "updatedAt" = now() - interval '25 hours' WHERE "key" = ${keys[0]}`;
    await prisma.$executeRaw`UPDATE "LoginThrottle" SET "updatedAt" = now() - interval '25 hours', "lockedUntil" = now() + interval '1 hour' WHERE "key" = ${keys[1]}`;
    await cleanupThrottles(prisma);
    const left = await prisma.loginThrottle.findMany({ where: { key: { in: keys } } });
    expect(left.map((t) => t.key).sort()).toEqual([keys[1], keys[2]].sort());
  });
});
