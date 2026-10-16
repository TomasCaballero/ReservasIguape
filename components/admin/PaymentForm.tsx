"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, inputClass, SelectField, TextField } from "@/components/booking/form-fields";
import { PAYMENT_METHODS } from "@/lib/admin/payments";
import type { FieldErrors } from "@/lib/booking/guest-validation";

/** RF-55: registra un cobro con referencia y/o comprobante (PDF, JPG o PNG de hasta 10 MB). */
export function PaymentForm({ bookingId, defaultCurrency }: { bookingId: string; defaultCurrency: "ARS" | "USD" }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = (e.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
    const body = new FormData();
    body.set("amount", amount);
    body.set("currency", currency);
    body.set("method", method);
    body.set("reference", reference);
    if (file) body.set("file", file);

    setPending(true);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/payments`, { method: "POST", body });
      const data = await response.json().catch(() => null);
      if (response.ok) {
        setErrors({});
        setAmount("");
        setReference("");
        setFileKey((k) => k + 1);
        router.refresh();
      } else {
        setErrors(data?.errors ?? { _form: data?.error?.message ?? "No se pudo registrar el cobro" });
      }
    } catch {
      setErrors({ _form: "No se pudo registrar el cobro. Revisá la conexión e intentá de nuevo." });
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-2xl gap-5 sm:grid-cols-2" aria-label="Registrar cobro">
      <h3 className="text-xl sm:col-span-2">Registrar cobro</h3>
      {errors._form && (
        <p role="alert" className="border border-primary p-3 sm:col-span-2">
          {errors._form}
        </p>
      )}
      <TextField id="payment-amount" label="Monto" value={amount} error={errors.amount} inputMode="decimal" onChange={setAmount} />
      <SelectField
        id="payment-currency"
        label="Moneda"
        value={currency}
        error={errors.currency}
        onChange={setCurrency}
        options={[
          { value: "ARS", label: "ARS" },
          { value: "USD", label: "USD" },
        ]}
      />
      <SelectField
        id="payment-method"
        label="Método de pago"
        value={method}
        error={errors.method}
        onChange={setMethod}
        options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
      />
      <TextField
        id="payment-reference"
        label="Referencia (opcional si adjuntás archivo)"
        value={reference}
        error={errors.reference}
        maxLength={200}
        onChange={setReference}
      />
      <div className="sm:col-span-2">
        <Field id="payment-file" label="Comprobante (PDF, JPG o PNG, hasta 10 MB)" error={errors.file}>
          {(a11y) => (
            <input
              key={fileKey}
              {...a11y}
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className={`${inputClass} py-2`}
            />
          )}
        </Field>
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="btn-filled" disabled={pending}>
          {pending ? "Registrando…" : "Registrar cobro"}
        </button>
      </div>
    </form>
  );
}
