import type { EstadoEdicion, Prisma } from "@prisma/client";

import { aCentavos } from "@/lib/dinero";
import { hoyEnZona, type ValorDecimal } from "@/lib/format";
import type { TonoBadge } from "@/lib/labels";

/**
 * Estado del permiso de un feriante para una edición.
 *
 * No se guarda en la base: se deriva de lo abonado contra el canon de la
 * edición y su vencimiento, así no puede quedar desactualizado.
 */
export type EstadoPermiso = "SIN_CANON" | "AL_DIA" | "PENDIENTE" | "VENCIDO";

export const ESTADOS_PERMISO: Record<EstadoPermiso, string> = {
  SIN_CANON: "Sin canon",
  AL_DIA: "Al día",
  PENDIENTE: "Pendiente",
  VENCIDO: "Vencido",
};

export const TONO_ESTADO_PERMISO: Record<EstadoPermiso, TonoBadge> = {
  SIN_CANON: "neutro",
  AL_DIA: "verde",
  PENDIENTE: "amarillo",
  VENCIDO: "rojo",
};

// La aritmética de plata está en `src/lib/dinero.ts`: la comparten el canon y
// los pedidos, que son dos dineros distintos con la misma matemática.

export interface ResumenCanon {
  estado: EstadoPermiso;
  /** Canon total que corresponde a la edición. */
  montoCanon: number;
  /** Suma de los pagos en estado PAGADO. */
  totalPagado: number;
  /** Cuánto falta para saldar (nunca negativo). */
  saldo: number;
  /**
   * Cuánto se cobró de más (nunca negativo).
   *
   * Antes el excedente se aplastaba con un `Math.max(0, …)` sobre el saldo y
   * un pago cargado dos veces quedaba indistinguible de uno bien cargado.
   * Exponerlo es lo que permite mostrarlo y que alguien lo revise.
   */
  aFavor: number;
  /** Días hasta el vencimiento. Negativo si ya venció. `null` si no hay fecha. */
  diasParaVencer: number | null;
}

export interface PagoParaCanon {
  monto: ValorDecimal;
  estado: string;
}

interface EntradaCanon {
  montoCanon: ValorDecimal | null | undefined;
  vencimientoCanon: Date | null | undefined;
  /** Pagos del feriante para esa edición. */
  pagos: PagoParaCanon[];
}

/**
 * Calcula el estado del permiso.
 *
 * Reglas:
 *  - Si la edición no cobra canon → `SIN_CANON`.
 *  - Si lo abonado cubre el canon → `AL_DIA`.
 *  - Si falta plata y ya pasó el vencimiento → `VENCIDO` (morosidad).
 *  - Si falta plata pero todavía hay tiempo → `PENDIENTE`.
 *
 * `hoy` se puede pasar desde afuera para que una tabla entera se calcule
 * contra el mismo día: `hoyEnZona()` arma un `Intl.DateTimeFormat` en cada
 * llamada, y además una lista larga podría cruzar la medianoche a mitad del
 * render y mostrar dos criterios distintos en la misma pantalla.
 */
export function calcularResumenCanon(
  entrada: EntradaCanon,
  hoy: Date = hoyEnZona(),
): ResumenCanon {
  const canonEnCentavos = aCentavos(entrada.montoCanon);
  const pagadoEnCentavos = entrada.pagos
    .filter((pago) => pago.estado === "PAGADO")
    .reduce((suma, pago) => suma + aCentavos(pago.monto), 0);

  const diferencia = canonEnCentavos - pagadoEnCentavos;
  const saldoEnCentavos = Math.max(0, diferencia);
  const aFavorEnCentavos = Math.max(0, -diferencia);

  const diasParaVencer = entrada.vencimientoCanon
    ? Math.round(
        (entrada.vencimientoCanon.getTime() - hoy.getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : null;

  let estado: EstadoPermiso;
  if (canonEnCentavos <= 0) {
    estado = "SIN_CANON";
  } else if (saldoEnCentavos <= 0) {
    estado = "AL_DIA";
  } else if (diasParaVencer !== null && diasParaVencer < 0) {
    estado = "VENCIDO";
  } else {
    estado = "PENDIENTE";
  }

  return {
    estado,
    montoCanon: canonEnCentavos / 100,
    totalPagado: pagadoEnCentavos / 100,
    saldo: saldoEnCentavos / 100,
    aFavor: aFavorEnCentavos / 100,
    diasParaVencer,
  };
}

/** Texto de apoyo para mostrar debajo del badge de estado. */
export function detalleVencimiento(resumen: ResumenCanon): string | null {
  if (resumen.diasParaVencer === null) return null;

  if (resumen.estado === "VENCIDO") {
    const dias = Math.abs(resumen.diasParaVencer);
    return dias === 1 ? "Venció ayer" : `Vencido hace ${dias} días`;
  }

  if (resumen.estado === "PENDIENTE") {
    if (resumen.diasParaVencer === 0) return "Vence hoy";
    if (resumen.diasParaVencer === 1) return "Vence mañana";
    return `Vence en ${resumen.diasParaVencer} días`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Qué ediciones generan obligación, y los permisos que salen de ellas
// ---------------------------------------------------------------------------

/**
 * Un BORRADOR no genera deuda: todavía no se publicó, así que al feriante
 * nunca se le comunicó que tenía que pagar. Las FINALIZADA sí siguen
 * generándola: la plata se adeuda igual aunque la feria haya terminado.
 *
 * La decisión vive **acá y en un solo lugar** porque antes estaba escrita dos
 * veces: el tablero de /admin contaba morosos sobre las ediciones vigentes y
 * /admin/canon —la pantalla a la que linkea el cartel rojo— los contaba sobre
 * todas, borradores incluidos. Con los datos cargados hoy las dos pantallas
 * mostraban distinta cantidad de morosos y distinto monto adeudado.
 */
export const EDICIONES_CON_OBLIGACION: Prisma.EdicionFeriaWhereInput = {
  estado: { not: "BORRADOR" },
};

/** La misma regla que `EDICIONES_CON_OBLIGACION`, para filtrar en memoria. */
export function generaObligacionCanon(edicion: {
  estado: EstadoEdicion;
}): boolean {
  return edicion.estado !== "BORRADOR";
}

/** Lo que el cálculo necesita de un stand. */
export interface StandParaCanon {
  vendedorId: string | null;
}

/** Lo que el cálculo necesita de una edición ya consultada con sus relaciones. */
export interface EdicionParaCanon {
  estado: EstadoEdicion;
  montoCanon: ValorDecimal | null;
  vencimientoCanon: Date | null;
  stands: StandParaCanon[];
  pagos: Array<PagoParaCanon & { vendedorId: string }>;
}

export interface PermisoCanon<E extends EdicionParaCanon> {
  edicion: E;
  stand: E["stands"][number];
  vendedorId: string;
  resumen: ResumenCanon;
}

/**
 * Un permiso por cada stand asignado de cada edición que genera obligación.
 *
 * Es pura a propósito: no toca Prisma. Cada pantalla trae las columnas y
 * relaciones que necesita mostrar, y acá sólo se decide quién debe y cuánto.
 * Así el cartel rojo del tablero y la grilla de /admin/canon no pueden volver
 * a contar cosas distintas.
 *
 * No hace falta deduplicar por feriante: la base tiene un `@@unique` de
 * (edición, vendedor), así que nadie ocupa dos stands en la misma edición.
 */
export function calcularPermisos<E extends EdicionParaCanon>(
  ediciones: E[],
): Array<PermisoCanon<E>> {
  const hoy = hoyEnZona();
  const permisos: Array<PermisoCanon<E>> = [];

  for (const edicion of ediciones) {
    if (!generaObligacionCanon(edicion)) continue;

    // TypeScript lee `edicion.stands` como la restricción del genérico
    // (`StandParaCanon[]`), pero en ejecución es el array que trajo quien
    // llamó. Se lo devuelve con su tipo real para que cada pantalla pueda
    // seguir usando sus columnas: el número de stand, el vendedor, lo que sea.
    const stands = edicion.stands as Array<E["stands"][number]>;

    for (const stand of stands) {
      const vendedorId = stand.vendedorId;
      if (!vendedorId) continue;

      permisos.push({
        edicion,
        stand,
        vendedorId,
        resumen: calcularResumenCanon(
          {
            montoCanon: edicion.montoCanon,
            vencimientoCanon: edicion.vencimientoCanon,
            pagos: edicion.pagos.filter(
              (pago) => pago.vendedorId === vendedorId,
            ),
          },
          hoy,
        ),
      });
    }
  }

  return permisos;
}
