import { DIAS_DE_BORRADOR } from "@/lib/borradores";
import { prisma } from "@/lib/db";
import { almacenamiento } from "@/lib/storage";

const UN_DIA = 24 * 60 * 60 * 1000;

/** Cuántos se borran por vez: es limpieza, no tiene que demorar a nadie. */
const POR_VEZ = 100;

/**
 * Borra los borradores que pasaron 7 días sin cambios, con sus fotos.
 *
 * No hay un proceso programado: corre cuando alguien guarda un borrador o abre
 * su stand, como la poda del registro de preguntas a Migue. A este volumen es
 * una consulta sobre un índice. Borra los de todos los feriantes, no sólo los
 * de quien la dispara: si no, los de alguien que no vuelve quedarían para
 * siempre.
 *
 * Un borrador no tiene cambios en revisión ni está publicado, así que sus
 * fotos no las usa nada más: se pueden borrar sin mirar otra cosa.
 */
export async function podarBorradoresVencidos(
  ahora: Date = new Date(),
): Promise<number> {
  const vencidos = await prisma.producto.findMany({
    where: {
      borrador: true,
      actualizadoEn: {
        lt: new Date(ahora.getTime() - DIAS_DE_BORRADOR * UN_DIA),
      },
    },
    select: { id: true, imagenes: true },
    take: POR_VEZ,
  });
  if (vencidos.length === 0) return 0;

  // `borrador: true` otra vez: si entre la consulta y el borrado lo mandaron a
  // revisión, ya no es un borrador y no se toca.
  const { count } = await prisma.producto.deleteMany({
    where: {
      id: { in: vencidos.map((producto) => producto.id) },
      borrador: true,
    },
  });

  const quedan = new Set(
    (
      await prisma.producto.findMany({
        where: { id: { in: vencidos.map((producto) => producto.id) } },
        select: { id: true },
      })
    ).map((producto) => producto.id),
  );
  for (const producto of vencidos) {
    if (quedan.has(producto.id)) continue;
    for (const ruta of producto.imagenes) await almacenamiento.eliminar(ruta);
  }
  return count;
}

/** La poda, sin que un error de limpieza tumbe lo que la disparó. */
export async function podarSinFrenar(): Promise<void> {
  try {
    await podarBorradoresVencidos();
  } catch (error) {
    console.error("[borradores] no se pudieron borrar los vencidos", error);
  }
}
