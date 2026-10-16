import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { BookingActions } from "@/components/admin/BookingActions";
import { PaymentForm } from "@/components/admin/PaymentForm";
import { STATUS_LABEL, TRANSITIONS, type BookingStatus } from "@/lib/admin/bookings";
import { requireAdmin } from "@/lib/auth/current-admin";
import { formatDMY, nightsBetween } from "@/lib/booking/dates";
import { formatDateTime, formatGuests, formatMoney, formatNights } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DOCUMENT = { DNI: "DNI", PASSPORT: "Pasaporte" } as const;

export default async function BookingDetailPage({ params }: PageProps<"/adminpanel/reservas/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      guests: { orderBy: { lastName: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!booking) notFound();

  const status = booking.status as BookingStatus;
  const active = status === "PENDING" || status === "CONFIRMED";
  const units = booking.categoryId
    ? await prisma.unit.findMany({ where: { categoryId: booking.categoryId }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];
  const assigned = units.find((u) => u.id === booking.unitId);
  const checkIn = iso(booking.checkIn);
  const checkOut = iso(booking.checkOut);
  const reference = booking.id.slice(0, 8).toUpperCase();
  const paid = booking.payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.currency] = (acc[p.currency] ?? 0) + Number(p.amount);
    return acc;
  }, {});

  return (
    <AdminShell email={admin.email} title={`Reserva #${reference}`}>
      <p>
        <Link href="/adminpanel/reservas" className="underline underline-offset-4">
          ← Volver a reservas
        </Link>
      </p>

      <section aria-labelledby="resumen" className="grid gap-4 border border-border bg-background-card p-5 sm:grid-cols-2">
        <h2 id="resumen" className="sr-only">
          Resumen
        </h2>
        <p>
          <span className="caption-text block">Estado</span>
          <span data-testid="booking-status">{STATUS_LABEL[status]}</span>
          {booking.cancelledByExpiry && <span> (venció sin cobro)</span>}
        </p>
        <p>
          <span className="caption-text block">Origen</span>Web Directa
        </p>
        <p>
          <span className="caption-text block">Categoría</span>
          {booking.categoryName}
        </p>
        <p>
          <span className="caption-text block">Unidad</span>
          {assigned ? assigned.name : "Sin unidad"}
          {active && assigned && !booking.unitAssigned && " (sin asignar)"}
        </p>
        <p>
          <span className="caption-text block">Fechas</span>
          {formatDMY(checkIn)} – {formatDMY(checkOut)} · {formatNights(nightsBetween(checkIn, checkOut))}
        </p>
        <p>
          <span className="caption-text block">Huéspedes</span>
          {formatGuests(booking.adults, booking.children)}
        </p>
        <p>
          <span className="caption-text block">Total</span>
          {formatMoney(Number(booking.total), booking.currency)}
          {Number(booking.discountPercent) > 0 && ` (descuento ${Number(booking.discountPercent)}%)`}
        </p>
        <p>
          <span className="caption-text block">Creada</span>
          {formatDateTime(booking.createdAt)}
        </p>
        {booking.paymentInfoSentAt && (
          <p>
            <span className="caption-text block">Método de pago enviado</span>
            <span data-testid="payment-info-sent">{formatDateTime(booking.paymentInfoSentAt)}</span>
          </p>
        )}
      </section>

      <section aria-labelledby="titular" className="flex flex-col gap-2">
        <h2 id="titular" className="text-2xl">
          Titular
        </h2>
        <p>
          <Link href={`/adminpanel/clientes/${booking.customer.id}`} className="underline underline-offset-4">
            {booking.customer.firstName} {booking.customer.lastName}
          </Link>{" "}
          · {DOCUMENT[booking.customer.documentType]} {booking.customer.documentNumber}
          {booking.customer.anonymizedAt && <strong> · Cliente anonimizado</strong>}
        </p>
        <p>
          {booking.customer.email} · {booking.customer.phone}
        </p>
        <p>Nacimiento: {formatDMY(iso(booking.customer.birthDate))}</p>
      </section>

      {booking.guests.length > 0 && (
        <section aria-labelledby="acompanantes" className="flex flex-col gap-2">
          <h2 id="acompanantes" className="text-2xl">
            Acompañantes
          </h2>
          <ul>
            {booking.guests.map((g) => (
              <li key={g.id}>
                {g.firstName} {g.lastName} · Doc. {g.documentNumber} · Nacimiento {formatDMY(iso(g.birthDate))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <BookingActions
        bookingId={booking.id}
        status={status}
        allowed={TRANSITIONS[status]}
        units={units}
        currentUnitId={booking.unitId}
        canAssign={active && units.length > 0}
        canMarkSent={status === "PENDING" && !booking.paymentInfoSentAt}
      />

      <section aria-labelledby="cobros" className="flex flex-col gap-4">
        <h2 id="cobros" className="text-2xl">
          Cobros
        </h2>
        {booking.payments.length === 0 ? (
          <p>Todavía no se registraron cobros.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {booking.payments.map((p) => (
                <li key={p.id} className="border border-border p-3" data-testid="payment-item">
                  {formatMoney(Number(p.amount), p.currency)} · {p.method} · {formatDateTime(p.createdAt)}
                  {p.reference && <> · Ref. {p.reference}</>}
                  {p.receiptPath && (
                    <>
                      {" · "}
                      <a href={`/api/admin/payments/${p.id}/receipt`} target="_blank" rel="noopener" className="underline underline-offset-4">
                        Ver comprobante
                      </a>
                    </>
                  )}
                  {!p.receiptPath && p.receiptUploadedAt && <> · Comprobante eliminado (más de 3 meses)</>}
                </li>
              ))}
            </ul>
            <p>
              Cobrado:{" "}
              {Object.entries(paid)
                .map(([currency, amount]) => formatMoney(amount, currency as "ARS" | "USD"))
                .join(" + ")}
            </p>
          </>
        )}
        <PaymentForm bookingId={booking.id} defaultCurrency={booking.currency} />
      </section>
    </AdminShell>
  );
}
