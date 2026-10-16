"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { addIcalSourceAction } from "@/app/adminpanel/ical-actions";
import { TextField } from "@/components/booking/form-fields";
import { useSubmit } from "./use-submit";

type Values = { unitId: string; label: string; url: string };

/** RF-64: alta de una URL iCal externa para una unidad. */
export function IcalSourceForm({ unitId, unitName }: { unitId: string; unitName: string }) {
  const router = useRouter();
  const empty: Values = { unitId, label: "", url: "" };
  const [values, setValues] = useState<Values>(empty);
  const { errors, pending, submit } = useSubmit(addIcalSourceAction, () => {
    setValues(empty);
    router.refresh();
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(values);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2" aria-label={`Agregar fuente a ${unitName}`}>
      {errors._form && (
        <p role="alert" className="border border-primary p-3 sm:col-span-2">
          {errors._form}
        </p>
      )}
      <TextField
        id={`ical-label-${unitId}`}
        label="Etiqueta (ej. Booking)"
        value={values.label}
        error={errors.label}
        onChange={(v) => setValues({ ...values, label: v })}
      />
      <TextField
        id={`ical-url-${unitId}`}
        label="URL del feed iCal"
        value={values.url}
        error={errors.url ?? errors.unitId}
        onChange={(v) => setValues({ ...values, url: v })}
      />
      <div className="sm:col-span-2">
        <button type="submit" className="btn-filled" disabled={pending}>
          {pending ? "Guardando…" : "Agregar fuente"}
        </button>
      </div>
    </form>
  );
}
