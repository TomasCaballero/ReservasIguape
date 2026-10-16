import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/adminpanel/actions";

const SECTIONS = [
  { href: "/adminpanel", label: "Inicio" },
  { href: "/adminpanel/reservas", label: "Reservas" },
  { href: "/adminpanel/calendario", label: "Calendario" },
  { href: "/adminpanel/clientes", label: "Clientes" },
  { href: "/adminpanel/ical", label: "iCal" },
  { href: "/adminpanel/categorias", label: "Categorías" },
  { href: "/adminpanel/unidades", label: "Unidades" },
  { href: "/adminpanel/descuentos", label: "Descuentos" },
  { href: "/adminpanel/temporadas", label: "Temporadas" },
  { href: "/adminpanel/parametros", label: "Parámetros" },
];

/** Marco de las pantallas del panel: encabezado, navegación y salida. */
export function AdminShell({ email, title, children }: { email: string; title: string; children: ReactNode }) {
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="caption-text">Iguapé Aparts</p>
            <p className="font-display text-2xl">Panel de administración</p>
          </div>
          <form action={logoutAction} className="flex flex-wrap items-center gap-4">
            <span className="text-sm break-all">{email}</span>
            <button type="submit" className="btn-outlined">
              Salir
            </button>
          </form>
        </div>
        <nav aria-label="Secciones del panel" className="mx-auto w-full max-w-6xl px-4 pb-3">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="caption-text underline-offset-4 hover:underline">
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="text-3xl">{title}</h1>
        <div className="mt-8 flex flex-col gap-10">{children}</div>
      </main>
    </>
  );
}
