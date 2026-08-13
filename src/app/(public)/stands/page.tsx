import type { Metadata } from "next";

import { FiltrosDirectorio } from "@/components/public/filtros-directorio";
import { TarjetaStand } from "@/components/public/tarjeta-stand";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoTienda } from "@/components/ui/iconos";
import { vendedoresAprobados } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { formatearNumero } from "@/lib/format";
import { RUBROS } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Directorio de stands",
  description:
    "Todos los feriantes aprobados de las ferias municipales de San Miguel de Tucumán. Buscá por emprendimiento, rubro o feria.",
};

const RUBROS_VALIDOS = new Set(Object.keys(RUBROS));

export default async function PaginaStands({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rubro?: string; feria?: string }>;
}) {
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const rubro =
    params.rubro && RUBROS_VALIDOS.has(params.rubro) ? params.rubro : "";
  const feriaSlug = params.feria ?? "";

  const [stands, ferias] = await Promise.all([
    vendedoresAprobados({
      busqueda: q || undefined,
      rubro: rubro || undefined,
      feriaSlug: feriaSlug || undefined,
    }),
    prisma.feria.findMany({
      where: { activa: true },
      select: { slug: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  // Si llegó una feria inexistente por la URL, no la damos por seleccionada.
  const feriaValida = ferias.some((feria) => feria.slug === feriaSlug)
    ? feriaSlug
    : "";

  const hayFiltros = Boolean(q || rubro || feriaValida);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Directorio de stands
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Todos los emprendimientos habilitados para participar de las ferias
          municipales. Entrá a cada stand para ver el catálogo y escribirle
          directamente por WhatsApp.
        </p>
      </header>

      <div className="mt-8">
        <FiltrosDirectorio
          valores={{ q, rubro, feria: feriaValida }}
          ferias={ferias}
        />
      </div>

      <p className="mt-6 text-sm text-slate-500" aria-live="polite">
        {stands.length === 0
          ? "Sin resultados"
          : `${formatearNumero(stands.length)} ${
              stands.length === 1 ? "stand" : "stands"
            }`}
      </p>

      {stands.length === 0 ? (
        <EstadoVacio
          icono={IconoTienda}
          className="mt-4"
          titulo={
            hayFiltros
              ? "No encontramos stands con esos filtros"
              : "Todavía no hay stands publicados"
          }
          descripcion={
            hayFiltros
              ? "Probá con otra búsqueda, cambiá el rubro o quitá el filtro de feria."
              : "Los feriantes aprobados por la municipalidad van a aparecer en este directorio."
          }
        />
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stands.map((stand, indice) => (
            <TarjetaStand
              key={stand.slug}
              stand={stand}
              prioridad={indice < 4}
            />
          ))}
        </div>
      )}
    </div>
  );
}
