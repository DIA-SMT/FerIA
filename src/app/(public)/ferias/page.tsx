import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EsqueletoGrilla } from "@/components/public/esqueleto-grilla";
import { EncabezadoFerias } from "@/components/public/encabezado-ferias";
import { TarjetaFeria } from "@/components/public/tarjeta-feria";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoTienda } from "@/components/ui/iconos";
import { feriasConProximaEdicion, ordenarPorRelevancia } from "@/lib/consultas";
import { aOpciones, CATEGORIAS_FERIA } from "@/lib/labels";
import type { CategoriaFeria } from "@prisma/client";

export const metadata: Metadata = {
  title: "Ferias",
  description:
    "Todas las ferias municipales de San Miguel de Tucumán: artesanías, emprendedores, gastronomía y productos regionales.",
};

const CATEGORIAS_VALIDAS = new Set(Object.keys(CATEGORIAS_FERIA));

export default function PaginaFerias({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  // El esqueleto de carga va acá y no en un `loading.tsx` del grupo: colgado
  // del grupo envolvía también las fichas de feria y de stand, y ahí el límite
  // de streaming se comía el código 404 — ver el comentario largo en
  // src/components/public/esqueleto-grilla.tsx. Esta pantalla nunca llama a
  // `notFound()`, así que acá el límite no hace daño.
  return (
    <Suspense fallback={<EsqueletoGrilla />}>
      <ContenidoFerias searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoFerias({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const params = await searchParams;
  const categoria =
    params.categoria && CATEGORIAS_VALIDAS.has(params.categoria)
      ? (params.categoria as CategoriaFeria)
      : undefined;

  // Se traen todas y se filtra acá: son una decena, y así una sola consulta
  // dice también qué categorías tienen ferias, para no ofrecer un filtro que
  // lleva a una página vacía.
  const todas = await feriasConProximaEdicion();
  const categorias = aOpciones(CATEGORIAS_FERIA)
    .map((opcion) => opcion.valor as CategoriaFeria)
    .filter((valor) => todas.some((feria) => feria.categoria === valor));
  const ordenadas = ordenarPorRelevancia(
    categoria ? todas.filter((feria) => feria.categoria === categoria) : todas,
  );

  const enCurso = ordenadas.filter(
    (feria) => feria.proximaEdicion?.estado === "EN_CURSO",
  ).length;

  return (
    <div>
      <EncabezadoFerias
        categorias={categorias}
        activa={categoria}
        enCurso={enCurso}
      />

      <div className="mx-auto max-w-7xl px-4 pt-8 pb-10 sm:px-6 lg:px-8">
        {ordenadas.length === 0 ? (
          <EstadoVacio
            icono={IconoTienda}
            className="mt-2"
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
