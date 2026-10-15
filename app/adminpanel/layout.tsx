import type { Metadata } from "next";

// RF-33: el panel no se indexa. (El portal público no enlaza a esta ruta.)
export const metadata: Metadata = {
  title: "Panel de administración",
  robots: "noindex",
};

export default function AdminLayout({ children }: LayoutProps<"/adminpanel">) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
