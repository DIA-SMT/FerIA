"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import { esControlDeFlujoDeNext } from "@/lib/errores";
import {
  ErrorDeAsistente,
  responderConsulta,
  type TurnoAsistente,
} from "@/lib/ia-asistente";

/**
 * La acción pública del asistente.
 *
 * Es el único punto del sitio donde un visitante anónimo dispara un gasto (cada
 * consulta cuesta ~US$ 0,001 medidos), así que acá viven las tres defensas:
 * validación de tamaño, límite de ritmo por IP y tope de historial.
 */

export interface RespuestaAsistente {
  ok: boolean;
  texto: string;
}

const MAXIMO_PREGUNTA = 500;
const MAXIMO_TURNOS = 8;
const MAXIMO_TEXTO_TURNO = 2000;

/**
 * Límite de ritmo: 10 preguntas por IP cada 10 minutos.
 *
 * Vive en memoria y es deliberadamente el mecanismo simple: en serverless cada
 * instancia tiene su propio mapa, así que el tope real puede ser algo mayor que
 * 10 —una por instancia—. Alcanza para cortar el abuso grosero, que es el
 * riesgo económico real; un límite exacto pediría un almacén compartido que hoy
 * no se justifica. La IP no se guarda en ningún lado: se usa y se descarta, que
 * es lo que permite que el registro de preguntas sea anónimo de verdad.
 */
const VENTANA_MS = 10 * 60 * 1000;
const MAXIMO_EN_VENTANA = 10;
const consultasPorIp = new Map<string, number[]>();

function superaElLimite(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (consultasPorIp.get(ip) ?? []).filter(
    (momento) => ahora - momento < VENTANA_MS,
  );

  if (recientes.length >= MAXIMO_EN_VENTANA) {
    consultasPorIp.set(ip, recientes);
    return true;
  }

  recientes.push(ahora);
  consultasPorIp.set(ip, recientes);

  // Que el mapa no crezca sin techo con IPs que nunca vuelven.
  if (consultasPorIp.size > 5000) {
    for (const [clave, momentos] of consultasPorIp) {
      if (momentos.every((momento) => ahora - momento >= VENTANA_MS)) {
        consultasPorIp.delete(clave);
      }
    }
  }

  return false;
}

/** El historial que manda el cliente es hostil hasta que se demuestre lo contrario. */
function sanearHistorial(historial: unknown): TurnoAsistente[] {
  if (!Array.isArray(historial)) return [];

  return historial
    .filter(
      (turno): turno is { rol: string; texto: string } =>
        typeof turno === "object" &&
        turno !== null &&
        "rol" in turno &&
        "texto" in turno &&
        typeof (turno as { texto: unknown }).texto === "string",
    )
    .map((turno) => ({
      rol: turno.rol === "asistente" ? ("asistente" as const) : ("usuario" as const),
      texto: turno.texto.slice(0, MAXIMO_TEXTO_TURNO),
    }))
    .slice(-MAXIMO_TURNOS);
}

export async function preguntarAlAsistente(
  historial: TurnoAsistente[],
  pregunta: string,
): Promise<RespuestaAsistente> {
  try {
    const texto = String(pregunta ?? "").trim();

    if (texto.length < 2) {
      return { ok: false, texto: "Escribí una consulta para poder ayudarte." };
    }
    if (texto.length > MAXIMO_PREGUNTA) {
      return {
        ok: false,
        texto: `La consulta es muy larga: hasta ${MAXIMO_PREGUNTA} caracteres.`,
      };
    }

    const cabeceras = await headers();
    const ip =
      cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "sin-ip";

    if (superaElLimite(ip)) {
      return {
        ok: false,
        texto:
          "Hiciste muchas consultas seguidas. Esperá unos minutos y probá de nuevo.",
      };
    }

    // Registro anónimo: el texto de la pregunta y nada más, para que la
    // Dirección sepa qué busca la gente. Está declarado en los términos. Si
    // falla, la respuesta sale igual: registrar es secundario a responder.
    //
    // La poda hace verdadera la retención que prometen los términos («se
    // conservan por un plazo máximo de doce meses») sin depender de un cron:
    // cada alta borra lo vencido. A este volumen es un WHERE sobre un índice.
    try {
      const haceUnAnio = new Date();
      haceUnAnio.setUTCFullYear(haceUnAnio.getUTCFullYear() - 1);

      await prisma.$transaction([
        prisma.consultaAsistente.create({ data: { pregunta: texto } }),
        prisma.consultaAsistente.deleteMany({
          where: { creadoEn: { lt: haceUnAnio } },
        }),
      ]);
    } catch (error) {
      console.error("[asistente] no se pudo registrar la consulta", error);
    }

    const respuesta = await responderConsulta(sanearHistorial(historial), texto);
    return { ok: true, texto: respuesta };
  } catch (error) {
    if (esControlDeFlujoDeNext(error)) throw error;

    console.error("[asistente]", error);
    return {
      ok: false,
      texto:
        error instanceof ErrorDeAsistente
          ? "El asistente no está disponible en este momento. Probá de nuevo en un rato, o buscá directamente en el directorio de stands."
          : "Algo salió mal. Probá de nuevo en un rato.",
    };
  }
}
