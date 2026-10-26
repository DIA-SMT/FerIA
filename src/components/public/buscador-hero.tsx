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
export function BuscadorHero() {
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
      className="animar-aparecer mt-8 max-w-2xl"
      style={{ animationDelay: "360ms" }}
      role="search"
    >
      <label htmlFor="q-inicio" className="sr-only">
        {asistente
          ? "Preguntarle a Migue por un producto o una feria"
          : "Buscar una feria, un producto o un emprendimiento"}
      </label>

      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-lg shadow-slate-900/5 focus-within:border-municipal-400 focus-within:ring-2 focus-within:ring-municipal-500/20">
        <IconoBuscar className="ml-2 size-5 shrink-0 text-slate-400" />
        <input
          id="q-inicio"
          name="q"
          type="search"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="¿Qué producto o feria estás buscando?"
          className="min-w-0 flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-500 focus:outline-none"
        />
        {/* Redondo y sin texto, como la referencia. El nombre va en
            `aria-label`: sin eso, un lector de pantalla anuncia «botón» y no
            hay forma de saber qué hace. */}
        <button
          type="submit"
          aria-label={asistente ? "Preguntarle a Migue" : "Buscar"}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-municipal-500 text-white transition-colors hover:bg-municipal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600"
        >
          <IconoFlechaDerecha className="size-5" />
        </button>
      </div>

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
    </form>
  );
}
