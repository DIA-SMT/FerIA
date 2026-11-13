/**
 * Límite de ritmo en memoria: como mucho `maximo` usos por clave dentro de una
 * ventana de `ventanaMs`.
 *
 * Es el mismo mecanismo simple que el de Migue (`src/actions/asistente.ts`):
 * vive en la memoria del proceso. En la VPS corre un solo proceso, así que el
 * tope es exacto; si algún día hubiera varios, cada uno llevaría su cuenta y el
 * tope real sería mayor. Alcanza para lo que importa, que es que nadie pueda
 * gastar llamadas pagas a la IA sin techo.
 */
export function crearLimiteDeRitmo({
  ventanaMs,
  maximo,
}: {
  ventanaMs: number;
  maximo: number;
}): (clave: string, ahora?: number) => boolean {
  const usos = new Map<string, number[]>();

  /** Devuelve `true` si la clave ya llegó al tope; si no, cuenta este uso. */
  return function supera(clave: string, ahora = Date.now()): boolean {
    const recientes = (usos.get(clave) ?? []).filter(
      (momento) => ahora - momento < ventanaMs,
    );

    if (recientes.length >= maximo) {
      usos.set(clave, recientes);
      return true;
    }

    recientes.push(ahora);
    usos.set(clave, recientes);

    // Que el mapa no crezca sin techo con claves que nunca vuelven.
    if (usos.size > 5000) {
      for (const [otra, momentos] of usos) {
        if (momentos.every((momento) => ahora - momento >= ventanaMs)) {
          usos.delete(otra);
        }
      }
    }

    return false;
  };
}
