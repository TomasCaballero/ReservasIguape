"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { anonymizeCustomerAction, requestAnonymizationAction } from "@/app/adminpanel/customer-actions";
import { useSubmit } from "./use-submit";

type Step = "request" | "anonymize";

/** RF-61, RF-62: solicitar y ejecutar la anonimización, cada una con confirmación en dos pasos (sin diálogos del navegador). */
export function AnonymizeActions({
  customerId,
  hasPending,
  activeBookings,
}: {
  customerId: string;
  hasPending: boolean;
  activeBookings: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Step | null>(null);
  const done = () => {
    setConfirming(null);
    router.refresh();
  };
  const request = useSubmit<void>(() => requestAnonymizationAction(customerId), done);
  const anonymize = useSubmit<void>(() => anonymizeCustomerAction(customerId), done);
  const pending = request.pending || anonymize.pending;
  const error = request.errors._form ?? anonymize.errors._form;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="border border-primary p-3">
          {error}
        </p>
      )}
      {confirming === null ? (
        <div className="flex flex-wrap gap-3">
          {!hasPending && (
            <button type="button" className="btn-outlined" onClick={() => setConfirming("request")}>
              Solicitar anonimización
            </button>
          )}
          <button type="button" className="btn-outlined" onClick={() => setConfirming("anonymize")}>
            Anonimizar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p>
            {confirming === "request"
              ? "Se registra la solicitud con la fecha de hoy. No se modifica ningún dato todavía."
              : "Se reemplazan los datos personales del cliente y de sus acompañantes. Esta acción no se puede deshacer."}
          </p>
          {confirming === "anonymize" && activeBookings > 0 && (
            <p role="note" className="border border-primary p-3">
              Atención: el cliente tiene {activeBookings} {activeBookings === 1 ? "reserva Pendiente o Confirmada" : "reservas Pendientes o Confirmadas"}{" "}
              sin terminar.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-filled"
              disabled={pending}
              onClick={() => (confirming === "request" ? request.submit() : anonymize.submit())}
            >
              {pending ? "Procesando…" : confirming === "request" ? "Confirmar solicitud" : "Confirmar anonimización"}
            </button>
            <button type="button" className="btn-outlined" disabled={pending} onClick={() => setConfirming(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
