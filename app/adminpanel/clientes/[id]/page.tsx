import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AnonymizeActions } from "@/components/admin/AnonymizeActions";
import { STATUS_LABEL } from "@/lib/admin/bookings";
import { getCustomer } from "@/lib/admin/customers";
import { requireAdmin } from "@/lib/auth/current-admin";
import { formatDMY, todayInBuenosAires } from "@/lib/booking/dates";
import { formatDateTime, formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DOCUMENT = { DNI: "DNI", PASSPORT: "Pasaporte" } as const;

export default async function CustomerDetailPage({ params }: PageProps<"/adminpanel/clientes/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const customer = await getCustomer(prisma, id, todayInBuenosAires());
  if (!customer) notFound();
  const pending = customer.request !== null && customer.request.completedAt === null;

  return (
    <AdminShell email={admin.email} title={`${customer.firstName} ${customer.lastName}`}>
      <p>
        <Link href="/adminpanel/clientes" className="underline underline-offset-4">
          ← Volver a clientes
        </Link>
      </p>

      <section aria-labelledby="datos" className="grid gap-4 border border-border bg-background-card p-5 sm:grid-cols-2">
        <h2 id="datos" className="sr-only">
          Datos
        </h2>
        {customer.anonymized && (
          <p className="sm:col-span-2" data-testid="customer-anonymized">
            <strong>Cliente anonimizado</strong>
          </p>
        )}
        <p className="break-words">
          <span className="caption-text block">Email</span>
          {customer.email}
        </p>
        <p>
          <span className="caption-text block">Teléfono</span>
          {customer.phone}
        </p>
        <p className="break-words">
          <span className="caption-text block">Documento</span>
          {DOCUMENT[customer.documentType]} {customer.documentNumber}
        </p>
        <p>
          <span className="caption-text block">Nacimiento</span>
          {formatDMY(customer.birthDate)}
        </p>
        <p>
          <span className="caption-text block">Última actualización</span>
          {formatDateTime(customer.updatedAt)}
        </p>
      </section>

      <section aria-labelledby="historial" className="flex flex-col gap-3">
        <h2 id="historial" className="text-2xl">
          Historial de reservas
        </h2>
        {customer.bookings.length === 0 ? (
          <p>Todavía no hizo reservas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {customer.bookings.map((b) => (
              <li key={b.id} className="border border-border p-3" data-testid="customer-booking">
                <Link href={`/adminpanel/reservas/${b.id}`} className="underline underline-offset-4">
                  #{b.reference}
                </Link>{" "}
                · {STATUS_LABEL[b.status]} · {b.categoryName} · {formatDMY(b.checkIn)} – {formatDMY(b.checkOut)} ·{" "}
                {formatMoney(b.total, b.currency)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="anonimizacion" className="flex flex-col gap-3">
        <h2 id="anonimizacion" className="text-2xl">
          Anonimización
        </h2>
        <p data-testid="request-status">
          {customer.request
            ? `Solicitada el ${formatDateTime(customer.request.requestedAt)} · ${
                customer.request.completedAt ? `Anonimizada el ${formatDateTime(customer.request.completedAt)}` : "Pendiente"
              }`
            : "Sin solicitud registrada."}
        </p>
        {!customer.anonymized && (
          <AnonymizeActions customerId={customer.id} hasPending={pending} activeBookings={customer.activeBookings} />
        )}
      </section>
    </AdminShell>
  );
}
