"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import { esControlDeFlujoDeNext } from "@/lib/errores";
import { responderConsultaAdmin } from "@/lib/ia-asistente-admin";
import {
  CONSULTA_DE_FINANZAS,
  esDeFinanzas,
  responderConsultaFeriante,
  type FerianteDeLaSesion,
} from "@/lib/ia-asistente-feriante";
import {
  AREAS_ASISTENTE,
  ErrorDeAsistente,
  responderConsulta,
  type AreaAsistente,
  type TurnoAsistente,
} from "@/lib/ia-asistente";
import { obtenerSesion, type SesionApp } from "@/lib/session";

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

function superaElLimite(
  ip: string,
  registro: Map<string, number[]> = consultasPorIp,
  maximo: number = MAXIMO_EN_VENTANA,
): boolean {
  const ahora = Date.now();
  const recientes = (registro.get(ip) ?? []).filter(
    (momento) => ahora - momento < VENTANA_MS,
  );

  if (recientes.length >= maximo) {
    registro.set(ip, recientes);
    return true;
  }

  recientes.push(ahora);
  registro.set(ip, recientes);

  // Que el mapa no crezca sin techo con IPs que nunca vuelven.
  if (registro.size > 5000) {
    for (const [clave, momentos] of registro) {
      if (momentos.every((momento) => ahora - momento >= VENTANA_MS)) {
        registro.delete(clave);
      }
    }
  }

  return false;
}

/**
 * En el panel, el límite es por persona y más holgado: son pocas cuentas, y
 * una consulta lleva a otra («¿y en qué stand está?»). Cada pregunta puede
 * costar dos o tres vueltas con el modelo, así que el tope sigue existiendo.
 */
const MAXIMO_ADMIN_EN_VENTANA = 40;
const consultasPorAdmin = new Map<string, number[]>();

/** Lo mismo para cada feriante: armar una ficha de costos son varias vueltas. */
const MAXIMO_FERIANTE_EN_VENTANA = 30;
const consultasPorFeriante = new Map<string, number[]>();

/** Guarda una pregunta en el registro anónimo y poda lo de más de un año. */
async function registrarAnonima(pregunta: string): Promise<void> {
  try {
    const haceUnAnio = new Date();
    haceUnAnio.setUTCFullYear(haceUnAnio.getUTCFullYear() - 1);

    await prisma.$transaction([
      prisma.consultaAsistente.create({ data: { pregunta } }),
      prisma.consultaAsistente.deleteMany({
        where: { creadoEn: { lt: haceUnAnio } },
      }),
    ]);
  } catch (error) {
    console.error("[asistente] no se pudo registrar la consulta", error);
  }
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
      rol:
        turno.rol === "asistente"
          ? ("asistente" as const)
          : ("usuario" as const),
      texto: turno.texto.slice(0, MAXIMO_TEXTO_TURNO),
    }))
    .slice(-MAXIMO_TURNOS);
}

/**
 * El camino del panel: con las consultas de administración y con constancia
 * de quién preguntó. No pasa por el registro anónimo del público, que es para
 * saber qué busca la gente.
 */
async function responderComoAdmin(
  sesion: SesionApp,
  historial: TurnoAsistente[],
  pregunta: string,
): Promise<RespuestaAsistente> {
  if (superaElLimite(sesion.id, consultasPorAdmin, MAXIMO_ADMIN_EN_VENTANA)) {
    return {
      ok: false,
      texto:
        "Hiciste muchas consultas seguidas. Esperá unos minutos y probá de nuevo.",
    };
  }

  let herramientas: string[] = [];
  let fallo = false;
  try {
    const respuesta = await responderConsultaAdmin(
      sanearHistorial(historial),
      pregunta,
    );
    herramientas = respuesta.herramientas;
    return { ok: true, texto: respuesta.texto };
  } catch (error) {
    fallo = true;
    throw error;
  } finally {
    // Si falla el registro, la respuesta sale igual.
    try {
      const haceUnAnio = new Date();
      haceUnAnio.setUTCFullYear(haceUnAnio.getUTCFullYear() - 1);
      await prisma.$transaction([
        prisma.consultaAdmin.create({
          data: { usuarioId: sesion.id, pregunta, herramientas, fallo },
        }),
        prisma.consultaAdmin.deleteMany({
          where: { creadoEn: { lt: haceUnAnio } },
        }),
      ]);
    } catch (error) {
      console.error(
        "[asistente-admin] no se pudo registrar la consulta",
        error,
      );
    }
  }
}

/**
 * El camino del feriante: con las consultas de su propio stand. Al registro
 * anónimo va la pregunta, salvo que sea de finanzas.
 */
async function responderComoFeriante(
  feriante: FerianteDeLaSesion,
  usuarioId: string,
  historial: TurnoAsistente[],
  pregunta: string,
): Promise<RespuestaAsistente> {
  if (
    superaElLimite(usuarioId, consultasPorFeriante, MAXIMO_FERIANTE_EN_VENTANA)
  ) {
    return {
      ok: false,
      texto:
        "Hiciste muchas consultas seguidas. Esperá unos minutos y probá de nuevo.",
    };
  }

  const anterior = sanearHistorial(historial);
  let herramientas: string[] = [];
  try {
    const respuesta = await responderConsultaFeriante(
      feriante,
      anterior,
      pregunta,
    );
    herramientas = respuesta.herramientas;
    return { ok: true, texto: respuesta.texto };
  } finally {
    await registrarAnonima(
      esDeFinanzas(pregunta, anterior, herramientas)
        ? CONSULTA_DE_FINANZAS
        : pregunta,
    );
  }
}

export async function preguntarAlAsistente(
  historial: TurnoAsistente[],
  pregunta: string,
  area?: AreaAsistente,
): Promise<RespuestaAsistente> {
  try {
    // Viene del cliente: lo que no sea un área conocida se trata como público.
    let areaValida: AreaAsistente = AREAS_ASISTENTE.includes(
      area as AreaAsistente,
    )
      ? (area as AreaAsistente)
      : "publico";

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

    // El área la dice el navegador, y no alcanza: Migue consulta los datos del
    // panel sólo si el servidor verifica que la sesión es de un administrador.
    // Cualquier otra que diga «administracion» recibe al Migue público.
    if (areaValida === "administracion") {
      const sesion = await obtenerSesion();
      if (sesion?.rol === "ADMIN") {
        return await responderComoAdmin(sesion, historial, texto);
      }
      areaValida = "publico";
    }

    // Lo mismo con el feriante: con su sesión y su ficha, Migue consulta su
    // stand. Sin eso, recibe al Migue público.
    if (areaValida === "feriante") {
      const sesion = await obtenerSesion();
      const vendedor =
        sesion?.rol === "VENDEDOR"
          ? await prisma.vendedor.findUnique({
              where: { usuarioId: sesion.id },
              select: { id: true, emprendimiento: true },
            })
          : null;
      if (sesion && vendedor) {
        return await responderComoFeriante(
          {
            vendedorId: vendedor.id,
            nombre: sesion.nombre,
            emprendimiento: vendedor.emprendimiento,
          },
          sesion.id,
          historial,
          texto,
        );
      }
      areaValida = "publico";
    }

    // `X-Real-IP` primero: nginx la pisa con la IP real de la conexión. El
    // primer valor de `X-Forwarded-For`, en cambio, lo escribe el cliente
    // (nginx agrega la suya al final), así que mandando uno distinto en cada
    // pedido se esquivaba el límite.
    const cabeceras = await headers();
    const ip =
      cabeceras.get("x-real-ip")?.trim() ||
      cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "sin-ip";

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
    await registrarAnonima(texto);

    const respuesta = await responderConsulta(
      sanearHistorial(historial),
      texto,
      {
        area: areaValida,
      },
    );
    return { ok: true, texto: respuesta };
  } catch (error) {
    if (esControlDeFlujoDeNext(error)) throw error;

    console.error("[asistente]", error);
    return {
      ok: false,
      texto:
        error instanceof ErrorDeAsistente
          ? "El asistente no está disponible en este momento. Probá de nuevo en un rato, o buscá directamente en el catálogo de emprendedores."
          : "Algo salió mal. Probá de nuevo en un rato.",
    };
  }
}
