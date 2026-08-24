"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { preguntarAlAsistente } from "@/actions/asistente";
import { IconoCerrar, IconoChat, IconoEnviar } from "@/components/ui/iconos";
import type { TurnoAsistente } from "@/lib/ia-asistente";

/**
 * La burbuja del asistente, presente en todas las páginas públicas.
 *
 * La conversación vive en el estado del componente y muere al recargar: no hay
 * sesión ni identificador del visitante. Lo único que persiste es la pregunta,
 * que la acción guarda de forma anónima (está declarado en los términos).
 *
 * El texto del asistente se renderiza con `TextoConEnlaces`, que convierte
 * `[texto](/ruta)` en <Link> y deja TODO lo demás como texto plano. Eso no es
 * un renderer de markdown a medias: es la superficie mínima. El modelo tiene
 * prohibido otro formato, y aunque lo desobedeciera —o una inyección le hiciera
 * emitir HTML—, acá nada se interpreta: sólo se enlazan rutas internas.
 */

const SALUDO: TurnoAsistente = {
  rol: "asistente",
  texto:
    "¡Hola! Puedo ayudarte a encontrar productos y feriantes, contarte cuándo es cada feria o explicarte cómo participar. ¿Qué estás buscando?",
};

/** Convierte [texto](/ruta) en enlaces internos; el resto queda plano. */
function TextoConEnlaces({ texto }: { texto: string }) {
  const partes: ReactNode[] = [];
  const patron = /\[([^\]]+)\]\((\/[^\s)]*)\)/g;

  let cursor = 0;
  for (const coincidencia of texto.matchAll(patron)) {
    const [entero, etiqueta, ruta] = coincidencia;
    if (coincidencia.index > cursor) {
      partes.push(texto.slice(cursor, coincidencia.index));
    }
    partes.push(
      <Link
        key={`${ruta}-${coincidencia.index}`}
        href={ruta!}
        className="font-medium text-municipal-700 underline underline-offset-2 hover:text-municipal-800"
      >
        {etiqueta}
      </Link>,
    );
    cursor = coincidencia.index + entero.length;
  }
  if (cursor < texto.length) partes.push(texto.slice(cursor));

  return <>{partes}</>;
}

export function AsistenteBurbuja() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<TurnoAsistente[]>([SALUDO]);
  const [borrador, setBorrador] = useState("");
  const [pendiente, iniciarTransicion] = useTransition();

  const listaRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLInputElement>(null);

  // La lista sigue al último mensaje, incluido el indicador de «pensando».
  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
  }, [mensajes, pendiente]);

  useEffect(() => {
    if (abierto) entradaRef.current?.focus();
  }, [abierto]);

  // Esc cierra el panel, como en cualquier diálogo. Es no-modal a propósito:
  // el vecino tiene que poder seguir navegando con el chat abierto.
  useEffect(() => {
    if (!abierto) return;
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  function enviar() {
    const pregunta = borrador.trim();
    if (!pregunta || pendiente) return;

    // El historial que ve el modelo es la conversación menos el saludo fijo.
    const historial = mensajes.slice(1);

    setMensajes((previos) => [...previos, { rol: "usuario", texto: pregunta }]);
    setBorrador("");

    iniciarTransicion(async () => {
      const respuesta = await preguntarAlAsistente(historial, pregunta);
      setMensajes((previos) => [
        ...previos,
        { rol: "asistente", texto: respuesta.texto },
      ]);
    });
  }

  return (
    <>
      {/* z-50: por encima del encabezado (z-30) y del menú móvil (z-40). */}
      <button
        type="button"
        onClick={() => setAbierto((estado) => !estado)}
        aria-expanded={abierto}
        aria-label={
          abierto ? "Cerrar el asistente" : "Abrir el asistente de ferias"
        }
        className="fixed right-4 bottom-4 z-50 flex size-14 items-center justify-center rounded-full bg-municipal-500 text-white shadow-lg transition-all hover:bg-municipal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600 active:scale-95"
      >
        {abierto ? (
          <IconoCerrar className="size-6" />
        ) : (
          <IconoChat className="size-6" />
        )}
      </button>

      {abierto && (
        <section
          role="dialog"
          aria-label="Asistente de ferias"
          className="animar-aparecer fixed right-4 bottom-21 z-50 flex h-[min(32rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <header className="flex items-center gap-2.5 border-b border-slate-200 bg-municipal-500 px-4 py-3">
            <IconoChat className="size-5 shrink-0 text-white" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">
                Asistente de ferias
              </h2>
              <p className="text-[11px] text-white/80">
                Municipalidad de San Miguel de Tucumán
              </p>
            </div>
          </header>

          <div
            ref={listaRef}
            className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
          >
            {mensajes.map((mensaje, indice) => (
              <div
                key={indice}
                className={
                  mensaje.rol === "usuario"
                    ? "ml-8 rounded-2xl rounded-br-sm bg-municipal-500 px-3.5 py-2.5 text-sm text-white"
                    : "mr-8 rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 text-sm whitespace-pre-line text-slate-800"
                }
              >
                {mensaje.rol === "asistente" ? (
                  <TextoConEnlaces texto={mensaje.texto} />
                ) : (
                  mensaje.texto
                )}
              </div>
            ))}

            {pendiente && (
              <div className="mr-8 flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-3">
                <span className="sr-only">El asistente está escribiendo</span>
                {[0, 150, 300].map((retraso) => (
                  <span
                    key={retraso}
                    className="animar-latir size-1.5 rounded-full bg-slate-400"
                    style={{ animationDelay: `${retraso}ms` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-3">
            <form
              onSubmit={(evento) => {
                evento.preventDefault();
                enviar();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={entradaRef}
                type="text"
                value={borrador}
                onChange={(evento) => setBorrador(evento.target.value)}
                maxLength={500}
                placeholder="Ej. ¿quién vende mates?"
                aria-label="Tu consulta para el asistente"
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-municipal-500 focus:ring-2 focus:ring-municipal-500/30 focus:outline-none"
              />
              <button
                type="submit"
                disabled={pendiente || borrador.trim().length < 2}
                aria-label="Enviar la consulta"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-municipal-500 text-white transition-colors hover:bg-municipal-600 disabled:pointer-events-none disabled:opacity-50"
              >
                <IconoEnviar className="size-4.5" />
              </button>
            </form>

            <p className="mt-2 text-[11px] leading-snug text-slate-400">
              Respuestas generadas con inteligencia artificial: pueden contener
              errores. Verificá en la página de cada stand.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
