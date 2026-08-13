import Link from "next/link";
import type { ReactNode } from "react";

import { cerrarSesion } from "@/actions/auth";
import {
  NavegacionFeriante,
  type PestaniaFeriante,
} from "@/components/vendedor/navegacion-feriante";
import { Badge } from "@/components/ui/badge";
import { IconoEnlaceExterno, IconoSalir } from "@/components/ui/iconos";
import { LogoMunicipal } from "@/components/ui/logo-municipal";
import { ESTADOS_VENDEDOR, TONO_ESTADO_VENDEDOR } from "@/lib/labels";
import { obtenerVendedorActual } from "@/lib/session";

export const metadata = {
  title: {
    default: "Mi stand",
    template: "%s · Mi stand",
  },
  robots: { index: false, follow: false },
};

export default async function LayoutMiStand({
  children,
}: {
  children: ReactNode;
}) {
  const { vendedor } = await obtenerVendedorActual();
  const aprobado = vendedor.estado === "APROBADO";

  // Las secciones de vidriera sólo tienen sentido una vez aprobada la solicitud.
  const pestanias: PestaniaFeriante[] = [
    { href: "/mi-stand", texto: "Resumen" },
    ...(aprobado
      ? [
          { href: "/mi-stand/perfil", texto: "Mi vidriera" },
          { href: "/mi-stand/productos", texto: "Catálogo" },
          { href: "/mi-stand/canon", texto: "Canon" },
        ]
      : []),
  ];

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMunicipal tamanio="sm" />
            <Badge
              tono={TONO_ESTADO_VENDEDOR[vendedor.estado]}
              tamanio="sm"
              className="hidden sm:inline-flex"
            >
              {ESTADOS_VENDEDOR[vendedor.estado]}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {aprobado && (
              <Link
                href={`/stands/${vendedor.slug}`}
                target="_blank"
                className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
              >
                Ver mi stand
                <IconoEnlaceExterno className="size-4" />
              </Link>
            )}

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

        <div className="mx-auto max-w-6xl border-t border-slate-100 px-4 sm:px-6 lg:px-8">
          <NavegacionFeriante pestanias={pestanias} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
