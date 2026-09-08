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
 * La zona de la plataforma. Es una sola ciudad, así que va fija.
 *
 * Fijarla es lo que la vuelve predecible: antes el «hoy» salía del reloj UTC
 * del servidor, y como Vercel corre en UTC y acá son tres horas menos, de las
 * 21:00 a las 23:59 el sitio ya estaba en el día siguiente. Las ferias cierran
 * 22 h y 24 h, así que durante esas tres horas una feria abierta figuraba como
 * terminada, y una que empezaba al día siguiente figuraba como en curso.
 */
export const ZONA = "America/Argentina/Tucuman";

/**
 * REGLA DE ZONAS, que conviene no mezclar:
 *
 * · Columnas `DATE` (fechas de ediciones, vencimientos, pagos): Prisma las
 *   devuelve a medianoche UTC. Se formatean **en UTC**, porque leerlas en la
 *   zona local las correría un día hacia atrás.
 * · Columnas de marca temporal (auditoría): se formatean **en `ZONA`**, que es
 *   la hora que el usuario tiene en la pared.
 * · «Hoy», para comparar contra columnas `DATE`: se calcula el día del
 *   calendario en `ZONA` y se expresa como medianoche UTC — ver `hoyEnZona`.
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
    timeZone: ZONA,
  }).format(fecha);
}

/** Convierte un `Date` a `YYYY-MM-DD` (para `<input type="date">`), leyendo en UTC. */
export function aValorInputFecha(fecha: Date | null | undefined): string {
  if (!fecha) return "";
  return fecha.toISOString().slice(0, 10);
}

/**
 * El día de hoy **en Tucumán**, expresado como medianoche UTC para poder
 * compararlo contra las columnas `DATE`.
 *
 * No usa el reloj UTC del servidor: eso es justo lo que hacía que a las 21:00
 * el sitio saltara al día siguiente. Se le pregunta a `Intl` qué día es en
 * `ZONA` y se arma la medianoche UTC de ese día.
 *
 * `en-CA` porque da `AAAA-MM-DD`, que se parte sin ambigüedad de orden.
 */
export function hoyEnZona(): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);

  const [anio, mes, dia] = partes;
  return new Date(Date.UTC(anio!, mes! - 1, dia!));
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
