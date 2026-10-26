import type { DiaSemana } from "@prisma/client";

/**
 * Días y horas de apertura de una edición.
 *
 * Todo acá trabaja en UTC a propósito. Las columnas de fecha son `DATE` y se
 * guardan como medianoche UTC —ver `hoyEnZona` en `format.ts`—, así que leer
 * el día con `getDay()` en vez de `getUTCDay()` correría la semana entera un
 * día al oeste de Greenwich, que es justo donde estamos.
 *
 * Las horas son texto "HH:MM" y no instantes: una feria abre a las ocho de la
 * mañana de Tucumán, no en un momento absoluto. Por eso no se convierten.
 */

/** Lunes primero, que es como se lee una semana acá. */
export const DIAS_EN_ORDEN: DiaSemana[] = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
  "DOMINGO",
];

const UN_DIA = 24 * 60 * 60 * 1000;

/** El día de la semana de una fecha, leída en UTC. */
export function diaDeFecha(fecha: Date): DiaSemana {
  // getUTCDay() da 0 para domingo; acá la semana arranca el lunes.
  const indice = (fecha.getUTCDay() + 6) % 7;
  return DIAS_EN_ORDEN[indice] as DiaSemana;
}

/** Los siete días de la semana que contiene a `fecha`, de lunes a domingo. */
export function semanaDe(fecha: Date): Date[] {
  const lunes = new Date(
    fecha.getTime() - ((fecha.getUTCDay() + 6) % 7) * UN_DIA,
  );
  return Array.from(
    { length: 7 },
    (_, i) => new Date(lunes.getTime() + i * UN_DIA),
  );
}

/** Lo que el cálculo necesita saber de una edición. */
export interface EdicionConHorario {
  fechaInicio: Date;
  fechaFin: Date;
  diasSemana: DiaSemana[];
  horaApertura: string | null;
  horaCierre: string | null;
  horario: string | null;
}

/**
 * Si la edición abre ese día.
 *
 * Sin días cargados se asume que abre todos los del rango. Es el
 * comportamiento que tenía el sistema antes de que existieran estos campos, y
 * mantenerlo es lo que permite que la Dirección los complete de a poco: una
 * edición vieja sigue mostrándose como siempre en vez de desaparecer de la
 * portada por no tener un dato que ayer no existía.
 */
export function abreEnFecha(edicion: EdicionConHorario, fecha: Date): boolean {
  const dia = fecha.getTime();
  if (dia < edicion.fechaInicio.getTime()) return false;
  if (dia > edicion.fechaFin.getTime()) return false;
  if (edicion.diasSemana.length === 0) return true;
  return edicion.diasSemana.includes(diaDeFecha(fecha));
}

/**
 * Qué abre cada día de la semana.
 *
 * Devuelve un día por cada uno que tenga al menos una feria: los días sin nada
 * no se listan, porque una tarjeta vacía que dice «hoy no hay ferias» ocupa el
 * mismo lugar que una con información y no sirve para nada.
 *
 * Es genérica para que la portada pueda traer de cada edición las columnas que
 * necesita mostrar —el nombre de la feria, su slug, su foto— sin que esto las
 * conozca. Acá sólo se decide qué día abre cada cual.
 */
export function agendaDeLaSemana<E extends EdicionConHorario>(
  semana: Date[],
  ediciones: E[],
): Array<{ fecha: Date; ediciones: E[] }> {
  return semana
    .map((fecha) => ({
      fecha,
      ediciones: ediciones.filter((edicion) => abreEnFecha(edicion, fecha)),
    }))
    .filter((dia) => dia.ediciones.length > 0);
}

const MESES_CORTOS = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

/**
 * Las tres piezas del taco de fecha de las tarjetas: «LUN · 15 · ABR».
 *
 * Se arma con los campos UTC y con tablas propias en vez de `Intl`, por lo
 * mismo que el resto de este archivo: la fecha es una columna `DATE` guardada
 * a medianoche UTC, y cualquier formateador que la interprete en la zona local
 * del servidor va a imprimir el día anterior.
 */
export function etiquetaDeFecha(fecha: Date): {
  dia: string;
  numero: number;
  mes: string;
} {
  return {
    dia: NOMBRES_CORTOS[diaDeFecha(fecha)].toUpperCase(),
    numero: fecha.getUTCDate(),
    mes: MESES_CORTOS[fecha.getUTCMonth()] as string,
  };
}

/** "8:00" a partir de "08:00". El cero a la izquierda es ruido al leer. */
export function formatearHora(hora: string): string {
  return hora.replace(/^0/, "");
}

/** "8:00 a 14:00", o `null` si falta alguna de las dos. */
export function formatearRangoHorario(
  apertura: string | null,
  cierre: string | null,
): string | null {
  if (!apertura || !cierre) return null;
  return `${formatearHora(apertura)} a ${formatearHora(cierre)}`;
}

const NOMBRES_CORTOS: Record<DiaSemana, string> = {
  LUNES: "Lun",
  MARTES: "Mar",
  MIERCOLES: "Mié",
  JUEVES: "Jue",
  VIERNES: "Vie",
  SABADO: "Sáb",
  DOMINGO: "Dom",
};

/** "Lun, Mié y Sáb". Los siete días se dicen con palabras, no con una lista. */
export function formatearDias(dias: DiaSemana[]): string | null {
  if (dias.length === 0) return null;
  if (dias.length === 7) return "Todos los días";

  // Se ordenan por el orden de la semana y no por el que vino de la base: un
  // arreglo cargado como [DOMINGO, SABADO] tiene que leerse "Sáb y Dom".
  const enOrden = DIAS_EN_ORDEN.filter((dia) => dias.includes(dia)).map(
    (dia) => NOMBRES_CORTOS[dia],
  );

  if (enOrden.length === 1) return enOrden[0] as string;
  return `${enOrden.slice(0, -1).join(", ")} y ${enOrden.at(-1)}`;
}

/**
 * Una línea con el horario, para mostrar debajo del nombre de la feria.
 *
 * El orden de preferencia es lo que hace posible la carga gradual: si están
 * los campos nuevos se usan, y si no se cae al texto libre de siempre. Una
 * edición sin ninguno de los dos no inventa nada y devuelve `null`.
 */
export function resumenHorario(edicion: EdicionConHorario): string | null {
  const dias = formatearDias(edicion.diasSemana);
  const horas = formatearRangoHorario(edicion.horaApertura, edicion.horaCierre);

  if (dias && horas) return `${dias} · ${horas}`;
  if (horas) return horas;
  if (dias) return dias;
  return edicion.horario;
}
