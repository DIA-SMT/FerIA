"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/cn";
import {
  IconoBandeja,
  IconoCerrar,
  IconoDinero,
  IconoGrafico,
  IconoMenu,
  IconoTienda,
  IconoUsuarios,
} from "@/components/ui/iconos";

interface ItemNavegacion {
  href: string;
  texto: string;
  icono: ComponentType<SVGProps<SVGSVGElement>>;
  /** Cantidad a destacar (ej. solicitudes pendientes). */
  contador?: number;
}

const ICONOS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  panel: IconoGrafico,
  ferias: IconoTienda,
  solicitudes: IconoBandeja,
  feriantes: IconoUsuarios,
  canon: IconoDinero,
};

export interface EntradaMenu {
  href: string;
  texto: string;
  icono: keyof typeof ICONOS;
  contador?: number;
}

function construirItems(entradas: EntradaMenu[]): ItemNavegacion[] {
  return entradas.map((entrada) => ({
    href: entrada.href,
    texto: entrada.texto,
    icono: ICONOS[entrada.icono] ?? IconoGrafico,
    contador: entrada.contador,
  }));
}

function esActivo(ruta: string, href: string): boolean {
  if (href === "/admin") return ruta === "/admin";
  return ruta.startsWith(href);
}

function Enlaces({ items }: { items: ItemNavegacion[] }) {
  const ruta = usePathname();

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const activo = esActivo(ruta, item.href);
        const Icono = item.icono;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              activo
                ? "bg-municipal-500 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icono
              className={cn(
                "size-5 shrink-0",
                activo ? "text-white" : "text-slate-400",
              )}
            />
            <span className="flex-1 truncate">{item.texto}</span>
            {item.contador !== undefined && item.contador > 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  activo
                    ? "bg-white/20 text-white"
                    : "bg-acento-400 text-slate-900",
                )}
              >
                {item.contador}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra lateral fija en escritorio. */
export function BarraLateralAdmin({ entradas }: { entradas: EntradaMenu[] }) {
  return (
    <div className="p-4">
      <Enlaces items={construirItems(entradas)} />
    </div>
  );
}

/** Botón + panel desplegable para pantallas chicas. */
export function MenuAdminMovil({ entradas }: { entradas: EntradaMenu[] }) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();

  useEffect(() => {
    setAbierto(false);
  }, [ruta]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        aria-controls="menu-admin"
        aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        {abierto ? (
          <IconoCerrar className="size-6" />
        ) : (
          <IconoMenu className="size-6" />
        )}
      </button>

      <div
        id="menu-admin"
        hidden={!abierto}
        className="absolute inset-x-0 top-full z-40 border-b border-slate-200 bg-white p-3 shadow-lg"
      >
        <Enlaces items={construirItems(entradas)} />
      </div>
    </div>
  );
}
