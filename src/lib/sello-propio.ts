import type { ModalidadSelloPropio } from "@prisma/client";

import { formatearMoneda } from "@/lib/format";

/**
 * «Modo Feria»: los regalos y servicios con sello propio que los feriantes
 * ofrecen a empresas e instituciones, en la convocatoria de la Dirección. El
 * feriante los carga desde Mi stand y pasan por la revisión (ver
 * `src/lib/revision.ts`).
 *
 * Este módulo no toca la base, así que lo pueden importar también los
 * componentes de cliente (el formulario del panel). Las consultas están en
 * `src/lib/consultas-sello-propio.ts`.
 */

export type TipoSelloPropio = "REGALO" | "SERVICIO";

export const MODALIDADES_SELLO_PROPIO: Record<ModalidadSelloPropio, string> = {
  PRODUCTO: "Producto",
  CAJA: "Caja",
  COMBO: "Combo",
  FOOD_TRUCK: "Food truck o puesto",
  PATIO_GASTRONOMICO: "Patio gastronómico",
};

/** Las modalidades de cada tipo, en el orden en que se ofrecen. */
export const MODALIDADES_POR_TIPO: Record<
  TipoSelloPropio,
  ModalidadSelloPropio[]
> = {
  REGALO: ["PRODUCTO", "CAJA", "COMBO"],
  SERVICIO: ["FOOD_TRUCK", "PATIO_GASTRONOMICO"],
};

/** El tipo no se guarda: sale de la modalidad, así nunca se contradicen. */
export function tipoDeModalidad(
  modalidad: ModalidadSelloPropio,
): TipoSelloPropio {
  return MODALIDADES_POR_TIPO.SERVICIO.includes(modalidad)
    ? "SERVICIO"
    : "REGALO";
}

/** Cada tipo con su nombre, su sello y la dirección de su pestaña. */
export const TIPOS_SELLO_PROPIO: Record<
  TipoSelloPropio,
  {
    /** Como lo nombra la convocatoria: es lo que dice el sello. */
    titulo: string;
    /** El nombre corto, para las pestañas y el panel. */
    corto: string;
    /** Para nombrar una sola: «Regalo · Caja». */
    singular: string;
    /** Para quién y para qué, en una línea. */
    bajada: string;
    /** Lo mismo en pocas palabras, para el menú. */
    detalle: string;
    sello: string;
    href: string;
  }
> = {
  REGALO: {
    titulo: "Regalos con sello propio",
    corto: "Regalos",
    singular: "Regalo",
    bajada:
      "Productos, cajas y combos hechos en nuestras ferias, para regalar en tu empresa o institución.",
    detalle: "Para regalar en tu empresa o institución",
    sello: "/sello-propio/sello-regalos.webp",
    href: "/modo-feria/regalos",
  },
  SERVICIO: {
    titulo: "Servicios con sello propio",
    corto: "Servicios",
    singular: "Servicio",
    bajada:
      "Food trucks, puestos y patios gastronómicos de nuestras ferias, para tus reuniones, eventos y celebraciones.",
    detalle: "Para reuniones, eventos y celebraciones",
    sello: "/sello-propio/sello-servicios.webp",
    href: "/modo-feria/servicios",
  },
};

/** El tipo de `/modo-feria/<regalos|servicios>`, o `null` si no es ninguno. */
export function tipoDesdeSegmento(valor: string): TipoSelloPropio | null {
  if (valor === "regalos") return "REGALO";
  if (valor === "servicios") return "SERVICIO";
  return null;
}

/**
 * Lo que se sugiere en «por…» al elegir la modalidad. Es sólo el texto de
 * ejemplo del campo: el que manda es lo que contó el feriante.
 */
export const UNIDAD_SUGERIDA: Record<ModalidadSelloPropio, string> = {
  PRODUCTO: "por unidad",
  CAJA: "por caja",
  COMBO: "por combo",
  FOOD_TRUCK: "por persona",
  PATIO_GASTRONOMICO: "por persona",
};

/** «$ 15.000 por caja», o `null` si no hay precio cargado. */
export function precioOrientativo(
  precio: number | null,
  unidad: string | null,
): string | null {
  if (precio === null) return null;
  return [formatearMoneda(precio), unidad].filter(Boolean).join(" ");
}

/**
 * Lo que se escribe en «Precio» del panel, a pesos enteros.
 *
 * En la Argentina el punto separa miles y la coma los centavos, así que
 * «15.000» son quince mil y no quince. Los centavos se descartan: es un precio
 * orientativo. Vacío o sin números es `null`.
 */
export function leerPrecio(entrada: string): number | null {
  const sinCentavos = entrada.split(",")[0] ?? "";
  const digitos = sinCentavos.replace(/\D/g, "");
  return digitos ? Number(digitos) : null;
}

/** El mensaje con el que arranca la consulta por WhatsApp. */
export function mensajeConsultaPropuesta(
  titulo: string,
  tipo: TipoSelloPropio,
): string {
  return `¡Hola! Vi «${titulo}» en ${TIPOS_SELLO_PROPIO[tipo].titulo}, en la página de Ferias de la Ciudad, y quería hacerles una consulta.`;
}
