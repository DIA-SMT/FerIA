"use client";

import { useState } from "react";

import { useAsistente } from "@/components/public/estado-asistente";
import { IconoBuscar, IconoFlechaDerecha } from "@/components/ui/iconos";

/**
 * El buscador de la portada.
 *
 * Con Migue disponible, lo que se escribe acá **va directo a él**: se abre la
 * burbuja con la pregunta ya enviada. Es mejor que una grilla filtrada para lo
 * que la gente escribe de verdad en una caja así —«dónde consigo dulce de
 * cayote», «qué feria hay el sábado»—: eso no es una búsqueda por palabra, es
 * una pregunta, y el asistente contesta con el stand y el enlace.
 *
 * **Sigue siendo un formulario GET de verdad.** El `action` apunta a
 * `/stands?q=`, que ya busca por emprendimiento, descripción, producto y nombre
 * de feria, y el JavaScript sólo intercepta el envío. Así:
 *
 * · sin JavaScript, busca en el directorio como cualquier formulario;
 * · sin `OPENROUTER_API_KEY` el proveedor del asistente no se monta, el hook
 *   devuelve `null` y vuelve a ser un formulario común;
 * · con todo andando, va a Migue.
 *
 * Es decir, la mejora se apila sobre algo que funciona, en vez de reemplazarlo.
 */
export function BuscadorHero({
  variante = "portada",
}: {
  /**
   * `ruta` es el del hero «Ruta de ferias»: sin la ayuda de abajo —la dice el
   * globo «Preguntale a Migue»— y con la lupa en el botón.
   */
  variante?: "portada" | "ruta";
} = {}) {
  const ruta = variante === "ruta";
  const asistente = useAsistente();
  const [texto, setTexto] = useState("");

  function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    if (!asistente) return; // Que siga su curso: GET a /stands.

    const pregunta = texto.trim();
    if (!pregunta) {
      evento.preventDefault();
      return;
    }

    evento.preventDefault();
    asistente.consultar(pregunta);
    setTexto("");
  }

  return (
    <form
      action="/stands"
      onSubmit={alEnviar}
      className={ruta ? "w-full" : "animar-aparecer mt-8 max-w-2xl"}
      style={ruta ? undefined : { animationDelay: "360ms" }}
      role="search"
    >
      <label htmlFor="q-inicio" className="sr-only">
        {asistente
          ? "Preguntarle a Migue por un producto o una feria"
          : "Buscar una feria, un producto o un emprendimiento"}
      </label>

      <div
        className={
          ruta
            ? // El `.searchForm` del kit, con sus colores de día y de noche.
              "flex h-14 items-center gap-[11px] rounded-2xl border-2 border-[#e2edff] bg-superficie py-1 pr-[5px] pl-3.5 text-[#6d83a6] shadow-[0_4px_18px_rgb(9_39_99/0.15)] focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[#0D6EFD60] xl:h-[4.6cqw] dark:border-[#7fa7ed] dark:bg-[#112e60] dark:text-white"
            : "flex items-center gap-3 rounded-2xl border border-slate-200 bg-superficie p-2.5 shadow-lg shadow-slate-900/5 focus-within:border-municipal-400 focus-within:ring-2 focus-within:ring-municipal-500/20"
        }
      >
        <IconoBuscar
          className={
            ruta ? "size-5 shrink-0" : "ml-2 size-5 shrink-0 text-slate-400"
          }
        />
        <input
          id="q-inicio"
          name="q"
          type="search"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="¿Qué producto o feria estás buscando?"
          className={
            ruta
              ? "min-w-0 flex-1 bg-transparent text-[0.95rem] font-semibold text-[#12305f] placeholder:text-[#536d91] focus:outline-none xl:text-[1.3cqw] dark:text-white dark:placeholder:text-[#e8f1ff]"
              : "min-w-0 flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-500 focus:outline-none"
          }
        />
        {/* Redondo y sin texto, como la referencia. El nombre va en
            `aria-label`: sin eso, un lector de pantalla anuncia «botón» y no
            hay forma de saber qué hace. */}
        <button
          type="submit"
          aria-label={asistente ? "Preguntarle a Migue" : "Buscar"}
          className={`paleta-original flex shrink-0 items-center justify-center ${ruta ? "h-full w-[clamp(42px,4.1cqw,52px)] rounded-xl bg-[#0866f3] shadow-[0_4px_10px_rgb(7_100_236/0.18)]" : "size-11 rounded-full bg-municipal-500"} text-white transition-colors hover:bg-municipal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600`}
        >
          {ruta ? (
            <IconoBuscar className="size-5" />
          ) : (
            <IconoFlechaDerecha className="size-5" />
          )}
        </button>
      </div>

      {!ruta && (
        <p className="mt-3 text-sm text-slate-600">
          {asistente ? (
            <>
              Preguntale a Migue y te dice en qué feria y en qué stand
              conseguirlo. Ej.: dulce de cayote, mates, qué feria hay el sábado.
            </>
          ) : (
            <>
              Buscá por nombre de la feria, producto o emprendimiento. Ej.:
              frutas, artesanías, yerba, Feria Parque Avellaneda.
            </>
          )}
        </p>
      )}
    </form>
  );
}
