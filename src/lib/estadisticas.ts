import { calcularResumenCanon } from "@/lib/canon";
import { edicionesVigentes } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { aNumero } from "@/lib/format";
import { RUBROS } from "@/lib/labels";

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
    recaudacionTotal,
    recaudacionPorEdicion,
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
        montoCanon: true,
        vencimientoCanon: true,
        feria: { select: { nombre: true } },
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

  // ------------------------------- Morosidad -------------------------------
  // Un feriante está en mora si tiene stand asignado en una edición vigente
  // con canon y su permiso quedó VENCIDO.
  let feriantesEnMora = 0;
  let montoAdeudado = 0;

  for (const edicion of edicionesActivas) {
    if (aNumero(edicion.montoCanon) <= 0) continue;

    const asignados = new Set(
      edicion.stands
        .map((stand) => stand.vendedorId)
        .filter((id): id is string => id !== null),
    );

    for (const vendedorId of asignados) {
      const resumen = calcularResumenCanon({
        montoCanon: edicion.montoCanon,
        vencimientoCanon: edicion.vencimientoCanon,
        pagos: edicion.pagos.filter((pago) => pago.vendedorId === vendedorId),
      });

      if (resumen.estado === "VENCIDO") {
        feriantesEnMora++;
        montoAdeudado += resumen.saldo;
      }
    }
  }

  // ------------------------------ Recaudación ------------------------------
  const nombresEdicion = new Map(
    edicionesActivas.map((edicion) => [
      edicion.id,
      edicion.nombre
        ? `${edicion.feria.nombre} — ${edicion.nombre}`
        : edicion.feria.nombre,
    ]),
  );

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
    recaudacionAcumulada: aNumero(recaudacionTotal._sum.monto),
    recaudacionPorEdicion: recaudacion,
    feriantesEnMora,
    montoAdeudado,
  };
}
