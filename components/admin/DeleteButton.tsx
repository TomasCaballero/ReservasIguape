"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MutationResult } from "@/lib/admin/catalog";
import { BlockedNotice } from "./BlockedNotice";
import { useSubmit } from "./use-submit";

type Props = {
  label: string; // ej. "Eliminar De Luxe"
  warning?: string; // se muestra al pedir la confirmación
  action: () => Promise<MutationResult>;
};

/** Eliminar en dos pasos (sin diálogos del navegador). Si hay reservas que lo impiden, las lista. */
export function DeleteButton({ label, warning, action }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const { blocked, errors, pending, submit } = useSubmit<void>(action, () => router.refresh());

  if (!confirming) {
    return (
      <button type="button" className="btn-outlined" aria-label={label} onClick={() => setConfirming(true)}>
        Eliminar
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {blocked && <BlockedNotice message={blocked.message} blockers={blocked.blockers} />}
      {errors._form && <p role="alert">{errors._form}</p>}
      {!blocked && <p>{warning ?? "Esta acción no se puede deshacer."}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-filled" disabled={pending} onClick={() => submit()}>
          {pending ? "Eliminando…" : "Confirmar eliminación"}
        </button>
        <button type="button" className="btn-outlined" disabled={pending} onClick={() => setConfirming(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
