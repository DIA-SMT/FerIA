import type { CategoriaFeria, Rubro } from "@prisma/client";

import {
  type ComponenteIcono,
  IconoCartera,
  IconoCubiertos,
  IconoEtiqueta,
  IconoFrasco,
  IconoGema,
  IconoGota,
  IconoGrilla,
  IconoLampara,
  IconoLibro,
  IconoPlantin,
  IconoRemera,
  IconoTienda,
  IconoTrompo,
  IconoVasija,
} from "@/components/ui/iconos";

/**
 * Qué ícono le toca a cada rubro y a cada categoría de feria.
 *
 * Vive acá y no dentro de `iconos.tsx` por dos razones. La de diseño: ese
 * archivo es una librería de dibujos y no tiene por qué saber qué enums existen
 * en la base; acá el acoplamiento con Prisma queda contenido en un solo lugar.
 *
 * La empírica: adentro de `iconos.tsx` no funcionaba. La portada reventaba con
 * `ReferenceError: ICONOS_RUBRO is not defined` —con `tsc` y `eslint` en verde,
 * y sobreviviendo tanto a reiniciar el server como a borrar `.next`—. En el
 * bundle del servidor el identificador llegaba suelto en vez de resolverse
 * contra el módulo. No averigüé el mecanismo; lo que está verificado es que
 * desde un archivo propio anda, así que la causa queda sin nombre a propósito
 * en vez de inventarle una.
 *
 * Los dos son `Record` completos y no objetos con respaldo: si mañana se agrega
 * un rubro al enum, TypeScript marca este archivo en vez de dejar que la
 * pantalla caiga en silencio al ícono genérico.
 */
export const ICONOS_RUBRO: Record<Rubro, ComponenteIcono> = {
  ARTESANIAS: IconoVasija,
  GASTRONOMIA: IconoCubiertos,
  INDUMENTARIA: IconoRemera,
  MARROQUINERIA: IconoCartera,
  JOYERIA_Y_BIJOUTERIE: IconoGema,
  DECORACION: IconoLampara,
  COSMETICA_NATURAL: IconoGota,
  LIBROS_Y_ARTE: IconoLibro,
  PRODUCTOS_REGIONALES: IconoFrasco,
  HUERTA_Y_VIVERO: IconoPlantin,
  JUGUETES: IconoTrompo,
  // «Otros» es justamente lo que no tiene forma propia: el marbete genérico es
  // la respuesta correcta y no un respaldo.
  OTROS: IconoEtiqueta,
};

export const ICONOS_CATEGORIA: Record<CategoriaFeria, ComponenteIcono> = {
  ARTESANIAS: IconoVasija,
  EMPRENDEDORES: IconoTienda,
  GASTRONOMIA: IconoCubiertos,
  PRODUCTOS_REGIONALES: IconoFrasco,
  LIBROS_Y_ARTE: IconoLibro,
  MIXTA: IconoGrilla,
};
