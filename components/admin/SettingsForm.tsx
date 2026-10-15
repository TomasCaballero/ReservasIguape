"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveSettingsAction } from "@/app/adminpanel/catalog-actions";
import { TextField } from "@/components/booking/form-fields";
import { SETTINGS_FIELDS, type SettingsForm as Values, type SettingsKey } from "@/lib/admin/validation";
import { useSubmit } from "./use-submit";

/** RF-46: parámetros del sistema, guardados en la base de datos. */
export function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [saved, setSaved] = useState(false);
  const { errors, pending, submit } = useSubmit(
    (v: Values) => saveSettingsAction(v),
    () => {
      setSaved(true);
      router.refresh();
    },
  );
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    submit(values);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-5" aria-label="Parámetros del sistema">
      {(Object.keys(SETTINGS_FIELDS) as SettingsKey[]).map((key) => (
        <TextField
          key={key}
          id={`setting-${key}`}
          label={SETTINGS_FIELDS[key].label}
          inputMode="numeric"
          value={values[key]}
          error={errors[key]}
          onChange={(v) => setValues({ ...values, [key]: v })}
        />
      ))}
      {saved && (
        <p role="status" className="border border-primary p-3">
          Parámetros guardados.
        </p>
      )}
      <div>
        <button type="submit" className="btn-filled" disabled={pending}>
          {pending ? "Guardando…" : "Guardar parámetros"}
        </button>
      </div>
    </form>
  );
}
