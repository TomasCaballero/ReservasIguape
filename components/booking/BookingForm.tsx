"use client";

import { useState, type FormEvent } from "react";
import { COUNTRIES } from "@/lib/booking/countries";
import { formatDMY, type ISODate } from "@/lib/booking/dates";
import {
  normalizeDocument,
  validateCompanions,
  validateHolder,
  type CompanionInput,
  type DocumentType,
  type FieldErrors,
  type HolderInput,
} from "@/lib/booking/guest-validation";
import type { Quote } from "@/lib/booking/pricing";
import { formatDiscount, formatMoney, formatNights } from "@/lib/format";
import { ConfirmDialog } from "./ConfirmDialog";
import { dmyToISO, maskDMY, SelectField, TextField } from "./form-fields";

export type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  documentType: DocumentType;
  documentNumber: string;
  birthDate: string; // dd/mm/aaaa
};

export type CompanionValues = {
  key: number;
  firstName: string;
  lastName: string;
  documentNumber: string;
  birthDate: string; // dd/mm/aaaa
};

export const EMPTY_FORM: FormValues = {
  firstName: "",
  lastName: "",
  email: "",
  countryCode: "AR",
  phoneNumber: "",
  documentType: "DNI",
  documentNumber: "",
  birthDate: "",
};

export type SubmitPayload = { holder: HolderInput; companions: CompanionInput[] };

export type SubmitOutcome =
  | { kind: "ok"; reference: string }
  | { kind: "unavailable"; message: string }
  | { kind: "fieldErrors"; errors: FieldErrors }
  | { kind: "error"; message: string };

type Props = {
  today: ISODate;
  summary: {
    categoryName: string;
    checkIn: ISODate;
    checkOut: ISODate;
    nights: number;
    guestsText: string;
    quote: Quote;
  };
  values: FormValues;
  companions: CompanionValues[];
  maxCompanions: number;
  onValuesChange: (values: FormValues) => void;
  onCompanionsChange: (companions: CompanionValues[]) => void;
  onBack: () => void;
  submit: (payload: SubmitPayload) => Promise<SubmitOutcome>;
};

const idFor = (key: string) => {
  const m = /^companions\.(\d+)\.(\w+)$/.exec(key);
  return m ? `companion-${m[1]}-${m[2]}` : `holder-${key}`;
};

/** Formulario del titular y acompañantes (RF-17 a RF-24). */
export function BookingForm({
  today,
  summary,
  values,
  companions,
  maxCompanions,
  onValuesChange,
  onCompanionsChange,
  onBack,
  submit,
}: Props) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const country = COUNTRIES.find((c) => c.code === values.countryCode) ?? COUNTRIES[0];
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    onValuesChange({ ...values, [key]: value });

  const payload = (): SubmitPayload => ({
    holder: {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phonePrefix: country.prefix,
      phoneNumber: values.phoneNumber,
      documentType: values.documentType,
      documentNumber: normalizeDocument(values.documentType, values.documentNumber),
      birthDate: dmyToISO(values.birthDate),
    },
    companions: companions.map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      documentNumber: c.documentNumber,
      birthDate: dmyToISO(c.birthDate),
    })),
  });

  const showErrors = (next: FieldErrors) => {
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) document.getElementById(idFor(first))?.focus();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormAlert(null);
    const p = payload();
    const found = { ...validateHolder(p.holder, today), ...validateCompanions(p.companions, today) };
    if (Object.keys(found).length > 0) {
      showErrors(found); // AC-26: no se abre el modal ni se crea la reserva
      return;
    }
    setErrors({});
    setDialogOpen(true); // AC-35: todavía no existe la reserva
  };

  const handleConfirm = async () => {
    setPending(true);
    const outcome = await submit(payload());
    setPending(false);
    if (outcome.kind === "ok") return; // el padre muestra la pantalla final
    setDialogOpen(false); // los datos del formulario se conservan (AC-40)
    if (outcome.kind === "fieldErrors") showErrors(outcome.errors);
    else setFormAlert(outcome.message);
  };

  const updateCompanion = (key: number, patch: Partial<CompanionValues>) =>
    onCompanionsChange(companions.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const nextKey = companions.reduce((max, c) => Math.max(max, c.key + 1), 0);
  const { quote } = summary;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
        <div>
          <h2 className="text-2xl">Datos del titular</h2>
          <p className="mt-1">Todos los campos son obligatorios.</p>
        </div>

        {formAlert && (
          <div role="alert" className="border border-primary p-3" data-testid="form-alert">
            <p>{formAlert}</p>
            <button type="button" className="btn-outlined mt-3" onClick={onBack}>
              Volver a la búsqueda
            </button>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="holder-firstName" label="Nombre" value={values.firstName} error={errors.firstName} autoComplete="given-name" onChange={(v) => set("firstName", v)} />
          <TextField id="holder-lastName" label="Apellido" value={values.lastName} error={errors.lastName} autoComplete="family-name" onChange={(v) => set("lastName", v)} />
          <div className="sm:col-span-2">
            <TextField id="holder-email" label="Email" type="email" inputMode="email" autoComplete="email" value={values.email} error={errors.email} onChange={(v) => set("email", v)} />
          </div>

          <SelectField
            id="holder-phonePrefix"
            label="País del teléfono"
            value={values.countryCode}
            error={errors.phonePrefix}
            onChange={(v) => set("countryCode", v)}
            options={COUNTRIES.map((c) => ({ value: c.code, label: `${c.name} (${c.prefix})` }))}
          />
          <TextField
            id="holder-phoneNumber"
            label="Teléfono (sin prefijo)"
            inputMode="tel"
            autoComplete="tel-national"
            value={values.phoneNumber}
            error={errors.phoneNumber}
            onChange={(v) => set("phoneNumber", v)}
            prefix={
              <span className="flex items-center border border-border px-3" data-testid="phone-prefix">
                {country.prefix}
              </span>
            }
          />

          <SelectField
            id="holder-documentType"
            label="Tipo de documento"
            value={values.documentType}
            error={errors.documentType}
            onChange={(v) => set("documentType", v as DocumentType)}
            options={[
              { value: "DNI", label: "DNI" },
              { value: "PASSPORT", label: "Pasaporte" },
            ]}
          />
          <TextField id="holder-documentNumber" label="Número de documento" autoComplete="off" value={values.documentNumber} error={errors.documentNumber} onChange={(v) => set("documentNumber", v)} />

          <TextField
            id="holder-birthDate"
            label="Fecha de nacimiento"
            inputMode="numeric"
            autoComplete="off"
            placeholder="dd/mm/aaaa"
            maxLength={10}
            value={values.birthDate}
            error={errors.birthDate}
            onChange={(v) => set("birthDate", maskDMY(v))}
          />
        </div>

        <section aria-labelledby="companions-title" className="flex flex-col gap-5">
          <div>
            <h2 id="companions-title" className="text-2xl">
              Acompañantes
            </h2>
            <p className="mt-1">Opcional. Podés cargar hasta {maxCompanions}.</p>
          </div>

          {companions.map((c, i) => (
            <fieldset key={c.key} className="grid gap-5 border border-border p-4 sm:grid-cols-2">
              <legend className="caption-text px-2">Acompañante {i + 1}</legend>
              <TextField id={`companion-${i}-firstName`} label="Nombre" value={c.firstName} error={errors[`companions.${i}.firstName`]} onChange={(v) => updateCompanion(c.key, { firstName: v })} />
              <TextField id={`companion-${i}-lastName`} label="Apellido" value={c.lastName} error={errors[`companions.${i}.lastName`]} onChange={(v) => updateCompanion(c.key, { lastName: v })} />
              <TextField id={`companion-${i}-documentNumber`} label="Documento" autoComplete="off" value={c.documentNumber} error={errors[`companions.${i}.documentNumber`]} onChange={(v) => updateCompanion(c.key, { documentNumber: v })} />
              <TextField id={`companion-${i}-birthDate`} label="Fecha de nacimiento" inputMode="numeric" autoComplete="off" placeholder="dd/mm/aaaa" maxLength={10} value={c.birthDate} error={errors[`companions.${i}.birthDate`]} onChange={(v) => updateCompanion(c.key, { birthDate: maskDMY(v) })} />
              <div className="sm:col-span-2">
                <button type="button" className="btn-outlined" onClick={() => onCompanionsChange(companions.filter((x) => x.key !== c.key))}>
                  Quitar acompañante {i + 1}
                </button>
              </div>
            </fieldset>
          ))}

          {companions.length < maxCompanions && (
            <div>
              <button
                type="button"
                className="btn-outlined"
                onClick={() =>
                  onCompanionsChange([
                    ...companions,
                    { key: nextKey, firstName: "", lastName: "", documentNumber: "", birthDate: "" },
                  ])
                }
              >
                Agregar acompañante
              </button>
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-filled">
            Continuar
          </button>
          <button type="button" className="btn-outlined" onClick={onBack}>
            Volver a la búsqueda
          </button>
        </div>
      </form>

      <aside aria-labelledby="summary-title" className="h-fit border border-border bg-background-card p-5">
        <h2 id="summary-title" className="text-2xl">
          Tu estadía
        </h2>
        <p className="mt-3 text-xl">{summary.categoryName}</p>
        <p className="mt-1">
          {formatDMY(summary.checkIn)} – {formatDMY(summary.checkOut)}
        </p>
        <p>{formatNights(summary.nights)}</p>
        <p>{summary.guestsText}</p>
        <dl className="mt-4">
          {quote.discountPercent > 0 && (
            <>
              <div className="flex justify-between gap-4">
                <dt>Subtotal</dt>
                <dd>{formatMoney(quote.subtotal, quote.currency)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Descuento ({quote.discountPercent}%)</dt>
                <dd>{formatDiscount(quote.discountAmount, quote.currency)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-4 text-xl">
            <dt>Total</dt>
            <dd>{formatMoney(quote.total, quote.currency)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm">
          Reservamos tu apart por 15 minutos mientras completás los datos. No se cobra nada online.
        </p>
      </aside>

      <ConfirmDialog
        open={dialogOpen}
        phone={`${country.prefix} ${values.phoneNumber.trim()}`}
        pending={pending}
        onConfirm={handleConfirm}
        onBack={() => setDialogOpen(false)}
      />
    </div>
  );
}
