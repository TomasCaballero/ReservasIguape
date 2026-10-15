import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { requireAdmin } from "@/lib/auth/current-admin";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { deleteCategoryAction } from "../catalog-actions";

export default async function CategoriesPage({ searchParams }: PageProps<"/adminpanel/categorias">) {
  const admin = await requireAdmin();
  const editParam = (await searchParams).editar;
  const editId = Array.isArray(editParam) ? editParam[0] : editParam;

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { units: true } } },
  });
  const editing = categories.find((c) => c.id === editId);

  return (
    <AdminShell email={admin.email} title="Categorías">
      <CategoryForm
        key={editing?.id ?? "nueva"}
        id={editing?.id ?? null}
        initial={
          editing && {
            name: editing.name,
            description: editing.description,
            maxCapacity: String(editing.maxCapacity),
            basePriceArs: editing.basePriceArs.toString(),
            basePriceUsd: editing.basePriceUsd.toString(),
          }
        }
      />

      <section aria-labelledby="listado">
        <h2 id="listado" className="text-2xl">
          Catálogo
        </h2>
        {categories.length === 0 && <p className="mt-3">Todavía no hay categorías.</p>}
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 border border-border bg-background-card p-4" data-testid="category-item">
              <div>
                <h3 className="text-xl">{c.name}</h3>
                <p>{c.description}</p>
                <p className="caption-text mt-2">
                  Hasta {c.maxCapacity} huéspedes · {c._count.units} {c._count.units === 1 ? "unidad" : "unidades"}
                </p>
                <p className="mt-1">
                  {formatMoney(Number(c.basePriceArs), "ARS")}/noche · {formatMoney(Number(c.basePriceUsd), "USD")}/noche
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={`/adminpanel/categorias?editar=${c.id}`} className="btn-outlined" aria-label={`Editar ${c.name}`}>
                  Editar
                </Link>
                <DeleteButton
                  label={`Eliminar ${c.name}`}
                  warning={
                    c._count.units > 0
                      ? `También se eliminarán sus ${c._count.units} unidades. Esta acción no se puede deshacer.`
                      : undefined
                  }
                  action={deleteCategoryAction.bind(null, c.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
