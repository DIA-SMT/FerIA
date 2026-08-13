import Link from "next/link";
import type { ReactNode } from "react";

import { cerrarSesion } from "@/actions/auth";
import {
  BarraLateralAdmin,
  MenuAdminMovil,
  type EntradaMenu,
} from "@/components/admin/navegacion-admin";
import { IconoEnlaceExterno, IconoSalir } from "@/components/ui/iconos";
import { LogoMunicipal } from "@/components/ui/logo-municipal";
import { prisma } from "@/lib/db";
import { requerirAdmin } from "@/lib/session";

export const metadata = {
  title: {
    default: "Panel municipal",
    template: "%s · Panel municipal",
  },
  robots: { index: false, follow: false },
};

export default async function LayoutAdmin({
  children,
}: {
  children: ReactNode;
}) {
  // Doble barrera: el middleware ya filtró, pero las páginas no confían en él.
  const sesion = await requerirAdmin();

  const pendientes = await prisma.vendedor.count({
    where: { estado: "PENDIENTE" },
  });

  const entradas: EntradaMenu[] = [
    { href: "/admin", texto: "Estadísticas", icono: "panel" },
    { href: "/admin/ferias", texto: "Ferias y ediciones", icono: "ferias" },
    {
      href: "/admin/solicitudes",
      texto: "Solicitudes",
      icono: "solicitudes",
      contador: pendientes,
    },
    { href: "/admin/feriantes", texto: "Feriantes", icono: "feriantes" },
    { href: "/admin/canon", texto: "Canon y permisos", icono: "canon" },
  ];

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="relative flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <MenuAdminMovil entradas={entradas} />
            <LogoMunicipal comoEnlace={false} tamanio="sm" />
            <span className="hidden rounded-md bg-municipal-50 px-2 py-1 text-xs font-semibold text-municipal-700 sm:inline">
              Panel municipal
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
            >
              Ver el market
              <IconoEnlaceExterno className="size-4" />
            </Link>

            <span className="hidden max-w-48 truncate text-sm text-slate-500 lg:inline">
              {sesion.nombre}
            </span>

            <form action={cerrarSesion}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <IconoSalir className="size-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[100rem]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block">
          <BarraLateralAdmin entradas={entradas} />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
