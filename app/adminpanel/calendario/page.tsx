import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { BlockForm } from "@/components/admin/BlockForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { BLOCK_KIND_LABEL } from "@/lib/admin/blocks";
import { getMonthCalendar, occupiesNight, parseMonth, type CalendarEntry } from "@/lib/admin/calendar";
import { requireAdmin } from "@/lib/auth/current-admin";
import { formatDMY } from "@/lib/booking/dates";
import { prisma } from "@/lib/prisma";
import { deleteBlockAction } from "../booking-actions";

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const monthLabel = (month: string) => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`;

function cellLabel(entry: CalendarEntry): string {
  if (entry.kind === "booking") {
    return `${entry.holderName}${entry.unassigned ? " (sin asignar)" : ""} · #${entry.reference}`;
  }
  if (entry.kind === "block") return BLOCK_KIND_LABEL[entry.blockKind];
  return "Reserva en curso";
}

export default async function CalendarPage({ searchParams }: PageProps<"/adminpanel/calendario">) {
  const admin = await requireAdmin();
  const param = (await searchParams).mes;
  const month = parseMonth(Array.isArray(param) ? param[0] : param);
  const [calendar, units] = await Promise.all([
    getMonthCalendar(prisma, month),
    prisma.unit.findMany({
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, category: { select: { name: true } } },
    }),
  ]);

  const blocks = calendar.rows.flatMap((row) =>
    row.entries.flatMap((e) => (e.kind === "block" ? [{ ...e, unitName: row.unitName }] : [])),
  );

  return (
    <AdminShell email={admin.email} title="Calendario">
      <section aria-labelledby="mes" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/adminpanel/calendario?mes=${calendar.previous}`} className="btn-outlined">
            ← Mes anterior
          </Link>
          <h2 id="mes" className="text-2xl capitalize" data-testid="calendar-month">
            {monthLabel(calendar.month)}
          </h2>
          <Link href={`/adminpanel/calendario?mes=${calendar.next}`} className="btn-outlined">
            Mes siguiente →
          </Link>
        </div>

        <div className="overflow-x-auto border border-border">
          <table className="w-full border-collapse text-sm" data-testid="calendar-grid">
            <caption className="sr-only">Ocupación por unidad y día. La noche del check-out queda libre.</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 bg-background p-2 text-left">
                  Unidad
                </th>
                {calendar.days.map((day) => (
                  <th key={day} scope="col" className="min-w-9 p-1 text-center font-normal">
                    {Number(day.slice(8, 10))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendar.rows.map((row) => (
                <tr key={row.unitId} className="border-t border-border" data-testid="calendar-row">
                  <th scope="row" className="sticky left-0 bg-background p-2 text-left font-normal">
                    {row.unitName}
                    <span className="caption-text block">{row.categoryName}</span>
                  </th>
                  {calendar.days.map((day) => {
                    const entry = row.entries.find((e) => occupiesNight(e, day));
                    if (!entry) {
                      return <td key={day} className="p-1" aria-label={`${row.unitName}, ${formatDMY(day)}: libre`} />;
                    }
                    const label = cellLabel(entry);
                    const tone =
                      entry.kind === "booking"
                        ? "bg-primary text-text-dark"
                        : entry.kind === "block"
                          ? "bg-border text-text-dark"
                          : "bg-background-card";
                    const content = entry.kind === "booking" ? (
                      <Link href={`/adminpanel/reservas/${entry.bookingId}`} className="block h-6 w-full" aria-label={`${row.unitName}, ${formatDMY(day)}: ${label}`} title={label} />
                    ) : (
                      <span className="block h-6 w-full" role="img" aria-label={`${row.unitName}, ${formatDMY(day)}: ${label}`} title={label} />
                    );
                    return (
                      <td key={day} className={`p-0 ${tone}`} data-state={entry.kind === "booking" ? "booking" : entry.kind}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption-text">
          Verde lima: reserva · Marrón: bloqueo · Oscuro: reserva en curso. Cada reserva ocupa hasta la noche anterior al check-out.
        </p>
      </section>

      <BlockForm units={units.map((u) => ({ id: u.id, name: u.name, categoryName: u.category.name }))} />

      <section aria-labelledby="bloqueos" className="flex flex-col gap-4">
        <h2 id="bloqueos" className="text-2xl">
          Bloqueos del mes
        </h2>
        {blocks.length === 0 && <p>No hay bloqueos en este mes.</p>}
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {blocks.map((b) => (
            <li key={b.blockId} className="flex flex-col gap-3 border border-border bg-background-card p-4" data-testid="block-item">
              <div>
                <h3 className="text-xl">{b.unitName}</h3>
                <p className="caption-text mt-1">{BLOCK_KIND_LABEL[b.blockKind]}</p>
                <p>
                  {formatDMY(b.start)} – {formatDMY(b.end)}
                </p>
                {b.note && <p className="text-sm">{b.note}</p>}
              </div>
              {b.blockKind !== "ICAL" && (
                <DeleteButton
                  label={`Quitar bloqueo de ${b.unitName}`}
                  warning="La unidad vuelve a estar disponible en esas fechas."
                  action={deleteBlockAction.bind(null, b.blockId)}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
