import type { Prisma } from "@prisma/client";

/** Valores que llegan desde Prisma para columnas `Decimal`. */
export type ValorDecimal = Prisma.Decimal | number | string;

/** Convierte un `Decimal` de Prisma a `number` para poder serializarlo. */
export function aNumero(valor: ValorDecimal | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  return typeof valor === "number" ? valor : Number(valor.toString());
}

const formateadorMoneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formateadorMonedaConCentavos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Ej. `$ 12.500`. Con `centavos: true` → `$ 12.500,00`. */
export function formatearMoneda(
  valor: ValorDecimal | null | undefined,
  opciones?: { centavos?: boolean },
): string {
  const numero = aNumero(valor);
  return opciones?.centavos
    ? formateadorMonedaConCentavos.format(numero)
    : formateadorMoneda.format(numero);
}

const formateadorNumero = new Intl.NumberFormat("es-AR");

export function formatearNumero(valor: number): string {
  return formateadorNumero.format(valor);
}

/**
 * Las fechas de ferias y pagos se guardan como `DATE` en PostgreSQL y Prisma
 * las devuelve a medianoche UTC. Formatearlas en la zona local de Argentina
 * las correría un día hacia atrás, así que se leen siempre en UTC.
 */
const formateadorFecha = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const formateadorFechaLarga = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const formateadorFechaCorta = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Ej. `09/08/2026`. */
export function formatearFecha(fecha: Date | null | undefined): string {
  if (!fecha) return "—";
  return formateadorFecha.format(fecha);
}

/** Ej. `9 de agosto de 2026`. */
export function formatearFechaLarga(fecha: Date | null | undefined): string {
  if (!fecha) return "—";
  return formateadorFechaLarga.format(fecha);
}

/** Ej. `9 ago`. */
export function formatearFechaCorta(fecha: Date | null | undefined): string {
  if (!fecha) return "—";
  return formateadorFechaCorta.format(fecha);
}

/**
 * Rango de fechas de una edición, compactado cuando comparten mes o día.
 * Ej. `del 9 al 11 de agosto de 2026`, `9 de agosto de 2026`.
 */
export function formatearRangoFechas(inicio: Date, fin: Date): string {
  const mismoDia = inicio.getTime() === fin.getTime();
  if (mismoDia) return formatearFechaLarga(inicio);

  const mismoMes =
    inicio.getUTCMonth() === fin.getUTCMonth() &&
    inicio.getUTCFullYear() === fin.getUTCFullYear();

  if (mismoMes) {
    return `del ${inicio.getUTCDate()} al ${formatearFechaLarga(fin)}`;
  }

  return `del ${formatearFechaLarga(inicio)} al ${formatearFechaLarga(fin)}`;
}

/** Fecha y hora, para marcas de auditoría. Ej. `09/08/2026 14:35`. */
export function formatearFechaHora(fecha: Date | null | undefined): string {
  if (!fecha) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(fecha);
}

/** Convierte un `Date` a `YYYY-MM-DD` (para `<input type="date">`), leyendo en UTC. */
export function aValorInputFecha(fecha: Date | null | undefined): string {
  if (!fecha) return "";
  return fecha.toISOString().slice(0, 10);
}

/** Hoy a medianoche UTC, para comparar contra columnas `DATE`. */
export function hoyUTC(): Date {
  const ahora = new Date();
  return new Date(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()),
  );
}

/** Días entre dos fechas (positivo si `hasta` es posterior). */
export function diasDeDiferencia(desde: Date, hasta: Date): number {
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  return Math.round((hasta.getTime() - desde.getTime()) / MS_POR_DIA);
}

/** Recorta un texto agregando puntos suspensivos. */
export function truncar(texto: string, largo: number): string {
  if (texto.length <= largo) return texto;
  return `${texto.slice(0, largo).trimEnd()}…`;
}

/** Iniciales para los avatares de fallback. Ej. "Tejidos del Norte" → "TN". */
export function iniciales(texto: string): string {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  const primera = palabras[0]?.[0] ?? "?";
  const segunda = palabras.length > 1 ? (palabras[1]?.[0] ?? "") : "";
  return `${primera}${segunda}`.toUpperCase();
}
