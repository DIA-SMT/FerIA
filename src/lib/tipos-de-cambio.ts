/*
  Los tipos de cambio del stand como los nombra quien revisa. Va aparte de
  `revision.ts` porque lo usa también el filtro de la bandeja, que corre en el
  navegador, y `revision.ts` habla con la base y con el almacenamiento.

  El producto se parte en dos porque son dos trabajos distintos: dar de alta
  algo nuevo, o mirar qué le cambiaron a algo que ya está publicado.
*/
export const TIPOS_DE_CAMBIO = {
  portada: "Portada",
  logo: "Logo",
  identidad: "Nombre y rubro",
  descripcion: "Descripción",
  contacto: "Contacto y redes",
  "producto-nuevo": "Productos nuevos",
  producto: "Cambios en productos",
} as const;

export type TipoDeCambio = keyof typeof TIPOS_DE_CAMBIO;

export function esTipoDeCambio(valor: string): valor is TipoDeCambio {
  return Object.hasOwn(TIPOS_DE_CAMBIO, valor);
}

/** El filtro de feria para los feriantes que no están habilitados en ninguna. */
export const SIN_FERIA = "sin-feria";
