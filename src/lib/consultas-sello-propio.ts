import { cache } from "react";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  MODALIDADES_POR_TIPO,
  tipoDeModalidad,
  type TipoSelloPropio,
} from "@/lib/sello-propio";

/**
 * Lo que se publica de Modo Feria: la propuesta tiene que estar publicada
 * y el feriante aprobado. Lo segundo es por el botón de WhatsApp: el número de
 * una ficha que no está aprobada no se muestra en ningún lado del sitio, y
 * tampoco acá.
 */
const PUBLICAS: Prisma.PropuestaSelloPropioWhereInput = {
  publicada: true,
  vendedor: { estado: "APROBADO" },
};

const SELECCION_PUBLICA = {
  id: true,
  modalidad: true,
  titulo: true,
  descripcion: true,
  imagen: true,
  precio: true,
  precioUnidad: true,
  minimo: true,
  capacidad: true,
  anticipacion: true,
  vendedor: {
    select: {
      id: true,
      slug: true,
      emprendimiento: true,
      whatsapp: true,
      // Las ferias en las que está habilitado, que es lo que pedía la
      // convocatoria: «nombre del emprendimiento y feria en la que participan».
      postulaciones: {
        where: { estado: "ACEPTADA", feria: { activa: true } },
        select: { feria: { select: { nombre: true, slug: true } } },
        orderBy: { feria: { nombre: "asc" } },
      },
    },
  },
} satisfies Prisma.PropuestaSelloPropioSelect;

export type PropuestaPublica = Prisma.PropuestaSelloPropioGetPayload<{
  select: typeof SELECCION_PUBLICA;
}>;

/** Las propuestas publicadas de un tipo, las más nuevas primero. */
export async function propuestasPublicadas(
  tipo: TipoSelloPropio,
): Promise<PropuestaPublica[]> {
  return prisma.propuestaSelloPropio.findMany({
    where: { ...PUBLICAS, modalidad: { in: MODALIDADES_POR_TIPO[tipo] } },
    orderBy: { creadoEn: "desc" },
    select: SELECCION_PUBLICA,
  });
}

/**
 * Los tipos que tienen algo publicado. Lo usa Migue: si no hay nada, no manda
 * a nadie a Modo Feria. Con `cache` se consulta una vez por pedido.
 */
export const tiposConPropuestas = cache(
  async (): Promise<TipoSelloPropio[]> => {
    const grupos = await prisma.propuestaSelloPropio.groupBy({
      by: ["modalidad"],
      where: PUBLICAS,
    });
    const tipos = new Set(
      grupos.map((grupo) => tipoDeModalidad(grupo.modalidad)),
    );
    return (["REGALO", "SERVICIO"] as const).filter((tipo) => tipos.has(tipo));
  },
);

/** Las últimas publicadas, de los dos tipos: las de la portada. */
export async function ultimasPropuestas(
  limite: number,
): Promise<PropuestaPublica[]> {
  return prisma.propuestaSelloPropio.findMany({
    where: PUBLICAS,
    orderBy: { creadoEn: "desc" },
    take: limite,
    select: SELECCION_PUBLICA,
  });
}
