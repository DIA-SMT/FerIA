import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { hoyUTC } from "@/lib/format";

/**
 * Consultas compartidas entre el market público y los paneles.
 *
 * Criterio general del market: sólo se muestran feriantes APROBADOS y
 * ediciones PUBLICADA o EN_CURSO (las que están en borrador o finalizadas no
 * son públicas).
 */

/** Ediciones visibles para los vecinos. */
export const EDICIONES_PUBLICAS: Prisma.EdicionFeriaWhereInput = {
  estado: { in: ["PUBLICADA", "EN_CURSO"] },
};

/** Ediciones vigentes: publicadas o en curso, que todavía no terminaron. */
export function edicionesVigentes(): Prisma.EdicionFeriaWhereInput {
  return {
    ...EDICIONES_PUBLICAS,
    fechaFin: { gte: hoyUTC() },
  };
}

/**
 * Ferias activas con su próxima edición vigente.
 *
 * Se traen todas las ediciones vigentes de cada feria y se toma la primera:
 * Prisma no permite ordenar la feria por un campo de la relación.
 */
export async function feriasConProximaEdicion(
  filtros?: { categoria?: Prisma.EnumCategoriaFeriaFilter; soloConEdiciones?: boolean },
) {
  const ferias = await prisma.feria.findMany({
    where: {
      activa: true,
      ...(filtros?.categoria ? { categoria: filtros.categoria } : {}),
      ...(filtros?.soloConEdiciones
        ? { ediciones: { some: edicionesVigentes() } }
        : {}),
    },
    select: {
      id: true,
      slug: true,
      nombre: true,
      descripcion: true,
      categoria: true,
      direccion: true,
      imagen: true,
      ediciones: {
        where: edicionesVigentes(),
        orderBy: { fechaInicio: "asc" },
        take: 1,
        select: {
          id: true,
          fechaInicio: true,
          fechaFin: true,
          estado: true,
          _count: { select: { stands: { where: { vendedorId: { not: null } } } } },
        },
      },
    },
    orderBy: { nombre: "asc" },
  });

  return ferias.map((feria) => {
    const edicion = feria.ediciones[0];
    return {
      id: feria.id,
      slug: feria.slug,
      nombre: feria.nombre,
      descripcion: feria.descripcion,
      categoria: feria.categoria,
      direccion: feria.direccion,
      imagen: feria.imagen,
      proximaEdicion: edicion
        ? {
            fechaInicio: edicion.fechaInicio,
            fechaFin: edicion.fechaFin,
            estado: edicion.estado,
            standsOcupados: edicion._count.stands,
          }
        : null,
    };
  });
}

/**
 * Ordena las ferias dejando primero las que tienen una edición en curso,
 * después las que tienen fecha próxima y al final las que no tienen ninguna.
 */
export function ordenarPorRelevancia<
  T extends {
    proximaEdicion: { fechaInicio: Date; estado: string } | null;
  },
>(ferias: T[]): T[] {
  return [...ferias].sort((a, b) => {
    const enCursoA = a.proximaEdicion?.estado === "EN_CURSO" ? 0 : 1;
    const enCursoB = b.proximaEdicion?.estado === "EN_CURSO" ? 0 : 1;
    if (enCursoA !== enCursoB) return enCursoA - enCursoB;

    if (!a.proximaEdicion && !b.proximaEdicion) return 0;
    if (!a.proximaEdicion) return 1;
    if (!b.proximaEdicion) return -1;

    return (
      a.proximaEdicion.fechaInicio.getTime() -
      b.proximaEdicion.fechaInicio.getTime()
    );
  });
}

/** Feriantes aprobados para el directorio público. */
export async function vendedoresAprobados(filtros?: {
  busqueda?: string;
  rubro?: string;
  feriaSlug?: string;
  limite?: number;
}) {
  const where: Prisma.VendedorWhereInput = { estado: "APROBADO" };

  if (filtros?.busqueda) {
    where.OR = [
      { emprendimiento: { contains: filtros.busqueda, mode: "insensitive" } },
      { descripcion: { contains: filtros.busqueda, mode: "insensitive" } },
      {
        productos: {
          some: { nombre: { contains: filtros.busqueda, mode: "insensitive" } },
        },
      },
    ];
  }

  if (filtros?.rubro) {
    where.rubro = filtros.rubro as Prisma.VendedorWhereInput["rubro"];
  }

  // Participa (con stand asignado) de alguna edición pública de esa feria.
  if (filtros?.feriaSlug) {
    where.stands = {
      some: {
        edicion: {
          ...EDICIONES_PUBLICAS,
          feria: { slug: filtros.feriaSlug },
        },
      },
    };
  }

  const vendedores = await prisma.vendedor.findMany({
    where,
    select: {
      id: true,
      slug: true,
      emprendimiento: true,
      rubro: true,
      descripcion: true,
      imagenPortada: true,
      logo: true,
      _count: { select: { productos: { where: { disponible: true } } } },
    },
    orderBy: { emprendimiento: "asc" },
    ...(filtros?.limite ? { take: filtros.limite } : {}),
  });

  return vendedores.map((vendedor) => ({
    slug: vendedor.slug,
    emprendimiento: vendedor.emprendimiento,
    rubro: vendedor.rubro,
    descripcion: vendedor.descripcion,
    imagenPortada: vendedor.imagenPortada,
    logo: vendedor.logo,
    cantidadProductos: vendedor._count.productos,
  }));
}
