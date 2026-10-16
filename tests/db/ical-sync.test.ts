import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findFreeUnitIds } from "@/lib/booking/availability";
import { addDays, todayInBuenosAires } from "@/lib/booking/dates";
import { syncAll } from "@/lib/ical/sync";
import { prisma } from "@/lib/prisma";
import { createFixture } from "./helpers";

const fx = createFixture();
const runIds: string[] = [];
const IN = addDays(todayInBuenosAires(), 60);
const OUT = addDays(IN, 2);
let cat: { id: string; unitIds: string[] };
let sourceId: string;

const compact = (d: string) => d.replaceAll("-", "");
const feed = (...events: { uid: string; start: string; end: string; summary?: string }[]) =>
  [
    "BEGIN:VCALENDAR",
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `SUMMARY:${e.summary ?? "Reserved"}`,
      `DTSTART;VALUE=DATE:${compact(e.start)}`,
      `DTEND;VALUE=DATE:${compact(e.end)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");

async function sync(text: string | Error, trigger: "CRON" | "MANUAL" = "MANUAL") {
  const result = await syncAll(prisma, trigger, async () => {
    if (text instanceof Error) throw text;
    return text;
  });
  runIds.push(result.runId);
  return result;
}
const blocks = () => prisma.unitBlock.findMany({ where: { icalSourceId: sourceId } });
const free = async () => (await findFreeUnitIds(prisma, { categoryId: cat.id, checkIn: IN, checkOut: OUT })).length;

beforeAll(async () => {
  cat = await fx.category("sync", 2, 1);
  sourceId = (await fx.icalSource(cat.unitIds[0])).id;
});
afterAll(async () => {
  await prisma.icalSyncRun.deleteMany({ where: { id: { in: runIds } } });
  await fx.cleanup();
  await prisma.$disconnect();
});

describe("syncAll", () => {
  it("importa el evento, bloquea la unidad y baja 1 la disponibilidad (AC-99)", async () => {
    expect(await free()).toBe(1);
    const r = await sync(feed({ uid: "e1", start: IN, end: OUT }));
    expect(r).toMatchObject({ ok: true, added: 1, conflicts: 0 });
    expect(await free()).toBe(0);
    const [block] = await blocks();
    expect(block).toMatchObject({ kind: "ICAL", externalUid: "e1", note: null });
  });

  it("un segundo sync no duplica y la fuente queda sin error (RF-66)", async () => {
    const r = await sync(feed({ uid: "e1", start: IN, end: OUT }), "CRON");
    expect(r).toMatchObject({ added: 0, updated: 0, removed: 0 });
    expect(await blocks()).toHaveLength(1);
    const source = await prisma.icalSource.findUniqueOrThrow({ where: { id: sourceId } });
    expect(source.lastSyncedAt).not.toBeNull();
    expect(source.lastError).toBeNull();
  });

  it("un cambio de fechas actualiza el bloqueo y su ocupación", async () => {
    const out3 = addDays(IN, 3);
    const r = await sync(feed({ uid: "e1", start: IN, end: out3 }));
    expect(r.updated).toBe(1);
    const occ = await prisma.unitOccupancy.findMany({ where: { block: { icalSourceId: sourceId } } });
    expect(occ[0].endDate.toISOString().slice(0, 10)).toBe(out3);
  });

  it("un feed caído conserva los bloqueos y deja lastError (RF-65)", async () => {
    const r = await sync(new Error("boom"));
    expect(r.ok).toBe(false);
    expect(await blocks()).toHaveLength(1);
    expect(await free()).toBe(0);
    const source = await prisma.icalSource.findUniqueOrThrow({ where: { id: sourceId } });
    expect(source.lastError).toBe("boom");
  });

  it("una baja del evento libera las fechas", async () => {
    const r = await sync(feed());
    expect(r.removed).toBe(1);
    expect(await blocks()).toHaveLength(0);
    expect(await free()).toBe(1);
    const source = await prisma.icalSource.findUniqueOrThrow({ where: { id: sourceId } });
    expect(source.lastError).toBeNull();
  });

  it("un evento que choca con una reserva no se importa y la reserva queda (D-10 / P-01)", async () => {
    const booking = await fx.booking(cat, cat.unitIds[0], IN, OUT, "CONFIRMED");
    const r = await sync(feed({ uid: "c1", start: IN, end: OUT }));
    expect(r).toMatchObject({ ok: true, added: 0, conflicts: 1 });
    expect(await blocks()).toHaveLength(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CONFIRMED");
    expect((await prisma.icalSyncRun.findUniqueOrThrow({ where: { id: r.runId } })).summary).toContain("conflictos: 1");
  });

  it("cada corrida deja una fila con su disparador y sin datos personales (AC-100, AC-101)", async () => {
    const r = await sync(feed({ uid: "s1", start: addDays(IN, 20), end: addDays(IN, 22), summary: "Juan Perez 1155551234" }), "MANUAL");
    const run = await prisma.icalSyncRun.findUniqueOrThrow({ where: { id: r.runId } });
    expect(run).toMatchObject({ trigger: "MANUAL", ok: true });
    expect(run.finishedAt).not.toBeNull();
    expect(JSON.stringify(run)).not.toMatch(/Juan|1155551234/);
    expect(JSON.stringify(await blocks())).not.toMatch(/Juan|1155551234/);
    expect(await prisma.icalSyncRun.count({ where: { id: { in: runIds } } })).toBe(runIds.length);
  });
});
