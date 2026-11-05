"use client";

import type { ReactNode } from "react";

/** Qué se está consultando. Uno u otro, nunca los dos. */
export type EventoDeConsulta = { producto: string } | { stand: string };

interface PropsEnlaceConsulta {
  href: string;
  evento: EventoDeConsulta;
  className?: string;
  children: ReactNode;
}

/**
 * El enlace a WhatsApp, avisando de paso que alguien preguntó.
 *
 * Es la única señal que distingue un producto de otro dentro de un stand: no
 * hay página por producto, así que la vista no dice nada y el clic acá sí.
 *
 * Tres cosas que son a propósito:
 *
 *   · El `href` sigue siendo el de wa.me. Si el beacon falla, lo bloquea una
 *     extensión o no hay JavaScript, el vecino llega igual a WhatsApp. El
 *     contador no se mete nunca en el camino de la consulta.
 *   · `sendBeacon` y no `fetch`: está hecho para sobrevivir a que la página se
 *     vaya, no necesita que esperemos la respuesta y no retrasa el clic.
 *   · No se manda nada sobre quién es el que consulta, porque no se guarda
 *     nada sobre quién es el que consulta. Ver docs/interes-en-la-vidriera.md.
 */
export function EnlaceConsulta({
  href,
  evento,
  className,
  children,
}: PropsEnlaceConsulta) {
  function avisar() {
    try {
      navigator.sendBeacon?.(
        "/api/interes",
        new Blob([JSON.stringify(evento)], { type: "application/json" }),
      );
    } catch {
      // Un contador roto no es motivo para no dejar consultar.
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={avisar}
    >
      {children}
    </a>
  );
}
