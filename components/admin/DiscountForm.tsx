"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveDiscountAction, toggleDiscountAction } from "@/app/adminpanel/catalog-actions";
import { TextField } from "@/components/booking/form-fields";
import type { DiscountForm as Values } from "@/lib/admin/validation";
import { useSubmit } from "./use-submit";

const EMPTY: Values = { minNights: "", percent: "" };

/** RF-40, RF-41: reglas "a partir de X noches, Y% sobre el total". */
export function DiscountForm({ id, initial }: { id: string | null; initial?: Values }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial ?? EMPTY);
  const { errors, pending, submit } = useSubmit(
    (v: Values) => saveDiscountAction(id, v),
    () => {
      if (id) router.push("/adminpanel/descuentos");
      else setValues(EMPTY);
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
      aria-label={id ? "Editar regla" : "Nueva regla"}
    >
      <h2 className="text-2xl sm:col-span-2">{id ? "Editar regla" : "Nueva regla de descuento"}</h2>
      {errors._form && (
        <p role="alert" className="border border-primary p-3 sm:col-span-2">
          {errors._form}
        </p>
      )}
      <TextField
        id="disc-minNights"
        label="A partir de (noches)"
        inputMode="numeric"
        value={values.minNights}
        error={errors.minNights}
        onChange={(v) => setValues({ ...values, minNights: v })}
      />
      <TextField
        id="disc-percent"
        label="Descuento (%)"
        inputMode="decimal"
        value={values.percent}
        error={errors.percent}
        onChange={(v) => setValues({ ...values, percent: v })}
      />
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button type="submit" className="btn-filled" disabled={pending}>
          {pending ? "Guardando…" : id ? "Guardar cambios" : "Crear regla"}
        </button>
        {id && (
          <Link href="/adminpanel/descuentos" className="btn-outlined">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}

/** RF-42: activar o desactivar una regla. */
export function DiscountToggle({ id, active, label }: { id: string; active: boolean; label: string }) {
  const router = useRouter();
  const { pending, submit } = useSubmit<void>(
    () => toggleDiscountAction(id, !active),
    () => router.refresh(),
  );
  return (
    <button
      type="button"
      className="btn-outlined"
      disabled={pending}
      aria-label={`${active ? "Desactivar" : "Activar"} ${label}`}
      onClick={() => submit()}
    >
      {active ? "Desactivar" : "Activar"}
    </button>
  );
}
