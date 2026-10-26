"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * El canal entre el buscador de la portada y la burbuja de Migue.
 *
 * Son dos componentes lejanos —el buscador vive en la página y la burbuja en el
 * layout público— así que no alcanza con pasar props. Va por contexto, igual
 * que el carrito.
 *
 * Lo que **no** se usó, y vale anotar por qué: pasar la consulta por la URL
 * (`/?consulta=...`). Habría funcionado sin JavaScript, pero las preguntas al
 * asistente se registran de forma anónima a propósito —sin IP y sin sesión, y
 * así está declarado en los términos—, y meter el texto en la URL lo deja en el
 * historial del navegador y en los registros de acceso del hosting, esta vez sí
 * junto a la IP. Sería romper por la puerta de atrás una promesa que el sistema
 * cumple por la de adelante.
 */

interface ValorAsistente {
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
  alternar: () => void;
  /**
   * Consulta que llegó desde afuera y que la burbuja todavía no mandó.
   *
   * La burbuja la lee de acá y después llama a `limpiarConsulta()`. El primer
   * intento fue un `tomarConsulta()` que devolvía el valor y lo limpiaba en el
   * mismo paso, leyéndolo desde el callback del setter: no funciona. El setter
   * es asincrónico, así que la función devolvía `null` y la pregunta nunca se
   * mandaba —la burbuja se abría vacía—. Leer del estado y limpiar aparte es
   * más largo de escribir y es lo que anda.
   */
  consultaPendiente: string | null;
  consultar: (pregunta: string) => void;
  limpiarConsulta: () => void;
}

const Contexto = createContext<ValorAsistente | null>(null);

export function ProveedorAsistente({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [consultaPendiente, setConsultaPendiente] = useState<string | null>(
    null,
  );

  const abrir = useCallback(() => setAbierto(true), []);
  const cerrar = useCallback(() => setAbierto(false), []);
  const alternar = useCallback(() => setAbierto((estado) => !estado), []);

  const consultar = useCallback((pregunta: string) => {
    const limpia = pregunta.trim();
    if (!limpia) return;
    setConsultaPendiente(limpia);
    setAbierto(true);
  }, []);

  const limpiarConsulta = useCallback(() => setConsultaPendiente(null), []);

  const valor = useMemo<ValorAsistente>(
    () => ({
      abierto,
      abrir,
      cerrar,
      alternar,
      consultaPendiente,
      consultar,
      limpiarConsulta,
    }),
    [
      abierto,
      abrir,
      cerrar,
      alternar,
      consultaPendiente,
      consultar,
      limpiarConsulta,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * Devuelve `null` fuera del proveedor en lugar de tirar, al revés que
 * `useCarrito`.
 *
 * No es inconsistencia: el buscador de la portada se dibuja siempre, con IA
 * configurada o sin ella, y sin `OPENROUTER_API_KEY` el proveedor no se monta.
 * Que el hook tire en ese caso dejaría la portada en blanco por no tener una
 * clave de API. Quien lo consume decide qué hacer cuando no hay asistente; el
 * buscador, por ejemplo, se comporta como un formulario común.
 */
export function useAsistente(): ValorAsistente | null {
  return useContext(Contexto);
}
