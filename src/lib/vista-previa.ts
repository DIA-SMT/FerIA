"use client";

import { useEffect, useState } from "react";

/**
 * URL para mostrar un archivo que el navegador todavía no subió.
 *
 * Sirve para que elegir una foto se vea al instante en vez de dejar al feriante
 * mirando el nombre del archivo hasta que el servidor conteste.
 *
 * La URL se crea **dentro** del efecto, no en el `onChange`, justamente para que
 * la limpieza sea exacta: cada URL creada tiene su `revokeObjectURL` en el
 * mismo ciclo que la creó. Si se crearan afuera habría que acordarse de soltar
 * la anterior a mano en cada camino —cambio de archivo, borrado, desmontaje— y
 * cada URL olvidada retiene el archivo entero en memoria hasta que se cierre la
 * pestaña.
 */
export function useVistaPreviaLocal(archivo: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!archivo) {
      setUrl(null);
      return;
    }

    const creada = URL.createObjectURL(archivo);
    setUrl(creada);

    return () => URL.revokeObjectURL(creada);
  }, [archivo]);

  return url;
}
