import type { Rubro } from "@prisma/client";

/** Tres colores de un degradé de portada: oscuro, medio y claro. */
export type Degrade = readonly [string, string, string];

/**
 * El degradé de la portada por defecto de cada rubro.
 *
 * Con el padrón de Feria Digital entraron casi mil emprendimientos sin foto, y
 * el directorio era una grilla de portadas idénticas: el mismo azul con el
 * mismo ícono de tienda. Ahora cada rubro tiene su color y su ícono
 * (`ICONOS_RUBRO`), así la grilla se lee de un vistazo y Gastronomía no se
 * confunde con Indumentaria aunque nadie haya subido una foto.
 *
 * Mismo esquema que `.degrade-institucional` —oscuro, medio y claro a 135°—
 * para que sigan siendo de la misma familia. Cada rubro tiene un tono distinto
 * del círculo cromático; los tonos vecinos (rosa y fucsia, ámbar y naranja) se
 * distinguen además por el ícono. «Otros» se queda con el azul institucional.
 *
 * `Record` completo a propósito, como `ICONOS_RUBRO`: un rubro nuevo en el enum
 * marca este archivo en vez de caer en silencio a un color cualquiera.
 */
export const DEGRADES_RUBRO: Record<Rubro, Degrade> = {
  ARTESANIAS: ["#9f1239", "#e11d48", "#fb7185"],
  GASTRONOMIA: ["#c2410c", "#f97316", "#fdba74"],
  PRODUCTOS_REGIONALES: ["#b45309", "#f59e0b", "#fcd34d"],
  HUERTA_Y_VIVERO: ["#15803d", "#22c55e", "#86efac"],
  DECORACION: ["#0f766e", "#14b8a6", "#5eead4"],
  JUGUETES: ["#0e7490", "#06b6d4", "#67e8f9"],
  LIBROS_Y_ARTE: ["#4338ca", "#6366f1", "#a5b4fc"],
  INDUMENTARIA: ["#6d28d9", "#8b5cf6", "#c4b5fd"],
  JOYERIA_Y_BIJOUTERIE: ["#a21caf", "#d946ef", "#f0abfc"],
  COSMETICA_NATURAL: ["#be185d", "#ec4899", "#f9a8d4"],
  MARROQUINERIA: ["#44403c", "#78716c", "#d6d3d1"],
  // Los mismos tres que `.degrade-institucional`: municipal-700, municipal-500
  // y celeste-400.
  OTROS: ["#0345a5", "#0567f2", "#33adff"],
};
