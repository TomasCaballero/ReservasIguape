"use client";

import { useState, useTransition } from "react";
import type { Blockers, MutationResult } from "@/lib/admin/catalog";
import type { FieldErrors } from "@/lib/booking/guest-validation";

/** Envía un formulario a una Server Action y deja a mano los errores por campo o el bloqueo. */
export function useSubmit<T>(action: (input: T) => Promise<MutationResult>, onDone: () => void) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [blocked, setBlocked] = useState<{ message: string; blockers: Blockers } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (input: T) =>
    startTransition(async () => {
      const result = await action(input);
      if (result.ok) {
        setErrors({});
        setBlocked(null);
        onDone();
      } else if ("errors" in result) {
        setBlocked(null);
        setErrors(result.errors);
      } else {
        setErrors({});
        setBlocked({ message: result.message, blockers: result.blocked });
      }
    });

  return { errors, blocked, pending, submit };
}
