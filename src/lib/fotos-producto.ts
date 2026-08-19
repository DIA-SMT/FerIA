/**
 * Tipos y rutas de las variantes de una foto de producto.
 *
 * Está separado de `@/actions/fotos-producto` porque ese módulo es `"use server"`
 * y sólo puede exportar funciones async: los tipos, la constante y los dos
 * helpers de ruta viven acá. Los usan tanto la acción que genera las variantes
 * como la que guarda el producto.
 */

/** Las tres opciones que se le ofrecen al feriante. */
export type ClaveVariante = "original" | "automatica" | "ia";

export interface Variante {
  clave: ClaveVariante;
  titulo: string;
  /** Qué se le hizo, para mostrarlo debajo de la miniatura. */
  detalle: string;
  /** Ruta en Storage, ej. `productos/vendedores/<id>/<uuid>.webp`. */
  ruta: string;
  /** URL pública, para la miniatura. */
  url: string;
}

export interface EstadoVariantes {
  ok?: boolean;
  mensaje?: string;
  variantes?: Variante[];
  /** Error propio de la IA: las otras dos variantes siguen sirviendo. */
  errorIA?: string;
}

export const ESTADO_VARIANTES_INICIAL: EstadoVariantes = {};

/**
 * Carpeta donde van las fotos de un feriante.
 *
 * Prefijar con el id no es cosmético: las rutas de las variantes viajan al
 * cliente y vuelven en el formulario, así que al guardar hay que verificar que
 * cada ruta recibida esté dentro de la carpeta de quien la manda. Sin eso, un
 * feriante podría mandar la ruta de la foto de otro y hacérnosla borrar.
 */
export function carpetaDelVendedor(vendedorId: string): string {
  return `vendedores/${vendedorId}`;
}

/** ¿Esta ruta pertenece a la carpeta de este feriante? */
export function rutaEsDelVendedor(ruta: string, vendedorId: string): boolean {
  return ruta.startsWith(`productos/${carpetaDelVendedor(vendedorId)}/`);
}
