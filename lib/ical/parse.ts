import { addDays, isValidISODate, todayInBuenosAires, type ISODate } from "@/lib/booking/dates";

// Parser iCal mínimo (D-07, RF-65). Solo lee UID, DTSTART, DTEND y STATUS de cada VEVENT;
// SUMMARY y DESCRIPTION se ignoran a propósito (pueden traer datos de huéspedes).

export type IcalEvent = { uid: string; start: ISODate; end: ISODate };

/** RFC 5545 §3.1: las líneas continuadas empiezan con espacio o tab. */
function unfold(text: string): string[] {
  return text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

/** `VALUE=DATE` → esa fecha; `DATE-TIME` en UTC → fecha de Buenos Aires; flotante/TZID → su propia fecha. */
function toDate(value: string): ISODate | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h && z) {
    return todayInBuenosAires(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)));
  }
  const date = `${y}-${mo}-${d}`;
  return isValidISODate(date) ? date : null;
}

export function parseIcal(text: string, today: ISODate = todayInBuenosAires()): IcalEvent[] {
  const events: IcalEvent[] = [];
  let current: { uid?: string; start?: ISODate; end?: ISODate; cancelled: boolean } | null = null;

  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      current = { cancelled: false };
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.uid && current.start && !current.cancelled) {
        const end = current.end ?? addDays(current.start, 1);
        if (end > current.start && end > today) events.push({ uid: current.uid, start: current.start, end });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).split(";")[0];
    const value = line.slice(colon + 1);
    switch (name.toUpperCase()) {
      case "UID":
        current.uid = value.trim();
        break;
      case "DTSTART":
        current.start = toDate(value) ?? undefined;
        break;
      case "DTEND":
        current.end = toDate(value) ?? undefined;
        break;
      case "STATUS":
        current.cancelled = value.trim().toUpperCase() === "CANCELLED";
        break;
    }
  }
  return events;
}
