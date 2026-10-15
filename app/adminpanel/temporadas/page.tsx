import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SeasonForm } from "@/components/admin/SeasonForm";
import { requireAdmin } from "@/lib/auth/current-admin";
import { formatDMY } from "@/lib/booking/dates";
import { formatMoney, formatNights } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { deleteSeasonAction } from "../catalog-actions";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function SeasonsPage({ searchParams }: PageProps<"/adminpanel/temporadas">) {
  const admin = await requireAdmin();
  const editParam = (await searchParams).editar;
  const editId = Array.isArray(editParam) ? editParam[0] : editParam;

  const [categories, seasons] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.season.findMany({ orderBy: { startDate: "asc" }, include: { prices: true } }),
  ]);
  const editing = seasons.find((s) => s.id === editId);
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? "";

  return (
    <AdminShell email={admin.email} title="Temporadas">
      <p className="max-w-prose">
        Las temporadas no pueden superponerse. Si una estadía incluye al menos una noche de la temporada, se exige su
        estadía mínima.
      </p>
      <SeasonForm
        key={editing?.id ?? "nueva"}
        id={editing?.id ?? null}
        categories={categories}
        initial={
          editing && {
            name: editing.name,
            startDate: formatDMY(iso(editing.startDate)),
            endDate: formatDMY(iso(editing.endDate)),
            minNights: String(editing.minNights),
            prices: Object.fromEntries(
              categories.map((c) => {
                const p = editing.prices.find((x) => x.categoryId === c.id);
                return [c.id, { ars: p?.priceArs.toString() ?? "", usd: p?.priceUsd.toString() ?? "" }];
              }),
            ),
          }
        }
      />

      <section aria-labelledby="listado">
        <h2 id="listado" className="text-2xl">
          Temporadas cargadas
        </h2>
        {seasons.length === 0 && <p className="mt-3">Todavía no hay temporadas.</p>}
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {seasons.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 border border-border bg-background-card p-4" data-testid="season-item">
              <div>
                <h3 className="text-xl">{s.name}</h3>
                <p>
                  {formatDMY(iso(s.startDate))} – {formatDMY(iso(s.endDate))} · estadía mínima {formatNights(s.minNights)}
                </p>
                <ul className="mt-2 text-sm">
                  {s.prices.map((p) => (
                    <li key={p.categoryId}>
                      {nameOf(p.categoryId)}: {formatMoney(Number(p.priceArs), "ARS")} / {formatMoney(Number(p.priceUsd), "USD")}
                    </li>
                  ))}
                  {s.prices.length === 0 && <li>Sin precios propios: rigen los precios base.</li>}
                </ul>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={`/adminpanel/temporadas?editar=${s.id}`} className="btn-outlined" aria-label={`Editar ${s.name}`}>
                  Editar
                </Link>
                <DeleteButton label={`Eliminar ${s.name}`} action={deleteSeasonAction.bind(null, s.id)} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
