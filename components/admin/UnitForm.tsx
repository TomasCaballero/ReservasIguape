"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveUnitAction } from "@/app/adminpanel/catalog-actions";
import { SelectField, TextField } from "@/components/booking/form-fields";
import { BlockedNotice } from "./BlockedNotice";
import { useSubmit } from "./use-submit";

type Values = { name: string; categoryId: string };

/** RF-37, RF-38: alta y edición de unidades físicas, cada una asignada a una categoría. */
export function UnitForm({
  id,
  initial,
  categories,
}: {
  id: string | null;
  initial?: Values;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const empty: Values = { name: "", categoryId: categories[0]?.id ?? "" };
  const [values, setValues] = useState<Values>(initial ?? empty);
  const { errors, blocked, pending, submit } = useSubmit(
    (v: Values) => saveUnitAction(id, v),
    () => {
      if (id) router.push("/adminpanel/unidades");
      else setValues(empty);
      router.refresh();
    },
  );
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(values);
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid max-w-2xl gap-5 sm:grid-cols-2"
      aria-label={id ? "Editar unidad" : "Nueva unidad"}
    >
      <h2 className="text-2xl sm:col-span-2">{id ? "Editar unidad" : "Nueva unidad"}</h2>
      {errors._form && (
        <p role="alert" className="border border-primary p-3 sm:col-span-2">
          {errors._form}
        </p>
      )}
      {blocked && (
        <div className="sm:col-span-2">
          <BlockedNotice message={blocked.message} blockers={blocked.blockers} />
        </div>
      )}
      <TextField
        id="unit-name"
        label="Nombre"
        value={values.name}
        error={errors.name}
        onChange={(v) => setValues({ ...values, name: v })}
      />
      <SelectField
        id="unit-categoryId"
        label="Categoría"
        value={values.categoryId}
        error={errors.categoryId}
        onChange={(v) => setValues({ ...values, categoryId: v })}
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
      />
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button type="submit" className="btn-filled" disabled={pending || categories.length === 0}>
          {pending ? "Guardando…" : id ? "Guardar cambios" : "Crear unidad"}
        </button>
        {id && (
          <Link href="/adminpanel/unidades" className="btn-outlined">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
