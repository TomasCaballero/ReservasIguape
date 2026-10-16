"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createBlockAction } from "@/app/adminpanel/booking-actions";
import { maskDMY, SelectField, TextField } from "@/components/booking/form-fields";
import { BLOCK_KIND_LABEL } from "@/lib/admin/blocks";
import { useSubmit } from "./use-submit";

type Values = { unitId: string; startDate: string; endDate: string; kind: string; note: string };

/** RF-51: bloqueo manual de una unidad por mantenimiento o uso de propietarios. */
export function BlockForm({ units }: { units: { id: string; name: string; categoryName: string }[] }) {
  const router = useRouter();
  const empty: Values = { unitId: units[0]?.id ?? "", startDate: "", endDate: "", kind: "MAINTENANCE", note: "" };
  const [values, setValues] = useState<Values>(empty);
  const { errors, pending, submit } = useSubmit(createBlockAction, () => {
    setValues(empty);
    router.refresh();
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(values);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-3xl gap-5 sm:grid-cols-2" aria-label="Bloquear unidad">
      <h2 className="text-2xl sm:col-span-2">Bloquear unidad</h2>
      {errors._form && (
        <p role="alert" className="border border-primary p-3 sm:col-span-2" data-testid="block-error">
          {errors._form}
        </p>
      )}
      <SelectField
        id="block-unitId"
        label="Unidad"
        value={values.unitId}
        error={errors.unitId}
        onChange={(v) => setValues({ ...values, unitId: v })}
        options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.categoryName})` }))}
      />
      <SelectField
        id="block-kind"
        label="Motivo"
        value={values.kind}
        error={errors.kind}
        onChange={(v) => setValues({ ...values, kind: v })}
        options={[
          { value: "MAINTENANCE", label: BLOCK_KIND_LABEL.MAINTENANCE },
          { value: "OWNER", label: BLOCK_KIND_LABEL.OWNER },
        ]}
      />
      <TextField
        id="block-startDate"
        label="Desde (dd/mm/aaaa)"
        value={values.startDate}
        error={errors.startDate}
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        onChange={(v) => setValues({ ...values, startDate: maskDMY(v) })}
      />
      <TextField
        id="block-endDate"
        label="Hasta, día de salida (dd/mm/aaaa)"
        value={values.endDate}
        error={errors.endDate}
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        onChange={(v) => setValues({ ...values, endDate: maskDMY(v) })}
      />
      <div className="sm:col-span-2">
        <TextField
          id="block-note"
          label="Nota (opcional)"
          value={values.note}
          error={errors.note}
          maxLength={200}
          onChange={(v) => setValues({ ...values, note: v })}
        />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="btn-filled" disabled={pending || units.length === 0}>
          {pending ? "Guardando…" : "Bloquear"}
        </button>
      </div>
    </form>
  );
}
