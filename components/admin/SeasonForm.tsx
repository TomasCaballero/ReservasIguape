"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveSeasonAction } from "@/app/adminpanel/catalog-actions";
import { maskDMY, TextField } from "@/components/booking/form-fields";
import type { SeasonForm as Values } from "@/lib/admin/validation";
import { useSubmit } from "./use-submit";

/** RF-43, RF-44: temporadas con estadía mínima y precio por noche en ARS y USD por categoría. */
export function SeasonForm({
  id,
  initial,
  categories,
}: {
  id: string | null;
  initial?: Values;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const empty: Values = {
    name: "",
    startDate: "",
    endDate: "",
    minNights: "1",
    prices: Object.fromEntries(categories.map((c) => [c.id, { ars: "", usd: "" }])),
  };
  const [values, setValues] = useState<Values>(initial ?? empty);
  const { errors, pending, submit } = useSubmit(
    (v: Values) => saveSeasonAction(id, v),
    () => {
      if (id) router.push("/adminpanel/temporadas");
      else setValues(empty);
      router.refresh();
    },
  );
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(values);
  };
  const setPrice = (categoryId: string, field: "ars" | "usd") => (v: string) =>
    setValues({
      ...values,
      prices: { ...values.prices, [categoryId]: { ...values.prices[categoryId], [field]: v } },
    });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid max-w-3xl gap-5 sm:grid-cols-2"
      aria-label={id ? "Editar temporada" : "Nueva temporada"}
    >
      <h2 className="text-2xl sm:col-span-2">{id ? "Editar temporada" : "Nueva temporada"}</h2>
      {errors._form && (
        <p role="alert" className="border border-primary p-3 sm:col-span-2">
          {errors._form}
        </p>
      )}
      <div className="sm:col-span-2">
        <TextField
          id="season-name"
          label="Nombre"
          value={values.name}
          error={errors.name}
          onChange={(v) => setValues({ ...values, name: v })}
        />
      </div>
      <TextField
        id="season-startDate"
        label="Inicio"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        value={values.startDate}
        error={errors.startDate}
        onChange={(v) => setValues({ ...values, startDate: maskDMY(v) })}
      />
      <TextField
        id="season-endDate"
        label="Fin (inclusive)"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        value={values.endDate}
        error={errors.endDate}
        onChange={(v) => setValues({ ...values, endDate: maskDMY(v) })}
      />
      <TextField
        id="season-minNights"
        label="Estadía mínima (noches)"
        inputMode="numeric"
        value={values.minNights}
        error={errors.minNights}
        onChange={(v) => setValues({ ...values, minNights: v })}
      />

      <fieldset className="grid gap-5 border border-border p-4 sm:col-span-2 sm:grid-cols-2">
        <legend className="caption-text px-2">Precio por noche en la temporada</legend>
        <p className="text-sm sm:col-span-2">Si dejás una categoría vacía, rige su precio base.</p>
        {categories.map((c) => (
          <div key={c.id} className="contents">
            <TextField
              id={`season-${c.id}-ars`}
              label={`${c.name} (ARS)`}
              inputMode="decimal"
              value={values.prices[c.id]?.ars ?? ""}
              error={errors[`prices.${c.id}.ars`]}
              onChange={setPrice(c.id, "ars")}
            />
            <TextField
              id={`season-${c.id}-usd`}
              label={`${c.name} (USD)`}
              inputMode="decimal"
              value={values.prices[c.id]?.usd ?? ""}
              error={errors[`prices.${c.id}.usd`]}
              onChange={setPrice(c.id, "usd")}
            />
          </div>
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button type="submit" className="btn-filled" disabled={pending}>
          {pending ? "Guardando…" : id ? "Guardar cambios" : "Crear temporada"}
        </button>
        {id && (
          <Link href="/adminpanel/temporadas" className="btn-outlined">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
