"use client";

import { useRouter } from "next/navigation";
import { syncNowAction } from "@/app/adminpanel/ical-actions";
import { useSubmit } from "./use-submit";

/** RF-67: "Sincronizar ahora". */
export function SyncNowButton() {
  const router = useRouter();
  const { errors, pending, submit } = useSubmit<void>(syncNowAction, () => router.refresh());
  return (
    <div className="flex flex-col gap-2">
      <div>
        <button type="button" className="btn-filled" disabled={pending} onClick={() => submit()}>
          {pending ? "Sincronizando…" : "Sincronizar ahora"}
        </button>
      </div>
      {errors._form && (
        <p role="alert" className="border border-primary p-3">
          {errors._form}
        </p>
      )}
    </div>
  );
}
