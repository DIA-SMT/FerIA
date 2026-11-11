import Link from "next/link";

import { IconoChevronDerecha, IconoChevronIzquierda } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { HUECO, paginasVisibles } from "@/lib/paginacion";

interface PropsPaginacion {
  pagina: number;
  paginas: number;
  /** Ruta del listado, sin parámetros: `/stands`. */
  ruta: string;
  /**
   * Los filtros que tienen que sobrevivir al cambio de página. Los vacíos no
   * se escriben, para que la URL quede limpia.
   */
  parametros?: Record<string, string | undefined>;
  className?: string;
}

const BOTON =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium ring-1 transition-colors sm:h-9 sm:min-w-9 sm:px-2.5";
const NORMAL =
  "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900";
const APAGADO = "bg-white text-slate-300 ring-slate-100";

/**
 * Anterior, números y siguiente, con links comunes.
 *
 * Links y no botones: cada página tiene su URL, así que se puede compartir,
 * abrir en otra pestaña y volver con el botón de atrás. Con una sola página no
 * se dibuja nada.
 *
 * Son dos barras y se ve una sola según el ancho: en el celular, un número a
 * cada lado de la actual y botones de 32 px, para que entre en un renglón; en
 * pantallas más anchas, dos a cada lado. La que no corresponde está con
 * `display: none`, así que tampoco la leen los lectores de pantalla.
 */
export function Paginacion({
  pagina,
  paginas,
  ruta,
  parametros = {},
  className,
}: PropsPaginacion) {
  if (paginas <= 1) return null;

  function href(n: number): string {
    const consulta = new URLSearchParams();
    for (const [clave, valor] of Object.entries(parametros)) {
      if (valor) consulta.set(clave, valor);
    }
    // La primera página no lleva el parámetro: es la misma URL que el listado.
    if (n > 1) consulta.set("pagina", String(n));
    const texto = consulta.toString();
    return texto ? `${ruta}?${texto}` : ruta;
  }

  function barra(vecinos: number) {
    return (
      <>
        {pagina > 1 ? (
          <Link href={href(pagina - 1)} className={cn(BOTON, NORMAL)} aria-label="Página anterior">
            <IconoChevronIzquierda className="size-4" />
          </Link>
        ) : (
          <span className={cn(BOTON, APAGADO)} aria-hidden="true">
            <IconoChevronIzquierda className="size-4" />
          </span>
        )}

        {paginasVisibles(pagina, paginas, vecinos).map((n, indice) =>
          n === HUECO ? (
            <span key={`hueco-${indice}`} className="px-0.5 text-sm text-slate-400" aria-hidden="true">
              {HUECO}
            </span>
          ) : (
            <Link
              key={n}
              href={href(n)}
              aria-current={n === pagina ? "page" : undefined}
              aria-label={`Página ${n}`}
              className={cn(
                BOTON,
                "tabular-nums",
                n === pagina ? "bg-municipal-500 text-white ring-municipal-500" : NORMAL,
              )}
            >
              {n}
            </Link>
          ),
        )}

        {pagina < paginas ? (
          <Link href={href(pagina + 1)} className={cn(BOTON, NORMAL)} aria-label="Página siguiente">
            <IconoChevronDerecha className="size-4" />
          </Link>
        ) : (
          <span className={cn(BOTON, APAGADO)} aria-hidden="true">
            <IconoChevronDerecha className="size-4" />
          </span>
        )}
      </>
    );
  }

  return (
    <nav aria-label="Páginas" className={cn("flex justify-center", className)}>
      <div className="flex flex-wrap items-center justify-center gap-1 sm:hidden">
        {barra(1)}
      </div>
      <div className="hidden flex-wrap items-center justify-center gap-1.5 sm:flex">
        {barra(2)}
      </div>
    </nav>
  );
}
