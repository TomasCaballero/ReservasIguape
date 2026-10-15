import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { UnitForm } from "@/components/admin/UnitForm";
import { requireAdmin } from "@/lib/auth/current-admin";
import { prisma } from "@/lib/prisma";
import { deleteUnitAction } from "../catalog-actions";

export default async function UnitsPage({ searchParams }: PageProps<"/adminpanel/unidades">) {
  const admin = await requireAdmin();
  const editParam = (await searchParams).editar;
  const editId = Array.isArray(editParam) ? editParam[0] : editParam;

  const [categories, units] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.unit.findMany({ orderBy: [{ category: { name: "asc" } }, { name: "asc" }], include: { category: true } }),
  ]);
  const editing = units.find((u) => u.id === editId);

  return (
    <AdminShell email={admin.email} title="Unidades">
      {categories.length === 0 ? (
        <p>Primero creá al menos una categoría para poder agregar unidades.</p>
      ) : (
        <UnitForm
          key={editing?.id ?? "nueva"}
          id={editing?.id ?? null}
          initial={editing && { name: editing.name, categoryId: editing.categoryId }}
          categories={categories}
        />
      )}

      <section aria-labelledby="listado">
        <h2 id="listado" className="text-2xl">
          Unidades físicas
        </h2>
        {units.length === 0 && <p className="mt-3">Todavía no hay unidades.</p>}
        <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {units.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 border border-border bg-background-card p-4" data-testid="unit-item">
              <div>
                <h3 className="text-xl">{u.name}</h3>
                <p className="caption-text mt-1">{u.category.name}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={`/adminpanel/unidades?editar=${u.id}`} className="btn-outlined" aria-label={`Editar ${u.name}`}>
                  Editar
                </Link>
                <DeleteButton label={`Eliminar ${u.name}`} action={deleteUnitAction.bind(null, u.id)} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
