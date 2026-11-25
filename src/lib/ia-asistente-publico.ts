import type { Rubro } from "@prisma/client";
import { z } from "zod";

import {
  buscarFeriantesPublicos,
  modoFeriaPublico,
  RUBROS_PARA_BUSCAR,
  verFeriantePublico,
} from "@/lib/consultas-publicas";
import { tiposConPropuestas } from "@/lib/consultas-sello-propio";
import { prisma } from "@/lib/db";
import {
  contextoDelSitio,
  mensajeDeSistemaPublico,
  type AreaAsistente,
  type TurnoAsistente,
} from "@/lib/ia-asistente";
import {
  funcion,
  responderConHerramientas,
  type Ejecutores,
  type Herramienta,
  type RespuestaConHerramientas,
} from "@/lib/ia-herramientas";
import { RUBROS } from "@/lib/labels";
import { TIPOS_SELLO_PROPIO } from "@/lib/sello-propio";

/**
 * Migue en el sitio público, con consultas.
 *
 * Hasta el 24/11/2026 recibía el padrón entero en cada pregunta: unos 32.000
 * tokens, aunque preguntaran el horario de una feria. Ahora el prompt lleva
 * las ferias, cómo funciona el sitio y cuántos feriantes hay por rubro, y los
 * feriantes los busca cuando la pregunta los necesita.
 *
 * Las consultas son las mismas que cualquiera puede hacer en el sitio y no
 * traen datos de contacto (ver `consultas-publicas.ts`). Los enlaces que no
 * salieron de una consulta, de DATOS o de la guía se sacan antes de mostrar
 * la respuesta, como en los paneles.
 */

/** Lo que el modelo manda como «sin valor»: vacío o null. */
const opcional = <T extends z.ZodTypeAny>(esquema: T) =>
  z.preprocess(
    (valor) => (valor === "" || valor === null ? undefined : valor),
    esquema.optional(),
  );

const textoCorto = z.string().trim().min(1).max(80);

export const HERRAMIENTAS_PUBLICAS: Herramienta[] = [
  funcion(
    "buscar_feriantes",
    "Busca feriantes del catálogo por el nombre del emprendimiento (aunque esté mal escrito), por lo que venden (en sus productos y su descripción), por rubro o por feria. Los criterios se suman. Trae hasta 8, con su página, su rubro, sus ferias y algunos productos, y cuántos coinciden en total.",
    {
      texto: {
        type: "string",
        description:
          "Un nombre o lo que buscan, en una o dos palabras: «alfajores», «velas», «Doña Rosita». Sin «busco» ni «quiero».",
      },
      rubro: {
        type: "string",
        enum: RUBROS_PARA_BUSCAR,
        description: `Opcional. ${RUBROS_PARA_BUSCAR.map(
          (rubro) => `${rubro}: ${RUBROS[rubro]}`,
        ).join("; ")}.`,
      },
      feria: {
        type: "string",
        description: "Opcional: el slug de una feria de DATOS.",
      },
    },
  ),
  funcion(
    "ver_feriante",
    "Todo lo público de un feriante: su descripción, en qué ferias está habilitado, sus próximos stands con fecha y número, sus productos y sus propuestas de Modo Feria. El slug sale de buscar_feriantes.",
    { slug: { type: "string" } },
    ["slug"],
  ),
  funcion(
    "modo_feria",
    "Las propuestas publicadas de Modo Feria, que los feriantes ofrecen a empresas e instituciones: regalos con sello propio (productos, cajas, combos) y servicios con sello propio (food trucks, puestos, patios gastronómicos). Sin tipo trae los dos.",
    { tipo: { type: "string", enum: ["REGALO", "SERVICIO"] } },
  ),
];

export const EJECUTORES_PUBLICOS: Ejecutores = {
  buscar_feriantes: async (argumentos) =>
    buscarFeriantesPublicos(
      z
        .object({
          texto: opcional(textoCorto),
          rubro: opcional(z.enum(RUBROS_PARA_BUSCAR as [Rubro, ...Rubro[]])),
          feria: opcional(textoCorto),
        })
        .parse(argumentos ?? {}),
    ),
  ver_feriante: async (argumentos) =>
    verFeriantePublico(
      z.object({ slug: z.string().trim().min(1).max(120) }).parse(argumentos)
        .slug,
    ),
  modo_feria: async (argumentos) =>
    modoFeriaPublico(
      z
        .object({ tipo: opcional(z.enum(["REGALO", "SERVICIO"])) })
        .parse(argumentos ?? {}).tipo,
    ),
};

/** Las secciones del sitio, que se pueden enlazar siempre. */
const SECCIONES = ["/stands", "/ferias", "/registro", "/ingresar"];

/**
 * Lo que se puede enlazar sin que lo traiga una consulta: las secciones, las
 * ferias activas, Modo Feria si tiene algo publicado y las rutas que nombra
 * el prompt (la guía del panel, si pregunta un feriante sin sesión).
 */
async function rutasFijas(sistema: string): Promise<Set<string>> {
  const [ferias, tipos] = await Promise.all([
    prisma.feria.findMany({ where: { activa: true }, select: { slug: true } }),
    tiposConPropuestas(),
  ]);
  return new Set([
    ...SECCIONES,
    ...ferias.map((feria) => `/ferias/${feria.slug}`),
    ...(tipos.length > 0 ? ["/modo-feria"] : []),
    ...tipos.map((tipo) => TIPOS_SELLO_PROPIO[tipo].href),
    ...[...sistema.matchAll(/\((\/[^\s)]*)\)/g)].map((ruta) => ruta[1]!),
  ]);
}

/**
 * Responde una consulta del sitio público. Lanza `ErrorDeAsistente` si el
 * modelo no contesta.
 */
export async function responderConsultaPublica(
  historial: TurnoAsistente[],
  pregunta: string,
  opciones?: { modelo?: string; area?: AreaAsistente },
): Promise<RespuestaConHerramientas> {
  const sistema = mensajeDeSistemaPublico(
    await contextoDelSitio(),
    opciones?.area,
  );

  return responderConHerramientas({
    sistema,
    historial,
    pregunta,
    herramientas: HERRAMIENTAS_PUBLICAS,
    ejecutores: EJECUTORES_PUBLICOS,
    rutasFijas: await rutasFijas(sistema),
    etiqueta: "asistente-publico",
    modelo: opciones?.modelo,
  });
}
