import type {
  CategoriaFeria,
  EstadoEdicion,
  EstadoPago,
  EstadoVendedor,
  MedioPago,
  Rol,
  Rubro,
} from "@prisma/client";

/**
 * Etiquetas legibles y estilos de los enums del dominio.
 *
 * Centralizadas acá para que el mismo rubro se lea igual en el market, en el
 * panel municipal y en el del feriante.
 */

/** Clases de Tailwind para las `Badge` de cada estado. */
export type TonoBadge =
  | "azul"
  | "celeste"
  | "amarillo"
  | "verde"
  | "rojo"
  | "neutro";

export const RUBROS: Record<Rubro, string> = {
  ARTESANIAS: "Artesanías",
  GASTRONOMIA: "Gastronomía",
  INDUMENTARIA: "Indumentaria",
  MARROQUINERIA: "Marroquinería",
  JOYERIA_Y_BIJOUTERIE: "Joyería y bijouterie",
  DECORACION: "Decoración",
  COSMETICA_NATURAL: "Cosmética natural",
  LIBROS_Y_ARTE: "Libros y arte",
  PRODUCTOS_REGIONALES: "Productos regionales",
  HUERTA_Y_VIVERO: "Huerta y vivero",
  JUGUETES: "Juguetes",
  OTROS: "Otros",
};

export const CATEGORIAS_FERIA: Record<CategoriaFeria, string> = {
  ARTESANIAS: "Artesanías",
  EMPRENDEDORES: "Emprendedores",
  GASTRONOMIA: "Gastronómica",
  PRODUCTOS_REGIONALES: "Productos regionales",
  LIBROS_Y_ARTE: "Libros y arte",
  MIXTA: "Mixta",
};

export const ESTADOS_EDICION: Record<EstadoEdicion, string> = {
  BORRADOR: "Borrador",
  PUBLICADA: "Publicada",
  EN_CURSO: "En curso",
  FINALIZADA: "Finalizada",
};

export const TONO_ESTADO_EDICION: Record<EstadoEdicion, TonoBadge> = {
  BORRADOR: "neutro",
  PUBLICADA: "azul",
  EN_CURSO: "verde",
  FINALIZADA: "neutro",
};

export const ESTADOS_VENDEDOR: Record<EstadoVendedor, string> = {
  PENDIENTE: "Pendiente de aprobación",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

export const TONO_ESTADO_VENDEDOR: Record<EstadoVendedor, TonoBadge> = {
  PENDIENTE: "amarillo",
  APROBADO: "verde",
  RECHAZADO: "rojo",
};

export const ESTADOS_PAGO: Record<EstadoPago, string> = {
  PENDIENTE: "Pendiente",
  PAGADO: "Pagado",
  ANULADO: "Anulado",
};

export const TONO_ESTADO_PAGO: Record<EstadoPago, TonoBadge> = {
  PENDIENTE: "amarillo",
  PAGADO: "verde",
  ANULADO: "neutro",
};

export const MEDIOS_PAGO: Record<MedioPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA_DEBITO: "Tarjeta de débito",
  TARJETA_CREDITO: "Tarjeta de crédito",
  OTRO: "Otro",
};

export const ROLES: Record<Rol, string> = {
  ADMIN: "Personal municipal",
  VENDEDOR: "Feriante",
};

/** Convierte un `Record` de etiquetas en opciones para un `<select>`. */
export function aOpciones<T extends string>(
  etiquetas: Record<T, string>,
): Array<{ valor: T; etiqueta: string }> {
  return (Object.keys(etiquetas) as T[]).map((valor) => ({
    valor,
    etiqueta: etiquetas[valor],
  }));
}
