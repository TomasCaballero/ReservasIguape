import type { Blockers } from "@/lib/admin/catalog";
import { formatDMY } from "@/lib/booking/dates";

const STATUS = { PENDING: "Pendiente", CONFIRMED: "Confirmada" } as const;

/** RF-36, RF-39 (AC-53): las reservas que impiden la operación, con el titular de cada una. */
export function BlockedNotice({ message, blockers }: { message: string; blockers: Blockers }) {
  return (
    <div role="alert" className="border border-primary p-3" data-testid="blocked-notice">
      <p>{message}</p>
      <ul className="mt-2 text-sm">
        {blockers.items.map((b) => (
          <li key={b.reference}>
            #{b.reference} · {formatDMY(b.checkIn)} – {formatDMY(b.checkOut)} · {STATUS[b.status]} ·{" "}
            {b.holderName}
          </li>
        ))}
      </ul>
      {blockers.total > blockers.items.length && (
        <p className="mt-1 text-sm">… y {blockers.total - blockers.items.length} más.</p>
      )}
    </div>
  );
}
