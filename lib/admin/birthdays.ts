import { nightsBetween, type ISODate } from "@/lib/booking/dates";

// Cumpleañeros del widget de Inicio (RF-60, D-02). Función pura: no accede a la base.

export type BirthdayCustomer = { id: string; lastName: string; birthDate: ISODate; anonymized: boolean };
export type Birthday<T extends BirthdayCustomer> = { customer: T; date: ISODate; inDays: number };

const pad = (n: number) => String(n).padStart(2, "0");
const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** Fecha del cumpleaños en `year`; el 29/02 se celebra el 28/02 en años no bisiestos (AC-94). */
function occurrence(birthDate: ISODate, year: number): ISODate {
  const month = Number(birthDate.slice(5, 7));
  const day = Number(birthDate.slice(8, 10));
  const safeDay = month === 2 && day === 29 && !isLeap(year) ? 28 : day;
  return `${year}-${pad(month)}-${pad(safeDay)}`;
}

/** RF-60: clientes que cumplen años en los próximos `days` (offsets 0..days, AC-93). Incluye hoy (P-12). */
export function upcomingBirthdays<T extends BirthdayCustomer>(
  customers: T[],
  today: ISODate,
  days = 30,
): Birthday<T>[] {
  const year = Number(today.slice(0, 4));
  const result: Birthday<T>[] = [];
  for (const customer of customers) {
    if (customer.anonymized) continue;
    // Se prueba el año actual y el siguiente: así cruza el fin de año (AC-92).
    for (const y of [year, year + 1]) {
      const date = occurrence(customer.birthDate, y);
      const inDays = nightsBetween(today, date);
      if (inDays < 0) continue;
      if (inDays <= days) result.push({ customer, date, inDays });
      break;
    }
  }
  return result.sort((a, b) => a.inDays - b.inDays || a.customer.lastName.localeCompare(b.customer.lastName, "es"));
}
