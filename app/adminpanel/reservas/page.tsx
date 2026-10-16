import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { STATUS_LABEL, type BookingStatus } from "@/lib/admin/bookings";
import { requireAdmin } from "@/lib/auth/current-admin";
import { formatDMY } from "@/lib/booking/dates";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const FILTERS: { value: BookingStatus | ""; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "PENDING", label: STATUS_LABEL.PENDING },
  { value: "CONFIRMED", label: STATUS_LABEL.CONFIRMED },
  { value: "CANCELLED", label: STATUS_LABEL.CANCELLED },
  { value: "FINISHED", label: STATUS_LABEL.FINISHED },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function BookingsPage({ searchParams }: PageProps<"/adminpanel/reservas">) {
  const admin = await requireAdmin();
  const param = (await searchParams).estado;
  const raw = Array.isArray(param) ? param[0] : param;
  const status = FILTERS.find((f) => f.value && f.value === raw)?.value || undefined;

  const bookings = await prisma.booking.findMany({
    where: status ? { status: status as BookingStatus } : undefined,
    orderBy: [{ checkIn: "desc" }, { createdAt: "desc" }],
    include: { customer: { select: { firstName: true, lastName: true } }, unit: { select: { name: true } } },
    take: 200,
  });

  return (
    <AdminShell email={admin.email} title="Reservas">
      <nav aria-label="Filtrar por estado">
        <ul className="flex flex-wrap gap-3">
          {FILTERS.map((f) => {
            const active = (status ?? "") === f.value;
            return (
              <li key={f.label}>
                <Link
                  href={f.value ? `/adminpanel/reservas?estado=${f.value}` : "/adminpanel/reservas"}
                  className={active ? "btn-filled" : "btn-outlined"}
                  aria-current={active ? "page" : undefined}
                >
                  {f.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {bookings.length === 0 && <p>No hay reservas{status ? ` en estado ${STATUS_LABEL[status as BookingStatus]}` : ""}.</p>}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bookings.map((b) => (
          <li key={b.id} className="border border-border bg-background-card p-4" data-testid="booking-item">
            <Link href={`/adminpanel/reservas/${b.id}`} className="flex flex-col gap-1 underline-offset-4 hover:underline">
              <span className="caption-text">
                #{b.id.slice(0, 8).toUpperCase()} · {STATUS_LABEL[b.status as BookingStatus]}
              </span>
              <span className="font-display text-xl">
                {b.customer.firstName} {b.customer.lastName}
              </span>
              <span>
                {b.categoryName}
                {b.unit ? ` · ${b.unit.name}` : ""}
              </span>
              <span>
                {formatDMY(iso(b.checkIn))} – {formatDMY(iso(b.checkOut))}
              </span>
              <span>{formatMoney(Number(b.total), b.currency)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
