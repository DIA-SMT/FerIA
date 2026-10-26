"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { preguntarAlAsistente } from "@/actions/asistente";
import { IconoCerrar, IconoEnviar } from "@/components/ui/iconos";
import { useAsistente } from "@/components/public/estado-asistente";
import type { TurnoAsistente } from "@/lib/ia-asistente";

/**
 * La cara de Migue, para la burbuja y el encabezado del chat.
 *
 * Es un cuadrado ya recortado y no el dibujo de cuerpo entero. El primer
 * intento fue encuadrar la cabeza del dibujo grande con `scale` y
 * `object-position`, y no funcionó: lo que entraba en el círculo de 56 px era
 * la mano, no la cara. Un recorte que depende de dos números calibrados a ojo
 * se desencuadra apenas cambia el tamaño del contenedor.
 *
 * El archivo salió de `migue.webp` con un `extract` de 640×640 sobre la
 * cabeza, reducido a 320. Conserva la transparencia, así que apoya limpio
 * sobre el círculo azul.
 */
const MIGUE_CARA = "/migue-cara.webp";

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
  // El estado de apertura vive en el contexto y no acá porque el buscador de
  // la portada también la abre. `useAsistente` puede devolver `null` sólo si
  // alguien monta la burbuja fuera del proveedor; el layout público siempre la
  // monta adentro, así que el respaldo es defensivo y no un caso real.
  const asistente = useAsistente();
  const [abiertoLocal, setAbiertoLocal] = useState(false);
  const abierto = asistente?.abierto ?? abiertoLocal;
  const setAbierto = useCallback(
    (valor: boolean) => {
      if (asistente) {
        if (valor) asistente.abrir();
        else asistente.cerrar();
        return;
      }
      setAbiertoLocal(valor);
    },
    [asistente],
  );

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
  }, [abierto, setAbierto]);

  /*
    El historial que ve el modelo sale de una ref y no del estado.

    Hace falta porque `preguntar` lo llaman dos lugares: el formulario del chat
    —donde el estado del render alcanza— y un efecto, cuando la consulta viene
    del buscador de la portada. Desde el efecto, `mensajes` sería el valor de un
    render anterior.

    El primer intento fue leerlo desde adentro del updater de `setMensajes`.
    Parecía elegante y está prohibido: React corre el updater durante el render
    y ahí no se puede llamar a `startTransition`. La consola tiraba «Cannot call
    startTransition while rendering» y la pregunta no se mandaba nunca.
  */
  const mensajesRef = useRef<TurnoAsistente[]>([SALUDO]);
  useEffect(() => {
    mensajesRef.current = mensajes;
  }, [mensajes]);

  const preguntar = useCallback((pregunta: string) => {
    // La conversación menos el saludo fijo, que el modelo no necesita ver.
    const historial = mensajesRef.current.slice(1);

    setMensajes((previos) => [...previos, { rol: "usuario", texto: pregunta }]);

    iniciarTransicion(async () => {
      const respuesta = await preguntarAlAsistente(historial, pregunta);
      setMensajes((actuales) => [
        ...actuales,
        { rol: "asistente", texto: respuesta.texto },
      ]);
    });
  }, []);

  function enviar() {
    const pregunta = borrador.trim();
    if (!pregunta || pendiente) return;
    setBorrador("");
    preguntar(pregunta);
  }

  // Una consulta que vino del buscador de la portada. Se limpia ANTES de
  // mandarla: si se limpiara después, el efecto volvería a correr con la misma
  // consulta todavía puesta y la preguntaría dos veces, que acá además son dos
  // llamadas pagas al modelo.
  useEffect(() => {
    const pregunta = asistente?.consultaPendiente;
    if (!pregunta || pendiente) return;
    asistente.limpiarConsulta();
    preguntar(pregunta);
  }, [asistente, pendiente, preguntar]);

  return (
    <>
      {/* z-50: por encima del encabezado (z-30) y del menú móvil (z-40). */}
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        aria-label={
          abierto ? "Cerrar a Migue" : "Abrir a Migue, el asistente de ferias"
        }
        className="fixed right-4 bottom-4 z-50 flex size-14 items-center justify-center overflow-hidden rounded-full bg-municipal-500 text-white shadow-lg transition-all hover:bg-municipal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600 active:scale-95"
      >
        {/* Cerrada muestra la cara y abierta la cruz. La cara es lo que hace
            que alguien la toque: un ícono de chat genérico, en un sitio
            municipal, se lee como «formulario de contacto». */}
        {abierto ? (
          <IconoCerrar className="size-6" />
        ) : (
          <Image
            src={MIGUE_CARA}
            alt=""
            width={320}
            height={320}
            className="size-full object-cover"
          />
        )}
      </button>

      {abierto && (
        <section
          role="dialog"
          aria-label="Migue, el asistente de ferias"
          className="animar-aparecer fixed right-4 bottom-21 z-50 flex h-[min(32rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          {/* La cara va acá y no sólo en la portada: es lo que convierte una
              ventana de chat anónima en alguien con quien se habla. El recorte
              redondo toma la cabeza, que es la parte reconocible del dibujo. */}
          <header className="flex items-center gap-3 border-b border-slate-200 bg-municipal-500 px-4 py-3">
            <span className="size-10 shrink-0 overflow-hidden rounded-full bg-white/15 ring-1 ring-white/30">
              <Image
                src={MIGUE_CARA}
                alt=""
                width={320}
                height={320}
                className="size-full object-cover"
              />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">Migue</h2>
              <p className="text-[11px] text-white/80">
                Asistente de las ferias municipales
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
