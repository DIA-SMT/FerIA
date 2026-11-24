/**
 * Las fechas que mueven las ventas de un feriante en Tucumán, para que Migue
 * pueda decir «se viene el Día de la Madre, mostrá tus regalos» con la fecha
 * bien puesta.
 *
 * Todas las fechas son medianoche UTC del día, como las de `hoyEnZona`: así se
 * comparan sin pensar en husos.
 */

export interface FechaComercial {
  nombre: string;
  fecha: Date;
  /** Qué tiene de particular para quien vende en las ferias. */
  idea: string;
}

const UN_DIA = 24 * 60 * 60 * 1000;

function dia(anio: number, mes: number, numero: number): Date {
  return new Date(Date.UTC(anio, mes - 1, numero));
}

/** El enésimo domingo de un mes: el tercero de octubre es el Día de la Madre. */
export function enesimoDomingo(anio: number, mes: number, n: number): Date {
  const primero = dia(anio, mes, 1);
  const hastaElDomingo = (7 - primero.getUTCDay()) % 7;
  return dia(anio, mes, 1 + hastaElDomingo + (n - 1) * 7);
}

/** Las de un año. */
function delAnio(anio: number): FechaComercial[] {
  return [
    {
      nombre: "Día de Reyes",
      fecha: dia(anio, 1, 6),
      idea: "regalos chicos para chicos",
    },
    {
      nombre: "San Valentín",
      fecha: dia(anio, 2, 14),
      idea: "regalos para la pareja, combos para dos",
    },
    {
      nombre: "Vuelta a clases",
      fecha: dia(anio, 3, 1),
      idea: "útiles, mochilas, viandas y uniformes",
    },
    {
      nombre: "Día del Padre",
      fecha: enesimoDomingo(anio, 6, 3),
      idea: "regalos para papá: se buscan desde dos semanas antes",
    },
    {
      nombre: "Día del Amigo",
      fecha: dia(anio, 7, 20),
      idea: "regalos chicos y combos para compartir",
    },
    {
      nombre: "9 de Julio en Tucumán",
      fecha: dia(anio, 7, 9),
      idea: "la ciudad se llena de visitantes: productos regionales y recuerdos",
    },
    {
      nombre: "Día de las Infancias",
      fecha: enesimoDomingo(anio, 8, 3),
      idea: "juguetes y regalos para chicos: se buscan desde dos semanas antes",
    },
    {
      nombre: "Día de la Primavera y del Estudiante",
      fecha: dia(anio, 9, 21),
      idea: "regalos para jóvenes, flores y plantas",
    },
    {
      nombre: "Batalla de Tucumán y Virgen de la Merced",
      fecha: dia(anio, 9, 24),
      idea: "feriado provincial: más gente en las ferias",
    },
    {
      nombre: "Día de la Madre",
      fecha: enesimoDomingo(anio, 10, 3),
      idea: "la fecha más fuerte del año para regalos: se buscan desde tres semanas antes",
    },
    {
      nombre: "Regalos empresariales de fin de año",
      fecha: dia(anio, 12, 10),
      idea: "empresas e instituciones arman sus regalos: buen momento para Modo Feria",
    },
    {
      nombre: "Navidad",
      fecha: dia(anio, 12, 24),
      idea: "regalos y comida de las fiestas: se compra desde principios de diciembre",
    },
    {
      nombre: "Año Nuevo",
      fecha: dia(anio, 12, 31),
      idea: "comida, bebida y regalos de último momento",
    },
  ];
}

/**
 * Las que vienen en los próximos `dias` días, en orden. Incluye la de hoy:
 * el mismo día todavía se vende.
 */
export function proximasFechasComerciales(
  hoy: Date,
  dias = 45,
): FechaComercial[] {
  const hasta = hoy.getTime() + dias * UN_DIA;
  const anio = hoy.getUTCFullYear();
  return [...delAnio(anio), ...delAnio(anio + 1)]
    .filter(
      (fecha) =>
        fecha.fecha.getTime() >= hoy.getTime() &&
        fecha.fecha.getTime() <= hasta,
    )
    .sort((una, otra) => una.fecha.getTime() - otra.fecha.getTime());
}
