import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { inputClass } from "@/components/booking/form-fields";
import { listAnonymizationRequests, listCustomers } from "@/lib/admin/customers";
import { requireAdmin } from "@/lib/auth/current-admin";
import { formatDMY } from "@/lib/booking/dates";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const DOCUMENT = { DNI: "DNI", PASSPORT: "Pasaporte" } as const;

export default async function CustomersPage({ searchParams }: PageProps<"/adminpanel/clientes">) {
  const admin = await requireAdmin();
  const param = (await searchParams).q;
  const q = (Array.isArray(param) ? param[0] : param)?.slice(0, 80);

  const [customers, requests] = await Promise.all([listCustomers(prisma, q), listAnonymizationRequests(prisma)]);

  return (
    <AdminShell email={admin.email} title="Clientes">
      <section aria-labelledby="solicitudes" className="flex flex-col gap-3">
        <h2 id="solicitudes" className="text-2xl">
          Solicitudes de anonimización
        </h2>
        {requests.length === 0 ? (
          <p>No hay solicitudes registradas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id} className="border border-border p-3" data-testid="anonymization-request">
                <Link href={`/adminpanel/clientes/${r.customerId}`} className="underline underline-offset-4">
                  {r.customerName}
                </Link>{" "}
                · Solicitada el {formatDateTime(r.requestedAt)} ·{" "}
                {r.completedAt ? `Anonimizada el ${formatDateTime(r.completedAt)}` : "Pendiente"}
                {r.overdue && (
                  <strong data-testid="request-overdue" className="ml-2">
                    Plazo vencido
                  </strong>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="listado" className="flex flex-col gap-4">
        <h2 id="listado" className="text-2xl">
          Listado
        </h2>
        <form method="get" role="search" className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1" htmlFor="q">
            <span className="caption-text">Buscar por nombre, apellido o documento</span>
            <input id="q" name="q" type="search" defaultValue={q ?? ""} maxLength={80} className={inputClass} />
          </label>
          <button type="submit" className="btn-filled">
            Buscar
          </button>
        </form>

        {customers.length === 0 && <p>No hay clientes{q ? " que coincidan con la búsqueda" : ""}.</p>}
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {customers.map((c) => (
            <li key={c.id} className="border border-border bg-background-card p-4" data-testid="customer-item">
              <Link href={`/adminpanel/clientes/${c.id}`} className="flex flex-col gap-1 break-words underline-offset-4 hover:underline">
                <span className="font-display text-xl">
                  {c.firstName} {c.lastName}
                </span>
                <span>{c.email}</span>
                <span>{c.phone}</span>
                <span>
                  {DOCUMENT[c.documentType]} {c.documentNumber}
                </span>
                <span>Nacimiento: {formatDMY(c.birthDate)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
