import { LoginForm } from "@/components/admin/LoginForm";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { logoutAction } from "./actions";

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
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="caption-text">Iguapé Aparts</p>
            <p className="font-display text-2xl">Panel de administración</p>
          </div>
          <form action={logoutAction} className="flex items-center gap-4">
            <span className="text-sm">{admin.email}</span>
            <button type="submit" className="btn-outlined">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="text-3xl">Bienvenido</h1>
        <p className="mt-2">Las secciones del panel se irán habilitando en las próximas etapas.</p>
      </main>
    </>
  );
}
