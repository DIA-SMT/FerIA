import { calcularPermisos, EDICIONES_CON_OBLIGACION } from "@/lib/canon";
import { edicionesVigentes } from "@/lib/consultas";
import { sumarImportes } from "@/lib/dinero";
import { prisma } from "@/lib/db";
import { aNumero } from "@/lib/format";
import { RUBROS } from "@/lib/labels";
import { hayCanon } from "@/lib/modulo-canon";

/**
 * Métricas del panel municipal.
 *
 * Se resuelve todo en una función para que el dashboard sea una vista y no
 * tenga lógica de negocio adentro.
 */
export async function obtenerEstadisticas() {
  const [
    feriasActivas,
    solicitudesPendientes,
    feriantesAprobados,
    porRubro,
    edicionesActivas,
  ] = await Promise.all([
    prisma.feria.count({ where: { activa: true } }),
    prisma.vendedor.count({ where: { estado: "PENDIENTE" } }),
    prisma.vendedor.count({ where: { estado: "APROBADO" } }),
    prisma.vendedor.groupBy({
      by: ["rubro"],
      where: { estado: "APROBADO" },
      _count: true,
    }),
    prisma.edicionFeria.findMany({
      where: edicionesVigentes(),
      orderBy: { fechaInicio: "asc" },
      select: {
        id: true,
        nombre: true,
        fechaInicio: true,
        feria: { select: { nombre: true } },
        stands: { select: { vendedorId: true } },
      },
    }),
  ]);

  // ----------------------------- Ocupación de stands -----------------------
  let standsOcupados = 0;
  let standsTotales = 0;

  const ocupacionPorEdicion = edicionesActivas.map((edicion) => {
    const ocupados = edicion.stands.filter(
      (stand) => stand.vendedorId !== null,
    ).length;

    standsOcupados += ocupados;
    standsTotales += edicion.stands.length;

    return {
      id: edicion.id,
      etiqueta: edicion.nombre
        ? `${edicion.feria.nombre} — ${edicion.nombre}`
        : edicion.feria.nombre,
      ocupados,
      total: edicion.stands.length,
    };
  });

  const nombresEdicion = new Map(
    edicionesActivas.map((edicion) => [
      edicion.id,
      edicion.nombre
        ? `${edicion.feria.nombre} — ${edicion.nombre}`
        : edicion.feria.nombre,
    ]),
  );

  // `null` y no ceros: el tablero tiene que poder distinguir «no se cobra» de
  // «se cobra y nadie pagó», que dibujan pantallas distintas. De paso, con el
  // módulo apagado se ahorran tres consultas que nadie iba a mirar.
  const canon = hayCanon() ? await estadisticasDeCanon(nombresEdicion) : null;

  return {
    feriasActivas,
    edicionesVigentes: edicionesActivas.length,
    solicitudesPendientes,
    feriantesAprobados,
    standsOcupados,
    standsTotales,
    ocupacionPorEdicion,
    feriantesPorRubro: porRubro
      .map((fila) => ({
        etiqueta: RUBROS[fila.rubro],
        valor: fila._count,
      }))
      .sort((a, b) => b.valor - a.valor),
    canon,
  };
}

/**
 * Morosidad y recaudación.
 *
 * Aparte del resto porque es lo único que depende del canon, que hoy está
 * apagado: así el tablero no arrastra consultas de un módulo que no muestra.
 *
 * Recibe los nombres de las ediciones vigentes ya armados y los completa con
 * las que no lo están —una edición terminada también recaudó—, para no volver
 * a pedir a la base lo que la función de arriba ya trajo.
 */
async function estadisticasDeCanon(nombresEdicion: Map<string, string>) {
  const [edicionesConObligacion, recaudacionTotal, recaudacionPorEdicion] =
    await Promise.all([
      // La morosidad se mide sobre otro universo: una edición ya finalizada
      // con canon impago sigue siendo plata adeudada, aunque no esté vigente.
      prisma.edicionFeria.findMany({
        where: EDICIONES_CON_OBLIGACION,
        select: {
          estado: true,
          montoCanon: true,
          vencimientoCanon: true,
          stands: { select: { vendedorId: true } },
          pagos: { select: { vendedorId: true, monto: true, estado: true } },
        },
      }),
      prisma.pagoCanon.aggregate({
        where: { estado: "PAGADO" },
        _sum: { monto: true },
      }),
      prisma.pagoCanon.groupBy({
        by: ["edicionId"],
        where: { estado: "PAGADO" },
        _sum: { monto: true },
      }),
    ]);

  // ------------------------------- Morosidad -------------------------------
  // El mismo cálculo que usa /admin/canon, para que el cartel rojo del tablero
  // y la pantalla a la que linkea no puedan mostrar números distintos.
  const vencidos = calcularPermisos(edicionesConObligacion).filter(
    (permiso) => permiso.resumen.estado === "VENCIDO",
  );

  // Personas distintas, no permisos vencidos: el cartel del tablero dice «N
  // feriantes con el canon vencido», y un mismo feriante que arrastra deuda de
  // tres ediciones es una persona a la que llamar, no tres. El monto sí suma
  // todos los permisos, que es lo que se adeuda en total.
  const feriantesEnMora = new Set(vencidos.map((permiso) => permiso.vendedorId))
    .size;
  const montoAdeudado = sumarImportes(
    vencidos.map((permiso) => permiso.resumen.saldo),
  );

  // ------------------------------ Recaudación ------------------------------
  // Las ediciones ya finalizadas también recaudaron: buscamos sus nombres.
  const idsFaltantes = recaudacionPorEdicion
    .map((fila) => fila.edicionId)
    .filter((id) => !nombresEdicion.has(id));

  if (idsFaltantes.length > 0) {
    const otras = await prisma.edicionFeria.findMany({
      where: { id: { in: idsFaltantes } },
      select: { id: true, nombre: true, feria: { select: { nombre: true } } },
    });
    for (const edicion of otras) {
      nombresEdicion.set(
        edicion.id,
        edicion.nombre
          ? `${edicion.feria.nombre} — ${edicion.nombre}`
          : edicion.feria.nombre,
      );
    }
  }

  const recaudacion = recaudacionPorEdicion
    .map((fila) => ({
      etiqueta: nombresEdicion.get(fila.edicionId) ?? "Edición eliminada",
      valor: aNumero(fila._sum.monto),
    }))
    .sort((a, b) => b.valor - a.valor);

  return {
    recaudacionAcumulada: aNumero(recaudacionTotal._sum.monto),
    recaudacionPorEdicion: recaudacion,
    feriantesEnMora,
    montoAdeudado,
  };
}
