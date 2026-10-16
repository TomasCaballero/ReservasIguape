import type { PrismaClient } from "@/app/generated/prisma/client";
import type { ISODate } from "@/lib/booking/dates";

// Feed iCal de una unidad (RF-63). Solo fechas ocupadas: ningún dato de huésped ni de cliente
// llega acá (RNF-06, AC-98). Fin exclusivo, igual que un check-out.

export type FeedEvent = { uid: string; start: ISODate; end: ISODate };

const compact = (d: ISODate) => d.replaceAll("-", "");
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function buildFeed(unitName: string, events: FeedEvent[], now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const name = unitName.replace(/[\;,\r\n]/g, " ");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Iguape Aparts//Reservas//ES",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${name}`,
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.start)}`,
      `DTEND;VALUE=DATE:${compact(e.end)}`,
      "SUMMARY:Ocupado",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/**
 * Reservas Pendiente/Confirmada y bloqueos manuales. Sin soft locks, y sin bloqueos importados
 * de otras OTAs para no generar eco (P-02).
 */
export async function loadFeedEvents(db: PrismaClient, unitId: string): Promise<FeedEvent[]> {
  const rows = await db.unitOccupancy.findMany({
    where: {
      unitId,
      OR: [
        { booking: { status: { in: ["PENDING", "CONFIRMED"] } } },
        { block: { kind: { in: ["MAINTENANCE", "OWNER"] } } },
      ],
    },
    orderBy: { startDate: "asc" },
    select: { id: true, startDate: true, endDate: true },
  });
  return rows.map((r) => ({ uid: `${r.id}@iguape`, start: iso(r.startDate), end: iso(r.endDate) }));
}
