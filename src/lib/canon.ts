import { aNumero, hoyUTC, type ValorDecimal } from "@/lib/format";
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

export interface ResumenCanon {
  estado: EstadoPermiso;
  /** Canon total que corresponde a la edición. */
  montoCanon: number;
  /** Suma de los pagos en estado PAGADO. */
  totalPagado: number;
  /** Cuánto falta para saldar (nunca negativo). */
  saldo: number;
  /** Días hasta el vencimiento. Negativo si ya venció. `null` si no hay fecha. */
  diasParaVencer: number | null;
}

interface EntradaCanon {
  montoCanon: ValorDecimal | null | undefined;
  vencimientoCanon: Date | null | undefined;
  /** Pagos del feriante para esa edición. */
  pagos: Array<{ monto: ValorDecimal; estado: string }>;
}

/**
 * Calcula el estado del permiso.
 *
 * Reglas:
 *  - Si la edición no cobra canon → `SIN_CANON`.
 *  - Si lo abonado cubre el canon → `AL_DIA`.
 *  - Si falta plata y ya pasó el vencimiento → `VENCIDO` (morosidad).
 *  - Si falta plata pero todavía hay tiempo → `PENDIENTE`.
 */
export function calcularResumenCanon(entrada: EntradaCanon): ResumenCanon {
  const montoCanon = aNumero(entrada.montoCanon);
  const totalPagado = entrada.pagos
    .filter((pago) => pago.estado === "PAGADO")
    .reduce((suma, pago) => suma + aNumero(pago.monto), 0);

  const saldo = Math.max(0, montoCanon - totalPagado);

  const diasParaVencer = entrada.vencimientoCanon
    ? Math.round(
        (entrada.vencimientoCanon.getTime() - hoyUTC().getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : null;

  let estado: EstadoPermiso;
  if (montoCanon <= 0) {
    estado = "SIN_CANON";
  } else if (saldo <= 0) {
    estado = "AL_DIA";
  } else if (diasParaVencer !== null && diasParaVencer < 0) {
    estado = "VENCIDO";
  } else {
    estado = "PENDIENTE";
  }

  return { estado, montoCanon, totalPagado, saldo, diasParaVencer };
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
