import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/AdminShell";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { IcalSourceForm } from "@/components/admin/IcalSourceForm";
import { SyncNowButton } from "@/components/admin/SyncNowButton";
import { requireAdmin } from "@/lib/auth/current-admin";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { removeIcalSourceAction } from "../ical-actions";

export default async function IcalPage() {
  const admin = await requireAdmin();
  const h = await headers();
  const host = h.get("host") ?? "localhost:7777";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const [units, runs] = await Promise.all([
    prisma.unit.findMany({
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      include: { category: true, icalSources: { orderBy: { label: "asc" } } },
    }),
    prisma.icalSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
  ]);

  return (
    <AdminShell email={admin.email} title="Sincronización iCal">
      <section aria-labelledby="sync" className="flex flex-col gap-4">
        <h2 id="sync" className="text-2xl">
          Sincronización
        </h2>
        <p>Se sincroniza sola cada 15 minutos como máximo. Con el botón la corrés ahora.</p>
        <SyncNowButton />
        <h3 className="text-xl">Últimas corridas</h3>
        {runs.length === 0 && <p>Todavía no hubo corridas.</p>}
        <ul className="flex flex-col gap-2" data-testid="sync-runs">
          {runs.map((r) => (
            <li key={r.id} className="border border-border bg-background-card p-3 break-words">
              <span className="caption-text">
                {formatDateTime(r.startedAt)} · {r.trigger === "MANUAL" ? "Manual" : "Automática"} ·{" "}
                {r.ok === null ? "En curso" : r.ok ? "Correcta" : "Con errores"}
              </span>
              {r.summary && <p className="mt-1">{r.summary}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="unidades" className="flex flex-col gap-4">
        <h2 id="unidades" className="text-2xl">
          Unidades
        </h2>
        {units.length === 0 && <p>Todavía no hay unidades.</p>}
        <ul className="grid gap-4 lg:grid-cols-2">
          {units.map((u) => {
            const feedUrl = `${proto}://${host}/api/ical/${u.icalToken}.ics`;
            return (
              <li key={u.id} className="flex flex-col gap-4 border border-border bg-background-card p-4" data-testid="ical-unit">
                <div>
                  <h3 className="text-xl">{u.name}</h3>
                  <p className="caption-text mt-1">{u.category.name}</p>
                </div>
                <div>
                  <p className="caption-text">URL del feed para Booking y Airbnb</p>
                  <p className="mt-1 break-all" data-testid="feed-url">
                    {feedUrl}
                  </p>
                </div>
                <div>
                  <p className="caption-text">Fuentes importadas</p>
                  {u.icalSources.length === 0 && <p className="mt-1">Ninguna.</p>}
                  <ul className="mt-2 flex flex-col gap-3">
                    {u.icalSources.map((s) => (
                      <li key={s.id} className="flex flex-col gap-2 border border-border p-3" data-testid="ical-source">
                        <p className="font-display text-lg">{s.label}</p>
                        <p className="break-all text-sm">{s.url}</p>
                        <p className="text-sm">
                          {s.lastSyncedAt ? `Última sincronización: ${formatDateTime(s.lastSyncedAt)}` : "Sin sincronizar todavía"}
                        </p>
                        {s.lastError && (
                          <p role="alert" className="text-sm text-primary">
                            Error: {s.lastError}
                          </p>
                        )}
                        <DeleteButton
                          label={`Quitar ${s.label} de ${u.name}`}
                          warning="Se quitan también los bloqueos que había importado esta fuente."
                          action={removeIcalSourceAction.bind(null, s.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
                <IcalSourceForm unitId={u.id} unitName={u.name} />
              </li>
            );
          })}
        </ul>
      </section>
    </AdminShell>
  );
}
