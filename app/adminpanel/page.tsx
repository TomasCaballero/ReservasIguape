import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { BirthdaysWidget } from "@/components/admin/BirthdaysWidget";
import { LoginForm } from "@/components/admin/LoginForm";
import { upcomingBirthdays } from "@/lib/admin/birthdays";
import { findUncontactedBookings } from "@/lib/admin/bookings";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { formatDMY, todayInBuenosAires } from "@/lib/booking/dates";
import { prisma } from "@/lib/prisma";

// `/adminpanel` muestra el login; con sesión iniciada, el panel.
export default async function AdminHome() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-4 py-16">
        <div>
          <p className="caption-text">Iguapé Aparts</p>
          <h1 className="mt-2 text-4xl">Panel de administración</h1>
        </div>
        <LoginForm />
      </main>
    );
  }

  // RF-53: reservas Pendiente sin envío del método de pago pasado el plazo de aviso.
  const uncontacted = await findUncontactedBookings(prisma);
  // RF-60: cumpleaños de los próximos 30 días (solo clientes no anonimizados).
  const customers = await prisma.customer.findMany({
    where: { anonymizedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, birthDate: true },
  });
  const birthdays = upcomingBirthdays(
    customers.map((c) => ({ ...c, birthDate: c.birthDate.toISOString().slice(0, 10), anonymized: false })),
    todayInBuenosAires(),
  );

  return (
    <AdminShell email={admin.email} title="Bienvenido">
      {uncontacted.length > 0 && (
        <section aria-labelledby="sin-contacto" className="border border-primary p-4" data-testid="uncontacted-notice">
          <h2 id="sin-contacto" className="text-2xl">
            Reservas pendientes sin contactar
          </h2>
          <p className="mt-1">
            Todavía no se registró el envío del método de pago. Siguen Pendientes y ocupando la unidad.
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {uncontacted.map((b) => (
              <li key={b.id}>
                <Link href={`/adminpanel/reservas/${b.id}`} className="underline underline-offset-4">
                  #{b.reference} · {b.holderName} · {b.categoryName} · {formatDMY(b.checkIn)} – {formatDMY(b.checkOut)}
                </Link>{" "}
                (hace {b.hoursWaiting} h)
              </li>
            ))}
          </ul>
        </section>
      )}
      <BirthdaysWidget birthdays={birthdays} />
      <p>Elegí una sección en el menú para gestionar reservas, calendario, catálogo, tarifas y parámetros.</p>
    </AdminShell>
  );
}
