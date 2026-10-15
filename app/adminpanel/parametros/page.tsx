import { AdminShell } from "@/components/admin/AdminShell";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { requireAdmin } from "@/lib/auth/current-admin";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const s = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });

  return (
    <AdminShell email={admin.email} title="Parámetros del sistema">
      <SettingsForm
        initial={{
          pendingNoticeHours: String(s.pendingNoticeHours),
          pendingExpiryDays: String(s.pendingExpiryDays),
          maxNights: String(s.maxNights),
          maxAdvanceMonths: String(s.maxAdvanceMonths),
          anonymizationDays: String(s.anonymizationDays),
        }}
      />
    </AdminShell>
  );
}
