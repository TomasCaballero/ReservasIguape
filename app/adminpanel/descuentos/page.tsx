import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { DiscountForm, DiscountToggle } from "@/components/admin/DiscountForm";
import { requireAdmin } from "@/lib/auth/current-admin";
import { formatNights } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function DiscountsPage({ searchParams }: PageProps<"/adminpanel/descuentos">) {
  const admin = await requireAdmin();
  const editParam = (await searchParams).editar;
  const editId = Array.isArray(editParam) ? editParam[0] : editParam;

  const rules = await prisma.discountRule.findMany({ orderBy: [{ minNights: "asc" }, { percent: "asc" }] });
  const editing = rules.find((r) => r.id === editId);

  return (
    <AdminShell email={admin.email} title="Descuentos por estadía">
      <p className="max-w-prose">
        Se aplica el descuento de mayor porcentaje entre las reglas activas cuyo mínimo de noches se cumple. Los
        descuentos no se acumulan.
      </p>
      <DiscountForm
        key={editing?.id ?? "nueva"}
        id={editing?.id ?? null}
        initial={editing && { minNights: String(editing.minNights), percent: editing.percent.toString() }}
      />

      <section aria-labelledby="listado">
        <h2 id="listado" className="text-2xl">
          Reglas
        </h2>
        {rules.length === 0 && <p className="mt-3">Todavía no hay reglas de descuento.</p>}
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {rules.map((r) => {
            const label = `${r.percent.toString()}% desde ${formatNights(r.minNights)}`;
            return (
              <li key={r.id} className="flex flex-col gap-3 border border-border bg-background-card p-4" data-testid="discount-item">
                <div>
                  <p className="text-xl">{label}</p>
                  <p className="caption-text mt-1">{r.active ? "Activa" : "Inactiva"}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/adminpanel/descuentos?editar=${r.id}`} className="btn-outlined" aria-label={`Editar ${label}`}>
                    Editar
                  </Link>
                  <DiscountToggle id={r.id} active={r.active} label={label} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </AdminShell>
  );
}
