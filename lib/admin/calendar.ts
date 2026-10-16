import type { PrismaClient } from "@/app/generated/prisma/client";
import { addDays, addMonths, todayInBuenosAires, type ISODate } from "@/lib/booking/dates";

// Calendario de ocupación por unidad física (RF-47). Noches ocupadas = [inicio, fin):
// una reserva del 10 al 14 ocupa las noches 10, 11, 12 y 13 y deja libre el 14 (AC-66).

export type CalendarEntry =
  | {
      kind: "booking";
      bookingId: string;
      reference: string;
      status: "PENDING" | "CONFIRMED";
      holderName: string;
      /** Sin unidad asignada por el admin: ocupa una unidad provisoria (AC-42). */
      unassigned: boolean;
      start: ISODate;
      end: ISODate;
    }
  | {
      kind: "block";
      blockId: string;
      blockKind: "MAINTENANCE" | "OWNER" | "ICAL";
      note: string | null;
      start: ISODate;
      end: ISODate;
    }
  | { kind: "lock"; start: ISODate; end: ISODate };

export type CalendarRow = {
  unitId: string;
  unitName: string;
  categoryName: string;
  entries: CalendarEntry[];
};

export type MonthCalendar = {
  month: string; // AAAA-MM
  days: ISODate[];
  previous: string;
  next: string;
  rows: CalendarRow[];
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** `?mes=AAAA-MM`; si falta o es inválido, el mes actual en Buenos Aires. */
export function parseMonth(value: string | undefined, today: ISODate = todayInBuenosAires()): string {
  return value && MONTH.test(value) ? value : today.slice(0, 7);
}

export function monthDays(month: string): ISODate[] {
  const first = `${month}-01`;
  const count = Number(addDays(addMonths(first, 1), -1).slice(8, 10));
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

/** ¿La entrada ocupa esa noche? */
export const occupiesNight = (entry: { start: ISODate; end: ISODate }, day: ISODate) =>
  entry.start <= day && day < entry.end;

export async function getMonthCalendar(db: PrismaClient, month: string): Promise<MonthCalendar> {
  const first = `${month}-01`;
  const nextFirst = addMonths(first, 1);

  const units = await db.unit.findMany({
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    include: {
      category: { select: { name: true } },
      occupancies: {
        where: { startDate: { lt: new Date(nextFirst) }, endDate: { gt: new Date(first) } },
        include: {
          booking: { include: { customer: { select: { firstName: true, lastName: true } } } },
          block: true,
          softLock: true,
        },
      },
    },
  });

  const now = new Date();
  const rows = units.map((unit): CalendarRow => {
    const entries: CalendarEntry[] = [];
    for (const o of unit.occupancies) {
      const start = iso(o.startDate);
      const end = iso(o.endDate);
      if (o.booking) {
        entries.push({
          kind: "booking",
          bookingId: o.booking.id,
          reference: o.booking.id.slice(0, 8).toUpperCase(),
          status: o.booking.status as "PENDING" | "CONFIRMED",
          holderName: `${o.booking.customer.firstName} ${o.booking.customer.lastName}`,
          unassigned: !o.booking.unitAssigned,
          start,
          end,
        });
      } else if (o.block) {
        entries.push({
          kind: "block",
          blockId: o.block.id,
          blockKind: o.block.kind,
          note: o.block.note,
          start,
          end,
        });
      } else if (o.softLock && o.softLock.expiresAt > now) {
        entries.push({ kind: "lock", start, end }); // reserva en curso: bloqueo temporal
      }
    }
    return { unitId: unit.id, unitName: unit.name, categoryName: unit.category.name, entries };
  });

  return {
    month,
    days: monthDays(month),
    previous: addMonths(first, -1).slice(0, 7),
    next: nextFirst.slice(0, 7),
    rows,
  };
}
