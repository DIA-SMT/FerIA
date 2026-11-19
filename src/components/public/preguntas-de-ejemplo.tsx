"use client";

import { useAsistente } from "@/components/public/estado-asistente";

/**
 * Preguntas para hacerle a Migue con un toque, en la caja «¿Buscás algo en
 * particular?» de la portada.
 *
 * Son ejemplos de lo que sabe contestar, y a la vez un atajo: con Migue
 * disponible, tocar una abre la burbuja con la pregunta ya enviada, igual que
 * el buscador del hero. Que haya respuesta no es casualidad: al elegirlas
 * había stands aprobados con empanadas y con mates. Si un día dejan de
 * estar, conviene cambiar la pregunta antes de que Migue conteste «no
 * encontré».
 *
 * Son enlaces de verdad, como el buscador es un formulario de verdad: sin
 * JavaScript, o sin el proveedor del asistente montado, llevan a la búsqueda
 * del directorio o a las ferias.
 */
const PREGUNTAS = [
  {
    emoji: "🥟",
    texto: "¿Dónde hay empanadas?",
    enlace: "/stands?q=empanadas",
  },
  { emoji: "🧉", texto: "¿Quién vende mates?", enlace: "/stands?q=mates" },
  { emoji: "📅", texto: "¿Qué feria hay este finde?", enlace: "/ferias" },
];

export function PreguntasDeEjemplo() {
  const asistente = useAsistente();

  return (
    <ul className="relative z-10 mt-5 flex flex-col items-start gap-2.5">
      {PREGUNTAS.map((pregunta) => (
        <li key={pregunta.texto}>
          <a
            href={pregunta.enlace}
            onClick={(evento) => {
              if (!asistente) return; // Que siga el enlace.
              evento.preventDefault();
              asistente.consultar(pregunta.texto);
            }}
            className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-municipal-200 bg-superficie px-3.5 py-2 text-sm font-semibold text-municipal-800 shadow-[0_2px_6px_rgb(8_102_243/0.08)] transition-colors hover:border-municipal-400 hover:bg-municipal-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-municipal-600"
          >
            <span aria-hidden="true">{pregunta.emoji}</span>
            {pregunta.texto}
          </a>
        </li>
      ))}
    </ul>
  );
}
