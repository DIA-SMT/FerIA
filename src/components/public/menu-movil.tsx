"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { IconoCerrar, IconoMenu } from "@/components/ui/iconos";

interface Enlace {
  href: string;
  texto: string;
}

/** Un enlace, o un grupo con su nombre y sus enlaces (ej. «Modo Feria»). */
export type EntradaMenuMovil = Enlace | { texto: string; hijos: Enlace[] };

interface PropsMenuMovil {
  enlaces: EntradaMenuMovil[];
  /** Bloque de sesión (ingresar / panel + cerrar sesión) armado en el servidor. */
  acciones: React.ReactNode;
}

/** Menú desplegable para pantallas chicas. */
export function MenuMovil({ enlaces, acciones }: PropsMenuMovil) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();

  // Al navegar, el panel se cierra solo.
  useEffect(() => {
    setAbierto(false);
  }, [ruta]);

  // Con el menú abierto, la página de atrás no debe desplazarse.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-expanded={abierto}
        aria-controls="menu-movil"
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
        id="menu-movil"
        hidden={!abierto}
        className={cn(
          "absolute inset-x-0 top-full z-40 border-b border-slate-200 bg-superficie shadow-lg",
        )}
      >
        <nav className="flex flex-col p-3">
          {enlaces.map((entrada) =>
            "hijos" in entrada ? (
              <div key={entrada.texto} className="mt-1">
                <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {entrada.texto}
                </p>
                {entrada.hijos.map((hijo) => (
                  <EnlaceMovil key={hijo.href} enlace={hijo} ruta={ruta} />
                ))}
              </div>
            ) : (
              <EnlaceMovil key={entrada.href} enlace={entrada} ruta={ruta} />
            ),
          )}
        </nav>
        <div className="border-t border-slate-200 p-3">{acciones}</div>
      </div>
    </div>
  );
}

function EnlaceMovil({ enlace, ruta }: { enlace: Enlace; ruta: string }) {
  const activo =
    enlace.href === "/" ? ruta === "/" : ruta.startsWith(enlace.href);

  return (
    <Link
      href={enlace.href}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        activo
          ? "bg-municipal-50 text-municipal-700"
          : "text-slate-700 hover:bg-slate-50",
      )}
    >
      {enlace.texto}
    </Link>
  );
}
