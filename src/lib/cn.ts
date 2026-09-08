import { twMerge } from "tailwind-merge";

/**
 * Une clases de Tailwind resolviendo los conflictos: **gana la última**.
 *
 * Antes esto era un `join(" ")` y el comentario decía que la clase que llega
 * por props gana «por orden en la hoja de estilos». Eso es falso como
 * garantía: el navegador no mira el orden del atributo `class`, mira el orden
 * en que Tailwind emitió cada regla. Costó tres veces averiguarlo:
 *
 * · `ImagenPortada` no podía recibir un `bg-*` por props, así que la decisión
 *   del fondo tuvo que mudarse adentro del componente.
 * · La vidriera del stand pedía `tamanio="lg"` y encima mandaba `size-24`: en
 *   el HTML de producción convivían `size-16`, `size-24` y `sm:size-28`, y
 *   funcionaba de casualidad porque Tailwind ordena por número y 24 > 16.
 * · Quedaban seis `bg-*` de llamador —`Badge` y `BotonLink`— apoyados en la
 *   misma casualidad.
 *
 * `twMerge` conoce los grupos de utilidades de Tailwind y descarta la anterior
 * cuando dos pertenecen al mismo grupo, así que el orden pasa a ser el del
 * código. Distingue variantes: `w-full` y `sm:w-auto` no compiten, y conviven
 * como corresponde. Las clases que no son de Tailwind —`velo-hero`,
 * `trama-puntos`, `lineas-2`, `animar-aparecer`— las deja pasar intactas.
 */
export function cn(
  ...clases: Array<string | false | null | undefined>
): string {
  return twMerge(...clases);
}
