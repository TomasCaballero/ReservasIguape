// Fechas de estadía como string "AAAA-MM-DD" (tipo `date`, sin hora ni zona).
// "Hoy" se calcula en America/Argentina/Buenos_Aires (RNF-09).

export type ISODate = string;

const DAY_MS = 86_400_000;
const TIME_ZONE = "America/Argentina/Buenos_Aires";

export function parseISODate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  const roundTrips =
    back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d;
  return roundTrips ? ms : null;
}

export function isValidISODate(value: string): value is ISODate {
  return parseISODate(value) !== null;
}

function toISO(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

function ms(date: ISODate): number {
  const parsed = parseISODate(date);
  if (parsed === null) throw new Error(`Fecha inválida: ${date}`);
  return parsed;
}

export function addDays(date: ISODate, days: number): ISODate {
  return toISO(ms(date) + days * DAY_MS);
}

/** Suma meses sin desbordar: 31/01 + 1 mes = 28/02 (o 29/02). */
export function addMonths(date: ISODate, months: number): ISODate {
  const base = new Date(ms(date));
  const target = base.getUTCFullYear() * 12 + base.getUTCMonth() + months;
  const year = Math.floor(target / 12);
  const month = target % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toISO(Date.UTC(year, month, Math.min(base.getUTCDate(), lastDay)));
}

/** Cantidad de noches entre check-in y check-out (puede ser <= 0 si el rango es inválido). */
export function nightsBetween(checkIn: ISODate, checkOut: ISODate): number {
  return Math.round((ms(checkOut) - ms(checkIn)) / DAY_MS);
}

/** Noches ocupadas: [checkIn, checkOut). La noche del check-out queda libre (AC-19). */
export function eachNight(checkIn: ISODate, checkOut: ISODate): ISODate[] {
  const count = Math.max(0, nightsBetween(checkIn, checkOut));
  return Array.from({ length: count }, (_, i) => addDays(checkIn, i));
}

export function todayInBuenosAires(now: Date = new Date()): ISODate {
  // El locale en-CA formatea como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** AAAA-MM-DD → dd/MM/yyyy. */
export function formatDMY(date: ISODate): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
