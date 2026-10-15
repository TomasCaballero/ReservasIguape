"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  phone: string; // número completo, con prefijo
  pending: boolean;
  onConfirm: () => void;
  onBack: () => void;
};

/** RF-24: confirmación con el teléfono completo y el aviso de contacto por WhatsApp. */
export function ConfirmDialog({ open, phone, pending, onConfirm, onBack }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault(); // Esc equivale a "Volver"
        if (!pending) onBack();
      }}
      className="m-auto w-[min(32rem,calc(100%-2rem))] border border-primary bg-background p-6 text-text backdrop:bg-black/70"
    >
      <h2 id="confirm-title" className="text-2xl">
        Confirmá tu número
      </h2>
      <p className="mt-4">Te vamos a contactar por WhatsApp al número:</p>
      <p className="mt-2 text-2xl" data-testid="confirm-phone">
        {phone}
      </p>
      <p className="mt-4">
        Un empleado de Iguapé Aparts te escribirá a ese número para enviarte el método de pago.
        Verificá que sea correcto.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="btn-filled" disabled={pending} onClick={onConfirm}>
          {pending ? "Enviando…" : "Confirmar"}
        </button>
        <button type="button" className="btn-outlined" disabled={pending} onClick={onBack}>
          Volver
        </button>
      </div>
    </dialog>
  );
}
