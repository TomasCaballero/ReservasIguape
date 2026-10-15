"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveCategoryAction } from "@/app/adminpanel/catalog-actions";
import { TextField } from "@/components/booking/form-fields";
import type { CategoryForm as Values } from "@/lib/admin/validation";
import { useSubmit } from "./use-submit";

const EMPTY: Values = { name: "", description: "", maxCapacity: "", basePriceArs: "", basePriceUsd: "" };

/** RF-34, RF-35: alta y edición de categorías. El slug se genera solo y no cambia. */
export function CategoryForm({ id, initial }: { id: string | null; initial?: Values }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial ?? EMPTY);
  const { errors, pending, submit } = useSubmit(
    (v: Values) => saveCategoryAction(id, v),
    () => {
      if (id) router.push("/adminpanel/categorias");
      else setValues(EMPTY);
      router.refresh();
    },
  );
  const set = (key: keyof Values) => (v: string) => setValues({ ...values, [key]: v });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(values);
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid max-w-2xl gap-5 sm:grid-cols-2"
      aria-label={id ? "Editar categoría" : "Nueva categoría"}
    >
      <h2 className="text-2xl sm:col-span-2">{id ? "Editar categoría" : "Nueva categoría"}</h2>
      {errors._form && (
        <p role="alert" className="border border-primary p-3 sm:col-span-2">
          {errors._form}
        </p>
      )}
      <div className="sm:col-span-2">
        <TextField id="cat-name" label="Nombre" value={values.name} error={errors.name} onChange={set("name")} />
      </div>
      <div className="sm:col-span-2">
        <TextField
          id="cat-description"
          label="Descripción breve"
          value={values.description}
          error={errors.description}
          onChange={set("description")}
        />
      </div>
      <TextField
        id="cat-maxCapacity"
        label="Capacidad máxima"
        inputMode="numeric"
        value={values.maxCapacity}
        error={errors.maxCapacity}
        onChange={set("maxCapacity")}
      />
      <span className="hidden sm:block" />
      <TextField
        id="cat-basePriceArs"
        label="Precio base por noche (ARS)"
        inputMode="decimal"
        value={values.basePriceArs}
        error={errors.basePriceArs}
        onChange={set("basePriceArs")}
      />
      <TextField
        id="cat-basePriceUsd"
        label="Precio base por noche (USD)"
        inputMode="decimal"
        value={values.basePriceUsd}
        error={errors.basePriceUsd}
        onChange={set("basePriceUsd")}
      />
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button type="submit" className="btn-filled" disabled={pending}>
          {pending ? "Guardando…" : id ? "Guardar cambios" : "Crear categoría"}
        </button>
        {id && (
          <Link href="/adminpanel/categorias" className="btn-outlined">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
