import Link from "next/link";
import type { Birthday } from "@/lib/admin/birthdays";
import { formatDMY } from "@/lib/booking/dates";

type Person = { id: string; firstName: string; lastName: string; email: string; phone: string; birthDate: string; anonymized: boolean };

/** RF-60: clientes que cumplen años en los próximos 30 días (AC-91). */
export function BirthdaysWidget({ birthdays }: { birthdays: Birthday<Person>[] }) {
  return (
    <section aria-labelledby="cumpleanos" className="border border-border bg-background-card p-4" data-testid="birthdays-widget">
      <h2 id="cumpleanos" className="text-2xl">
        Próximos cumpleaños
      </h2>
      {birthdays.length === 0 ? (
        <p className="mt-1">Nadie cumple años en los próximos 30 días.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {birthdays.map(({ customer: c, date, inDays }) => (
            <li key={c.id} className="break-words" data-testid="birthday-item">
              <Link href={`/adminpanel/clientes/${c.id}`} className="underline underline-offset-4">
                {c.firstName} {c.lastName}
              </Link>{" "}
              · {formatDMY(date)} ({inDays === 0 ? "hoy" : `en ${inDays} ${inDays === 1 ? "día" : "días"}`}) · {c.email} · {c.phone}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
