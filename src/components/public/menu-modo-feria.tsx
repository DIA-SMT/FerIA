"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { IconoChevronAbajo, IconoChevronDerecha } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

export interface OpcionModoFeria {
  href: string;
  texto: string;
  /** Para quién es, en pocas palabras. */
  detalle: string;
  sello: string;
}

/**
 * «Modo Feria» en el menú de arriba, con sus dos páginas adentro.
 *
 * Se abre al pasar el mouse y también con un clic o con el teclado, que es lo
 * que hay en una pantalla táctil o para quien navega sin mouse. Se cierra al
 * salir, con Escape, con un clic afuera o al ir a otra página.
 */
export function MenuModoFeria({ opciones }: { opciones: OpcionModoFeria[] }) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();
  const contenedor = useRef<HTMLDivElement>(null);
  // Si lo abrió el mouse al pasar, el clic que viene después no lo cierra:
  // sería abrir y cerrar en el mismo gesto.
  const porMouse = useRef(false);

  useEffect(() => {
    setAbierto(false);
  }, [ruta]);

  useEffect(() => {
    if (!abierto) return;
    function afuera(evento: PointerEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }
    function escape(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAbierto(false);
    }
    document.addEventListener("pointerdown", afuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", afuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  const activo = ruta.startsWith("/modo-feria");

  return (
    <div
      ref={contenedor}
      className="relative"
      onPointerEnter={(evento) => {
        if (evento.pointerType !== "mouse") return;
        porMouse.current = true;
        setAbierto(true);
      }}
      onPointerLeave={(evento) => {
        if (evento.pointerType === "mouse") setAbierto(false);
      }}
    >
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls="menu-modo-feria"
        onClick={() => {
          if (abierto && porMouse.current) {
            porMouse.current = false;
            return;
          }
          porMouse.current = false;
          setAbierto((valor) => !valor);
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-50 hover:text-municipal-700",
          activo ? "text-municipal-700" : "text-slate-600",
        )}
      >
        Modo Feria
        <IconoChevronAbajo
          className={cn("size-4 transition-transform", abierto && "rotate-180")}
        />
      </button>

      {/* El `pt-2` es parte de la caja: así el mouse cruza del botón al menú
          sin salir y sin que se cierre en el medio. */}
      <div
        id="menu-modo-feria"
        hidden={!abierto}
        className="absolute top-full left-1/2 z-40 w-80 -translate-x-1/2 pt-2"
      >
        <ul className="rounded-xl border border-slate-200 bg-superficie p-2 shadow-lg">
          {opciones.map((opcion) => (
            <li key={opcion.href}>
              <Link
                href={opcion.href}
                aria-current={ruta === opcion.href ? "page" : undefined}
                className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-50 aria-[current=page]:bg-municipal-50"
              >
                <Image
                  src={opcion.sello}
                  alt=""
                  width={44}
                  height={44}
                  // Sin carga diferida: el menú arranca oculto y, al abrirlo,
                  // los sellos tardaban en aparecer.
                  loading="eager"
                  className="size-11 shrink-0 -rotate-6"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">
                    {opcion.texto}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {opcion.detalle}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-slate-100 pt-1">
            <Link
              href="/modo-feria"
              aria-current={ruta === "/modo-feria" ? "page" : undefined}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium text-municipal-700 transition-colors hover:bg-slate-50"
            >
              Qué es Modo Feria y cómo funciona
              <IconoChevronDerecha className="size-4" />
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
