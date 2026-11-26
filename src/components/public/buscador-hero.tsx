"use client";

import { useState } from "react";

import { useAsistente } from "@/components/public/estado-asistente";
import { IconoBuscar } from "@/components/ui/iconos";

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
      role="search"
    >
      <label htmlFor="q-inicio" className="sr-only">
        {asistente
          ? "Preguntarle a Migue por un producto o una feria"
          : "Buscar una feria, un producto o un emprendimiento"}
      </label>

      <IconoBuscar className="size-5 shrink-0" />
      <input
        id="q-inicio"
        name="q"
        type="search"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder="Preguntale a Migue por un producto o una feria"
      />
      <button type="submit">Buscar</button>
    </form>
  );
}
