import type { EstadoEdicion, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { hoyEnZona } from "@/lib/format";

/**
 * Consultas compartidas entre el market público y los paneles.
 *
 * Criterio general del market: sólo se muestran feriantes APROBADOS y
 * ediciones que el municipio publicó.
 *
 * Sobre la edición hay DOS preguntas distintas, y antes las dos se contestaban
 * con la misma columna:
 *
 * · ¿Se publica? Es una decisión municipal, la toma alguien y por eso se
 *   guarda: `EdicionFeria.estado`.
 * · ¿Está en curso, es próxima o ya terminó? Eso lo contestan las fechas. No se
 *   guarda, se deriva —igual que el estado del permiso de canon, ver
 *   `src/lib/canon.ts`— porque a `estado` no lo transiciona ningún proceso: el
 *   único lugar que lo escribe es el select del formulario de admin. Una
 *   edición cargada como EN_CURSO mostraba el cartel verde semanas antes de
 *   empezar, y la que de verdad arrancaba hoy se quedaba en PUBLICADA hasta que
 *   alguien se acordara de entrar al panel a cambiarla.
 */

/**
 * Ediciones visibles para los vecinos.
 *
 * `EN_CURSO` sigue en la lista porque hay filas cargadas con ese valor y, como
 * decisión de publicación, dice lo mismo que `PUBLICADA`: esta edición se
 * muestra. Si además está pasando hoy ya no se lee de acá: sale de las fechas.
 */
export const EDICIONES_PUBLICAS: Prisma.EdicionFeriaWhereInput = {
  estado: { in: ["PUBLICADA", "EN_CURSO"] },
};

/**
 * Ediciones vigentes: publicadas y que todavía no terminaron.
 *
 * `hoy` es opcional para que quien ya lo calculó use el mismo valor al filtrar
 * y al derivar la etapa, y no queden en distinto día si la consulta cae justo
 * en la medianoche de Tucumán.
 */
export function edicionesVigentes(
  hoy: Date = hoyEnZona(),
): Prisma.EdicionFeriaWhereInput {
  return {
    ...EDICIONES_PUBLICAS,
    fechaFin: { gte: hoy },
  };
}

/** En qué momento de su vida está una edición. Se deriva, no se guarda. */
export type EtapaEdicion = "PROXIMA" | "EN_CURSO" | "FINALIZADA";

/**
 * Etapa de una edición, según las fechas.
 *
 * El criterio es el mismo que comprueba `prisma/refrescar-fechas.ts` al cerrar
 * («abarca hoy»): `fechaInicio <= hoy && fechaFin >= hoy`. Son columnas `DATE`,
 * así que el día de inicio y el de fin cuentan enteros, y `hoy` tiene que venir
 * de `hoyEnZona()` —el día en Tucumán— y no del reloj UTC del servidor.
 */
export function etapaDeEdicion(
  edicion: { fechaInicio: Date; fechaFin: Date },
  hoy: Date = hoyEnZona(),
): EtapaEdicion {
  if (edicion.fechaFin < hoy) return "FINALIZADA";
  if (edicion.fechaInicio > hoy) return "PROXIMA";
  return "EN_CURSO";
}

/**
 * La etapa derivada, dicha con los valores del enum.
 *
 * El resumen de feria lo consumen `TarjetaFeria` y el listado de `/ferias`, que
 * lo tipan como `EstadoEdicion` y preguntan por `EN_CURSO`. Traducir acá hace
 * que esos dos lean la etapa real —la de las fechas— sin cambiarles la forma.
 * Ahí dentro `PUBLICADA` se lee «publicada y todavía no empezó».
 */
const ESTADO_POR_ETAPA: Record<EtapaEdicion, EstadoEdicion> = {
  PROXIMA: "PUBLICADA",
  EN_CURSO: "EN_CURSO",
  FINALIZADA: "FINALIZADA",
};

/**
 * Ferias activas con su próxima edición vigente.
 *
 * Se traen todas las ediciones vigentes de cada feria y se toma la primera:
 * Prisma no permite ordenar la feria por un campo de la relación.
 */
export async function feriasConProximaEdicion(
  filtros?: { categoria?: Prisma.EnumCategoriaFeriaFilter; soloConEdiciones?: boolean },
) {
  const hoy = hoyEnZona();
  const vigentes = edicionesVigentes(hoy);

  const ferias = await prisma.feria.findMany({
    where: {
      activa: true,
      ...(filtros?.categoria ? { categoria: filtros.categoria } : {}),
      ...(filtros?.soloConEdiciones ? { ediciones: { some: vigentes } } : {}),
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
        where: vigentes,
        orderBy: { fechaInicio: "asc" },
        take: 1,
        select: {
          id: true,
          fechaInicio: true,
          fechaFin: true,
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
            // Ya no es la columna: es la etapa de las fechas, traducida al enum
            // para no cambiarle la forma a quien consume este resumen. El
            // `where` descarta las terminadas, así que sólo puede dar
            // «en curso» o «todavía no empezó».
            estado: ESTADO_POR_ETAPA[etapaDeEdicion(edicion, hoy)],
            standsOcupados: edicion._count.stands,
          }
        : null,
    };
  });
}

/**
 * Ordena las ferias dejando primero las que tienen una edición en curso,
 * después las que tienen fecha próxima y al final las que no tienen ninguna.
 *
 * El `estado` que mira acá es el del resumen de `feriasConProximaEdicion`, que
 * ya viene derivado de las fechas: una feria sube al principio porque está
 * pasando hoy, no porque alguien se acordó de marcarla.
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
