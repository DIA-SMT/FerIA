import type { Prisma } from "@prisma/client";
import Link from "next/link";

import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { FiltrosRevisiones } from "@/components/admin/filtros-revisiones";
import { RevisionDeCambio } from "@/components/admin/revision-de-cambio";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoEnlaceExterno, IconoTildeCirculo } from "@/components/ui/iconos";
import { prisma } from "@/lib/db";
import { tipoDelCambio } from "@/lib/revision";
import { requerirAdmin } from "@/lib/session";
import {
  esTipoDeCambio,
  SIN_FERIA,
  TIPOS_DE_CAMBIO,
  type TipoDeCambio,
} from "@/lib/tipos-de-cambio";

export const metadata = { title: "Revisiones" };

/**
 * Todo lo que los feriantes cambiaron en su stand y espera aprobación.
 *
 * Nada se publica sin pasar por acá (ver `src/lib/revision.ts`): la portada,
 * el logo, el nombre, la descripción, el contacto y cada producto. Los cambios
 * van agrupados por feriante, del que espera hace más tiempo al más nuevo, y
 * cada uno muestra lo que se ve hoy al lado de lo propuesto.
 *
 * Se filtra por tipo de cambio y por feria. La feria es la de las
 * postulaciones aceptadas del feriante —donde está habilitado—, así cada
 * equipo puede revisar sólo lo de su feria.
 */
export default async function PaginaRevisiones({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; feria?: string }>;
}) {
  await requerirAdmin();
  const parametros = await searchParams;

  const ferias = await prisma.feria.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
    select: { id: true, slug: true, nombre: true },
  });

  // Un valor que no existe —una feria que se dio de baja, un enlace viejo— no
  // se da por elegido: se muestra todo, como si no hubiera filtro.
  const feria = ferias.find((opcion) => opcion.slug === parametros.feria);
  const sinFeria = parametros.feria === SIN_FERIA;
  const tipo: TipoDeCambio | "" =
    parametros.tipo && esTipoDeCambio(parametros.tipo) ? parametros.tipo : "";

  const deLaFeria: Prisma.CambioDelStandWhereInput = feria
    ? {
        vendedor: {
          postulaciones: { some: { feriaId: feria.id, estado: "ACEPTADA" } },
        },
      }
    : sinFeria
      ? { vendedor: { postulaciones: { none: { estado: "ACEPTADA" } } } }
      : {};

  const pendientes = await prisma.cambioDelStand.findMany({
    where: { estado: "PENDIENTE", ...deLaFeria },
    orderBy: { actualizadoEn: "asc" },
    select: {
      id: true,
      seccion: true,
      datos: true,
      actualizadoEn: true,
      producto: {
        select: {
          nombre: true,
          descripcion: true,
          imagenes: true,
          destacado: true,
        },
      },
      propuesta: {
        select: {
          modalidad: true,
          titulo: true,
          descripcion: true,
          imagen: true,
          precio: true,
          precioUnidad: true,
          minimo: true,
          capacidad: true,
          anticipacion: true,
        },
      },
      vendedor: {
        select: {
          id: true,
          slug: true,
          emprendimiento: true,
          rubro: true,
          descripcion: true,
          imagenPortada: true,
          logo: true,
          whatsapp: true,
          telefono: true,
          email: true,
          instagram: true,
          facebook: true,
          sitioWeb: true,
          direccion: true,
          postulaciones: {
            where: { estado: "ACEPTADA" },
            select: { feria: { select: { nombre: true } } },
          },
        },
      },
    },
  });

  // Los conteos por tipo son los de la feria elegida, sin el filtro de tipo:
  // así cada pastilla dice cuántos hay de lo suyo.
  const conTipo = pendientes.map((cambio) => ({
    ...cambio,
    tipo: tipoDelCambio(cambio.seccion, cambio.datos),
  }));
  const conteos: Partial<Record<TipoDeCambio, number>> = {};
  for (const cambio of conTipo) {
    conteos[cambio.tipo] = (conteos[cambio.tipo] ?? 0) + 1;
  }
  const visibles = tipo
    ? conTipo.filter((cambio) => cambio.tipo === tipo)
    : conTipo;

  // Agrupados por feriante, en el orden del cambio más viejo de cada uno.
  const porFeriante = new Map<string, typeof visibles>();
  for (const cambio of visibles) {
    const lista = porFeriante.get(cambio.vendedor.id) ?? [];
    lista.push(cambio);
    porFeriante.set(cambio.vendedor.id, lista);
  }

  const hayFiltros = Boolean(tipo || feria || sinFeria);

  return (
    <>
      <EncabezadoPagina
        titulo="Revisiones"
        descripcion="Lo que los feriantes cambiaron en su stand. Nada se publica hasta que lo aprobás; si lo rechazás, el feriante ve el motivo y lo puede corregir."
      />

      <FiltrosRevisiones
        tipo={tipo}
        feria={feria?.slug ?? (sinFeria ? SIN_FERIA : "")}
        conteos={conteos}
        total={pendientes.length}
        tipos={TIPOS_DE_CAMBIO}
        ferias={ferias.map(({ slug, nombre }) => ({ slug, nombre }))}
      />

      {visibles.length === 0 ? (
        <EstadoVacio
          icono={IconoTildeCirculo}
          titulo={
            hayFiltros
              ? "No hay nada para revisar con estos filtros"
              : "No hay nada para revisar"
          }
          descripcion={
            hayFiltros
              ? "Probá con otro tipo de cambio u otra feria."
              : "Cuando un feriante cambie algo de su stand, agregue un producto o sume una propuesta a Modo Feria, va a aparecer acá."
          }
          accion={
            hayFiltros ? (
              <Link
                href="/admin/revisiones"
                className="text-sm font-medium text-municipal-600 hover:text-municipal-700"
              >
                Ver todo
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {[...porFeriante.values()].map((lista) => {
            const stand = lista[0]!.vendedor;
            const suyas = stand.postulaciones.map((p) => p.feria.nombre);
            return (
              <section key={stand.id} className="space-y-3">
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      nombre={stand.emprendimiento}
                      imagen={stand.logo}
                      tamanio="sm"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-slate-900">
                        {stand.emprendimiento}
                      </h2>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
                        <span>
                          {lista.length === 1
                            ? "1 cambio para revisar"
                            : `${lista.length} cambios para revisar`}
                        </span>
                        {suyas.map((nombre) => (
                          <Badge key={nombre} tono="celeste" tamanio="sm">
                            {nombre}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/stands/${stand.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-municipal-600 hover:text-municipal-700"
                  >
                    Ver el stand publicado
                    <IconoEnlaceExterno className="size-4" />
                  </Link>
                </header>

                {lista.map((cambio) => (
                  <RevisionDeCambio
                    key={cambio.id}
                    cambio={cambio}
                    stand={stand}
                    producto={cambio.producto}
                    propuesta={cambio.propuesta}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
