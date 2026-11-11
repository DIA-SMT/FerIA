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

/**
 * Anterior, números y siguiente, con links comunes.
 *
 * Links y no botones: cada página tiene su URL, así que se puede compartir,
 * abrir en otra pestaña y volver con el botón de atrás. Con una sola página no
 * se dibuja nada.
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

  const base =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-medium ring-1 transition-colors";
  const normal =
    "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900";
  const apagado = "bg-white text-slate-300 ring-slate-100";

  return (
    <nav
      aria-label="Páginas"
      className={cn("flex flex-wrap items-center justify-center gap-1.5", className)}
    >
      {pagina > 1 ? (
        <Link href={href(pagina - 1)} className={cn(base, normal)} aria-label="Página anterior">
          <IconoChevronIzquierda className="size-4" />
        </Link>
      ) : (
        <span className={cn(base, apagado)} aria-hidden="true">
          <IconoChevronIzquierda className="size-4" />
        </span>
      )}

      {paginasVisibles(pagina, paginas).map((n, indice) =>
        n === HUECO ? (
          <span key={`hueco-${indice}`} className="px-1 text-sm text-slate-400" aria-hidden="true">
            {HUECO}
          </span>
        ) : (
          <Link
            key={n}
            href={href(n)}
            aria-current={n === pagina ? "page" : undefined}
            aria-label={`Página ${n}`}
            className={cn(
              base,
              "tabular-nums",
              n === pagina ? "bg-municipal-500 text-white ring-municipal-500" : normal,
            )}
          >
            {n}
          </Link>
        ),
      )}

      {pagina < paginas ? (
        <Link href={href(pagina + 1)} className={cn(base, normal)} aria-label="Página siguiente">
          <IconoChevronDerecha className="size-4" />
        </Link>
      ) : (
        <span className={cn(base, apagado)} aria-hidden="true">
          <IconoChevronDerecha className="size-4" />
        </span>
      )}
    </nav>
  );
}
