import type { PrismaClient } from "@/app/generated/prisma/client";
import { isOverlapError, releaseExpiredLocks } from "@/lib/booking/claim";
import { todayInBuenosAires } from "@/lib/booking/dates";
import { parseIcal, type IcalEvent } from "./parse";

// Sincronización de feeds iCal externos (RF-65, 66, 67). Cada evento se importa como un
// bloqueo `ICAL` + su ocupación, identificado por UID (D-09). Un feed caído nunca libera fechas
// (RF-65) y no se guarda ni se loguea el SUMMARY: el parser ni siquiera lo lee (D-07).

type Db = PrismaClient;
export type FetchText = (url: string) => Promise<string>;

export type SyncSummary = {
  sources: number;
  added: number;
  updated: number;
  removed: number;
  conflicts: number;
  errors: number;
};

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;

export const defaultFetch: FetchText = async (url) => {
  if (!/^https?:\/\//i.test(url)) throw new Error("URL no permitida");
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`Respuesta HTTP ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error("El feed supera los 2 MB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const isUniqueError = (e: unknown) => (e as { code?: unknown } | null)?.code === "P2002";

function failure(error: unknown): string {
  const name = (error as { name?: string } | null)?.name;
  if (name === "TimeoutError" || name === "AbortError") return "Tiempo de espera agotado";
  return error instanceof Error ? error.message.slice(0, 200) : "Error desconocido";
}

type SourceRow = { id: string; unitId: string; url: string };
type Counters = Pick<SyncSummary, "added" | "updated" | "removed" | "conflicts">;

async function syncSource(db: Db, source: SourceRow, events: IcalEvent[], counters: Counters) {
  const existing = new Map(
    (await db.unitBlock.findMany({ where: { icalSourceId: source.id } })).map((b) => [b.externalUid, b]),
  );
  const seen = new Set<string>();

  for (const ev of events) {
    if (seen.has(ev.uid)) continue;
    seen.add(ev.uid);
    const start = new Date(ev.start);
    const end = new Date(ev.end);
    const current = existing.get(ev.uid);
    if (current && iso(current.startDate) === ev.start && iso(current.endDate) === ev.end) continue;

    try {
      await db.$transaction(async (tx) => {
        await releaseExpiredLocks(tx, source.unitId);
        if (current) {
          await tx.unitBlock.update({ where: { id: current.id }, data: { startDate: start, endDate: end } });
          await tx.unitOccupancy.update({ where: { blockId: current.id }, data: { startDate: start, endDate: end } });
        } else {
          const block = await tx.unitBlock.create({
            data: {
              unitId: source.unitId,
              startDate: start,
              endDate: end,
              kind: "ICAL",
              icalSourceId: source.id,
              externalUid: ev.uid,
            },
          });
          await tx.unitOccupancy.create({
            data: { unitId: source.unitId, startDate: start, endDate: end, blockId: block.id },
          });
        }
      });
      if (current) counters.updated++;
      else counters.added++;
    } catch (error) {
      if (isOverlapError(error)) counters.conflicts++; // D-10: no se importa; la reserva no se toca
      else if (!isUniqueError(error)) throw error; // P2002: otra corrida ya lo sincronizó
    }
  }

  for (const [uid, block] of existing) {
    if (uid && !seen.has(uid)) {
      await db.unitBlock.deleteMany({ where: { id: block.id } }); // la ocupación cae en cascada
      counters.removed++;
    }
  }
}

export async function syncAll(
  db: Db,
  trigger: "CRON" | "MANUAL",
  fetchText: FetchText = defaultFetch,
): Promise<SyncSummary & { runId: string; ok: boolean }> {
  const run = await db.icalSyncRun.create({ data: { trigger } });
  const totals: SyncSummary = { sources: 0, added: 0, updated: 0, removed: 0, conflicts: 0, errors: 0 };
  const sources = await db.icalSource.findMany({ select: { id: true, unitId: true, url: true } });
  totals.sources = sources.length;

  for (const source of sources) {
    try {
      const events = parseIcal(await fetchText(source.url), todayInBuenosAires());
      await syncSource(db, source, events, totals);
      await db.icalSource.update({ where: { id: source.id }, data: { lastSyncedAt: new Date(), lastError: null } });
    } catch (error) {
      totals.errors++;
      await db.icalSource
        .update({ where: { id: source.id }, data: { lastError: failure(error) } })
        .catch(() => undefined); // la fuente pudo borrarse durante la corrida
    }
  }

  const ok = totals.errors === 0;
  const summary =
    `fuentes: ${totals.sources}, altas: ${totals.added}, cambios: ${totals.updated}, ` +
    `bajas: ${totals.removed}, conflictos: ${totals.conflicts}, errores: ${totals.errors}`;
  await db.icalSyncRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok, summary } });
  return { ...totals, runId: run.id, ok };
}
