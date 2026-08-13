/**
 * Une clases de Tailwind descartando los valores falsos.
 *
 * No resuelve conflictos entre utilidades (no es `tailwind-merge`): los
 * componentes están escritos para que la clase que llega por props vaya
 * siempre al final y gane por orden en la hoja de estilos.
 */
export function cn(
  ...clases: Array<string | false | null | undefined>
): string {
  return clases.filter(Boolean).join(" ");
}
