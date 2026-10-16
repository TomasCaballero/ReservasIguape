import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cron/tick/route";
import { runJobs } from "@/lib/cron/jobs";
import { prisma } from "@/lib/prisma";
import { localReceiptStorage } from "@/lib/storage/receipts";

const sync = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/ical/sync", async (original) => {
  const real = await original<typeof import("@/lib/ical/sync")>();
  return {
    ...real,
    syncAll: (...args: Parameters<typeof real.syncAll>) => {
      if (sync.fail) throw new Error("Juan Perez 1155551234");
      return real.syncAll(...args);
    },
  };
});

const SECRET = "test-cron-secret";
const before = process.env.CRON_SECRET;
const runsBefore = new Set<string>();
const call = (auth?: string) =>
  POST(new NextRequest("http://localhost/api/cron/tick", { method: "POST", headers: auth ? { authorization: auth } : {} }));

beforeAll(async () => {
  process.env.CRON_SECRET = SECRET;
  for (const r of await prisma.icalSyncRun.findMany({ select: { id: true } })) runsBefore.add(r.id);
});
afterAll(async () => {
  if (before === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = before;
  await prisma.icalSyncRun.deleteMany({ where: { id: { notIn: [...runsBefore] } } });
  await prisma.$disconnect();
});

describe("POST /api/cron/tick", () => {
  it("sin Bearer o con uno inválido → 401 sin datos (RF-66)", async () => {
    for (const auth of [undefined, "Bearer nope", SECRET]) {
      const res = await call(auth);
      expect(res.status).toBe(401);
      expect(await res.text()).toBe("");
    }
  });

  it("con el Bearer correcto corre todas las tareas", async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["expiry", "receipts", "softLocks", "sync", "throttles"]);
    for (const job of Object.values(body)) expect(job).toMatchObject({ ok: true });
  });

  it("si una tarea falla, las demás corren y el error no filtra datos", async () => {
    sync.fail = true;
    try {
      const summary = await runJobs(prisma, localReceiptStorage());
      expect(summary.sync).toEqual({ ok: false });
      expect(summary.expiry.ok && summary.receipts.ok && summary.softLocks.ok && summary.throttles.ok).toBe(true);
      expect(JSON.stringify(summary)).not.toMatch(/Juan|1155551234/);
    } finally {
      sync.fail = false;
    }
  });
});
