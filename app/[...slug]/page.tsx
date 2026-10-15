import { redirect } from "next/navigation";

// RF-30: cualquier ruta inexistente redirige a `/`. Las rutas reales
// (`/`, `/adminpanel`, `/api/...`) tienen prioridad sobre este catch-all.
export default function CatchAll() {
  redirect("/");
}
