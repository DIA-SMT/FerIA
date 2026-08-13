import type { Metadata } from "next";
import Link from "next/link";

import { TarjetaFeria } from "@/components/public/tarjeta-feria";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoTienda } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { feriasConProximaEdicion, ordenarPorRelevancia } from "@/lib/consultas";
import { aOpciones, CATEGORIAS_FERIA } from "@/lib/labels";
import type { CategoriaFeria } from "@prisma/client";

export const metadata: Metadata = {
  title: "Ferias",
  description:
    "Todas las ferias municipales de San Miguel de Tucumán: artesanías, emprendedores, gastronomía y productos regionales.",
};

const CATEGORIAS_VALIDAS = new Set(Object.keys(CATEGORIAS_FERIA));

export default async function PaginaFerias({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const params = await searchParams;
  const categoria =
    params.categoria && CATEGORIAS_VALIDAS.has(params.categoria)
      ? (params.categoria as CategoriaFeria)
      : undefined;

  const ferias = await feriasConProximaEdicion(
    categoria ? { categoria: { equals: categoria } } : undefined,
  );
  const ordenadas = ordenarPorRelevancia(ferias);

  const enCurso = ordenadas.filter(
    (feria) => feria.proximaEdicion?.estado === "EN_CURSO",
  ).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Ferias municipales
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Ferias itinerantes que la municipalidad organiza en plazas y parques
          de la ciudad. Entrá a cada una para ver las fechas, el horario y qué
          feriantes participan.
        </p>
        {enCurso > 0 && (
          <Badge tono="verde" conPunto className="mt-4">
            {enCurso === 1
              ? "1 feria en curso ahora mismo"
              : `${enCurso} ferias en curso ahora mismo`}
          </Badge>
        )}
      </header>

      {/* Filtro por categoría */}
      <nav
        aria-label="Filtrar por categoría"
        className="mt-8 flex flex-wrap gap-2"
      >
        <Link
          href="/ferias"
          aria-current={!categoria ? "page" : undefined}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors",
            !categoria
              ? "bg-municipal-500 text-white ring-municipal-500"
              : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900",
          )}
        >
          Todas
        </Link>
        {aOpciones(CATEGORIAS_FERIA).map((opcion) => {
          const activa = categoria === opcion.valor;
          return (
            <Link
              key={opcion.valor}
              href={`/ferias?categoria=${opcion.valor}`}
              aria-current={activa ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors",
                activa
                  ? "bg-municipal-500 text-white ring-municipal-500"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {opcion.etiqueta}
            </Link>
          );
        })}
      </nav>

      {ordenadas.length === 0 ? (
        <EstadoVacio
          icono={IconoTienda}
          className="mt-10"
          titulo={
            categoria
              ? "No hay ferias en esa categoría"
              : "Todavía no hay ferias cargadas"
          }
          descripcion={
            categoria
              ? "Probá con otra categoría o mirá todas las ferias disponibles."
              : "Cuando la municipalidad publique las ferias, van a aparecer acá."
          }
          accion={
            categoria ? (
              <Link
                href="/ferias"
                className="text-sm font-medium text-municipal-600 hover:text-municipal-700"
              >
                Ver todas las ferias
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ordenadas.map((feria, indice) => (
            <TarjetaFeria
              key={feria.slug}
              feria={feria}
              prioridad={indice < 3}
            />
          ))}
        </div>
      )}
    </div>
  );
}
