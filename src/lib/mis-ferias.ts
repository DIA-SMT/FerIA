import { edicionesVigentes, EDICIONES_PUBLICAS } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { formatearFecha, hoyEnZona } from "@/lib/format";

/**
 * Las ferias del feriante y las que le quedan por pedir.
 *
 * Lo usan dos pantallas: «Mis ferias», con el alta aprobada, y «Mi stand»
 * mientras el alta está pendiente o rechazada, que muestran lo mismo —a qué
 * ferias pertenece— aunque no dejen pedir otra.
 */
export async function feriasDelFeriante(vendedorId: string) {
  const postulaciones = await prisma.postulacion.findMany({
    where: { vendedorId },
    orderBy: { creadoEn: "desc" },
    select: {
      id: true,
      estado: true,
      motivoRechazo: true,
      creadoEn: true,
      revisadoEn: true,
      feria: { select: { nombre: true, slug: true } },
    },
  });

  // Sólo las que todavía no pidió: volver a postularse a la misma feria lo
  // resuelve la acción reabriendo la postulación, pero ofrecerlo en la lista
  // haría pensar que son dos pedidos distintos.
  const yaPedidas = postulaciones.map((postulacion) => postulacion.feria.slug);
  const hoy = hoyEnZona();

  const ferias = await prisma.feria.findMany({
    where: { activa: true, slug: { notIn: yaPedidas } },
    select: {
      id: true,
      nombre: true,
      // La próxima edición publicada, que es lo que ordena la lista.
      ediciones: {
        where: edicionesVigentes(hoy),
        orderBy: { fechaInicio: "asc" },
        take: 1,
        select: { fechaInicio: true },
      },
    },
  });

  /*
    Ordenadas por fecha y no alfabéticamente.

    La lista alfabética daba lo mismo mirarla que no mirarla: decidir a qué
    feria pedir depende de cuándo es la próxima, no de con qué letra empieza.
    Una feria sin edición publicada igual se ofrece —estar habilitado en una
    feria no depende de que haya fecha cargada— pero va al final, porque pedirla
    no tiene un horizonte concreto. Entre esas se vuelve al orden alfabético,
    que es lo único que queda para desempatar.

    El orden se arma acá y no con `orderBy` porque es por un campo de la
    relación: Prisma no ordena por el mínimo de una lista anidada, y con pocas
    ferias traerlas y acomodarlas sale más barato que inventar una consulta.
  */
  const disponibles = ferias
    .map((feria) => ({
      id: feria.id,
      nombre: feria.nombre,
      proxima: feria.ediciones[0]?.fechaInicio ?? null,
    }))
    .sort((a, b) => {
      if (a.proxima && b.proxima) {
        return a.proxima.getTime() - b.proxima.getTime();
      }
      if (a.proxima) return -1;
      if (b.proxima) return 1;
      return a.nombre.localeCompare(b.nombre, "es");
    })
    .map((feria) => ({
      id: feria.id,
      nombre: feria.nombre,
      proxima: feria.proxima ? formatearFecha(feria.proxima) : null,
    }));

  return { postulaciones, disponibles };
}

/** Los stands que le asignaron en ediciones publicadas que todavía no terminaron. */
export async function proximasAsignaciones(vendedorId: string) {
  return prisma.stand.findMany({
    where: {
      vendedorId,
      edicion: { ...EDICIONES_PUBLICAS, fechaFin: { gte: hoyEnZona() } },
    },
    orderBy: { edicion: { fechaInicio: "asc" } },
    include: {
      edicion: {
        include: {
          feria: { select: { nombre: true, slug: true, direccion: true } },
        },
      },
    },
  });
}
