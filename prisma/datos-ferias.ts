/**
 * Ferias, ediciones y sus fechas — la definición, separada del seed.
 *
 * Vive acá porque la usan dos scripts: `seed.ts`, que carga todo de cero, y
 * `refrescar-fechas.ts`, que recalcula las fechas sin volver a sembrar. Una
 * copia en cada uno se desincronizaría y la demo volvería a mostrar ferias
 * terminadas como si estuvieran en curso.
 *
 * Los desplazamientos son en días respecto del momento en que se corre: por eso
 * lo que se guarda envejece, y por eso existe el script que las refresca.
 */

import { CategoriaFeria, EstadoEdicion } from "@prisma/client";

const UN_DIA = 24 * 60 * 60 * 1000;

/** Fecha a medianoche UTC desplazada N días respecto de hoy (columnas `DATE`). */
export function dia(offset: number): Date {
  const hoy = new Date();
  const base = Date.UTC(
    hoy.getUTCFullYear(),
    hoy.getUTCMonth(),
    hoy.getUTCDate(),
  );
  return new Date(base + offset * UN_DIA);
}

/** Corre una fecha N días (negativo hacia atrás). */
export function correrDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * UN_DIA);
}

/**
 * Fechas que se derivan de la edición, no de hoy.
 *
 * Antes eran fijas —el pago siempre «hace 12 días», la asignación «hace 10»— y
 * quedaba incoherente: la edición de junio terminaba con un pago registrado en
 * agosto y marcado «al día». Al colgarlas de la edición, cada una cae donde
 * corresponde. Las usan el seed y `refrescar-fechas.ts`, que las recalcula.
 */
export const DIAS_PAGO_ANTES_DEL_VENCIMIENTO = 3;
export const DIAS_ASIGNACION_ANTES_DEL_INICIO = 20;

/** Cuándo se registró un canon pagado de esta edición. */
export function fechaDePago(
  vencimiento: Date | null,
  inicio: Date,
): Date {
  return vencimiento
    ? correrDias(vencimiento, -DIAS_PAGO_ANTES_DEL_VENCIMIENTO)
    : correrDias(inicio, -DIAS_ASIGNACION_ANTES_DEL_INICIO);
}

/** Cuándo se le asignó el stand al feriante en esta edición. */
export function fechaDeAsignacion(inicio: Date): Date {
  return correrDias(inicio, -DIAS_ASIGNACION_ANTES_DEL_INICIO);
}

export interface DatosEdicion {
  nombre?: string;
  inicio: number;
  fin: number;
  horario: string;
  estado: EstadoEdicion;
  cantidadStands: number;
  montoCanon: number;
  vencimiento?: number;
}

export interface DatosFeria {
  nombre: string;
  slug: string;
  descripcion: string;
  categoria: CategoriaFeria;
  direccion: string;
  latitud: number;
  longitud: number;
  ediciones: DatosEdicion[];
}

export const FERIAS: DatosFeria[] = [
  {
    nombre: "Feria de Artesanos — Parque 9 de Julio",
    slug: "feria-de-artesanos-parque-9-de-julio",
    descripcion:
      "La feria más tradicional de la ciudad, en el corazón del Parque 9 de Julio. Artesanos y artesanas de toda la provincia exponen telares, cerámica, platería, tallado en madera y trabajos en cuero. Un paseo al aire libre entre los lapachos, ideal para recorrer en familia los fines de semana.",
    categoria: CategoriaFeria.ARTESANIAS,
    direccion: "Parque 9 de Julio, Av. Benjamín Aráoz y Av. Soldati",
    latitud: -26.8285,
    longitud: -65.1888,
    ediciones: [
      {
        nombre: "Edición de Invierno",
        inicio: -60,
        fin: -58,
        horario: "Viernes a domingo de 16 a 21 h",
        estado: EstadoEdicion.FINALIZADA,
        cantidadStands: 24,
        montoCanon: 12000,
        vencimiento: -65,
      },
      {
        nombre: "Edición Agosto",
        inicio: -1,
        fin: 2,
        horario: "Jueves a domingo de 17 a 22 h",
        estado: EstadoEdicion.EN_CURSO,
        cantidadStands: 28,
        montoCanon: 15000,
        vencimiento: -6,
      },
      {
        nombre: "Edición Primavera",
        inicio: 25,
        fin: 27,
        horario: "Viernes a domingo de 17 a 22 h",
        estado: EstadoEdicion.PUBLICADA,
        cantidadStands: 28,
        montoCanon: 15000,
        vencimiento: 18,
      },
    ],
  },
  {
    nombre: "Paseo de Emprendedores — Plaza Urquiza",
    slug: "paseo-de-emprendedores-plaza-urquiza",
    descripcion:
      "Emprendimientos jóvenes de San Miguel de Tucumán se dan cita en Plaza Urquiza: indumentaria de autor, bijouterie, cosmética natural, decoración y objetos de diseño. Una vidriera para quienes están dando sus primeros pasos con su marca.",
    categoria: CategoriaFeria.EMPRENDEDORES,
    direccion: "Plaza Urquiza, Av. Sarmiento y Congreso",
    latitud: -26.8267,
    longitud: -65.2076,
    ediciones: [
      {
        nombre: "Edición Agosto",
        inicio: 0,
        fin: 1,
        horario: "Sábados y domingos de 10 a 20 h",
        estado: EstadoEdicion.EN_CURSO,
        cantidadStands: 20,
        montoCanon: 10000,
        vencimiento: -4,
      },
      {
        nombre: "Edición Septiembre",
        inicio: 14,
        fin: 15,
        horario: "Sábados y domingos de 10 a 20 h",
        estado: EstadoEdicion.PUBLICADA,
        cantidadStands: 20,
        montoCanon: 10000,
        vencimiento: 7,
      },
    ],
  },
  {
    nombre: "Feria Gastronómica — Parque Avellaneda",
    slug: "feria-gastronomica-parque-avellaneda",
    descripcion:
      "Cocina tucumana en el Parque Avellaneda: empanadas al horno de barro, locro, tamales, humita en chala y los dulces regionales de siempre. Con mesas comunitarias, música en vivo y espacio para las infancias.",
    categoria: CategoriaFeria.GASTRONOMIA,
    direccion: "Parque Avellaneda, Av. Néstor Kirchner y Juan B. Justo",
    latitud: -26.8525,
    longitud: -65.2192,
    ediciones: [
      {
        nombre: "Edición Sabores del Norte",
        inicio: 9,
        fin: 11,
        horario: "Viernes de 18 a 24 h, sábados y domingos de 12 a 24 h",
        estado: EstadoEdicion.PUBLICADA,
        cantidadStands: 16,
        montoCanon: 20000,
        vencimiento: 4,
      },
      {
        nombre: "Edición Fin de Año",
        inicio: 60,
        fin: 62,
        horario: "A confirmar",
        estado: EstadoEdicion.BORRADOR,
        cantidadStands: 16,
        montoCanon: 0,
      },
    ],
  },
  {
    nombre: "Feria del Libro y las Artes — Plaza Independencia",
    slug: "feria-del-libro-y-las-artes-plaza-independencia",
    descripcion:
      "Editoriales independientes, librerías de usados, ilustradores y talleres de arte se instalan en la plaza principal de la ciudad. Con lecturas, presentaciones y actividades para escuelas durante toda la semana.",
    categoria: CategoriaFeria.LIBROS_Y_ARTE,
    direccion: "Plaza Independencia, 25 de Mayo y San Martín",
    latitud: -26.8354,
    longitud: -65.2038,
    ediciones: [
      {
        nombre: "Edición Aniversario",
        inicio: 40,
        fin: 44,
        horario: "Todos los días de 10 a 21 h",
        estado: EstadoEdicion.PUBLICADA,
        cantidadStands: 18,
        montoCanon: 8000,
        vencimiento: 33,
      },
    ],
  },
  {
    nombre: "Feria Regional del Norte — Plaza Alberdi",
    slug: "feria-regional-del-norte-plaza-alberdi",
    descripcion:
      "Productores de los valles y del pedemonte tucumano acercan a la ciudad dulces artesanales, quesos, conservas, miel, nueces y plantas nativas. Venta directa del productor al vecino.",
    categoria: CategoriaFeria.PRODUCTOS_REGIONALES,
    direccion: "Plaza Alberdi, Av. Sáenz Peña y Corrientes",
    latitud: -26.8305,
    longitud: -65.1992,
    ediciones: [
      {
        nombre: "Edición Julio",
        inicio: -30,
        fin: -28,
        horario: "Viernes a domingo de 9 a 18 h",
        estado: EstadoEdicion.FINALIZADA,
        cantidadStands: 14,
        montoCanon: 11000,
        vencimiento: -35,
      },
    ],
  },
];
