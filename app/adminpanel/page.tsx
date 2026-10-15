import { AdminShell } from "@/components/admin/AdminShell";
import { LoginForm } from "@/components/admin/LoginForm";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

// `/adminpanel` muestra el login; con sesión iniciada, el panel.
export default async function AdminHome() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-4 py-16">
        <div>
          <p className="caption-text">Iguapé Aparts</p>
          <h1 className="mt-2 text-4xl">Panel de administración</h1>
        </div>
        <LoginForm />
      </main>
    );
  }

  return (
    <AdminShell email={admin.email} title="Bienvenido">
      <p>Elegí una sección en el menú para gestionar el catálogo, las tarifas y los parámetros.</p>
    </AdminShell>
  );
}
