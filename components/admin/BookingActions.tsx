"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  assignUnitAction,
  changeStatusAction,
  markPaymentInfoSentAction,
} from "@/app/adminpanel/booking-actions";
import { SelectField } from "@/components/booking/form-fields";
import { STATUS_LABEL, type BookingStatus } from "@/lib/admin/bookings";
import { useSubmit } from "./use-submit";

const VERB: Record<BookingStatus, string> = {
  PENDING: "Volver a Pendiente",
  CONFIRMED: "Confirmar",
  CANCELLED: "Cancelar reserva",
  FINISHED: "Marcar como Finalizada",
};

/** RF-48 a RF-52: transiciones permitidas, asignación de unidad y registro del envío del método de pago. */
export function BookingActions({
  bookingId,
  status,
  allowed,
  units,
  currentUnitId,
  canAssign,
  canMarkSent,
}: {
  bookingId: string;
  status: BookingStatus;
  allowed: BookingStatus[];
  units: { id: string; name: string }[];
  currentUnitId: string | null;
  canAssign: boolean;
  canMarkSent: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const statusForm = useSubmit((to: string) => changeStatusAction(bookingId, to), refresh);
  const assignForm = useSubmit((unitId: string) => assignUnitAction(bookingId, unitId), refresh);
  const sentForm = useSubmit<void>(() => markPaymentInfoSentAction(bookingId), refresh);
  const [unitId, setUnitId] = useState(currentUnitId ?? units[0]?.id ?? "");
  const busy = statusForm.pending || assignForm.pending || sentForm.pending;
  const error = statusForm.errors._form ?? assignForm.errors._form ?? sentForm.errors._form;
  const reactivating = status === "CANCELLED" || status === "FINISHED";

  return (
    <section aria-labelledby="acciones" className="flex flex-col gap-5">
      <h2 id="acciones" className="text-2xl">
        Acciones
      </h2>
      {error && (
        <p role="alert" className="border border-primary p-3" data-testid="action-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {allowed.map((to) => (
          <button
            key={to}
            type="button"
            className={to === "CANCELLED" ? "btn-outlined" : "btn-filled"}
            disabled={busy}
            onClick={() => statusForm.submit(to)}
          >
            {reactivating ? `Reactivar como ${STATUS_LABEL[to]}` : VERB[to]}
          </button>
        ))}
        {allowed.length === 0 && <p>No hay transiciones disponibles.</p>}
      </div>

      {canAssign && (
        <div className="flex max-w-md flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <SelectField
              id="assign-unit"
              label="Unidad asignada"
              value={unitId}
              onChange={setUnitId}
              options={units.map((u) => ({ value: u.id, label: u.name }))}
            />
          </div>
          <button type="button" className="btn-outlined" disabled={busy} onClick={() => assignForm.submit(unitId)}>
            Asignar unidad
          </button>
        </div>
      )}

      {canMarkSent && (
        <div>
          <button type="button" className="btn-outlined" disabled={busy} onClick={() => sentForm.submit()}>
            Registrar envío del método de pago
          </button>
        </div>
      )}
    </section>
  );
}
