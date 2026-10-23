import OpenAI from "openai";

/**
 * Cliente de OpenRouter (API compatible con OpenAI).
 *
 * Lo usan la edición de fotos de producto (`@/lib/ia-imagenes`), la redacción
 * asistida de descripciones (`@/lib/ia-texto`) y el asistente público
 * (`@/lib/ia-asistente`).
 *
 * **Acá no hay modelo por defecto, a propósito.** Había uno genérico
 * (`OPENROUTER_MODEL`) y era una trampa: un modelo de texto y uno de imagen no
 * son intercambiables, así que la función de texto terminó heredando el modelo
 * de imagen que estaba cargado en el `.env` y saliendo a producir texto con él.
 * Cada módulo declara el suyo y su propia variable.
 *
 * Configuración en `.env`:
 *   OPENROUTER_API_KEY          — obligatoria para poder usarlo
 *   OPENROUTER_MODELO_IMAGEN    — modelo de imagen (opcional, ver ia-imagenes.ts)
 *   OPENROUTER_MODELO_TEXTO     — modelo de texto  (opcional, ver ia-texto.ts)
 *   OPENROUTER_MODELO_ASISTENTE — modelo del asistente (opcional, ver ia-asistente.ts)
 *   OPENROUTER_SITE_URL         — cabecera de atribución de OpenRouter (opcional)
 *   OPENROUTER_SITE_NAME        — cabecera de atribución de OpenRouter (opcional)
 */

const BASE_URL = "https://openrouter.ai/api/v1";

/**
 * `true` si hay una API key cargada; permite degradar sin romper la app.
 *
 * Se consulta donde se **ofrece** una función de IA, no donde falla: sin key,
 * la burbuja del asistente se montaba igual en todas las páginas públicas y le
 * contestaba un error genérico a cada vecino que la abría.
 *
 * Es server-only —lee `process.env` del servidor, que en el navegador está
 * vacío—, así que los componentes de cliente reciben el resultado por props
 * desde el Server Component que los monta, nunca importando esta función.
 */
export function hayIAConfigurada(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** Perfil de paciencia y reintentos según lo que cueste la llamada. */
export type PerfilIA = "texto" | "imagen";

/**
 * El SDK trae 600000 ms (diez minutos) de timeout y 2 reintentos, y con esos
 * valores salimos a producción: un 429 de OpenRouter facturaba hasta tres
 * generaciones de imagen por un solo click del feriante, y una llamada colgada
 * se comía diez minutos de función.
 *
 * - `texto`: redacción y asistente. 20 s porque hay alguien mirando la pantalla
 *   mientras espera, y un reintento porque son llamadas baratas y un 429 suelto
 *   no tiene por qué llegar hasta el vecino.
 * - `imagen`: edición de fotos de producto. 45 s porque la generación mide ~11 s
 *   y el margen es para la cola de OpenRouter, y **cero** reintentos porque cada
 *   intento se factura: ante un 429 conviene devolver las dos variantes
 *   deterministas antes que pagar la misma foto dos veces.
 */
const PERFILES: Record<PerfilIA, { timeout: number; maxRetries: number }> = {
  texto: { timeout: 20_000, maxRetries: 1 },
  imagen: { timeout: 45_000, maxRetries: 0 },
};

/** Un cliente por perfil: `timeout` y `maxRetries` se fijan al construirlo. */
const clientesPorPerfil = new Map<PerfilIA, OpenAI>();

/**
 * Devuelve el cliente de OpenRouter del perfil pedido.
 *
 * El perfil por defecto es `texto`, que es el que corresponde a los dos
 * llamadores que no pasan argumento: `@/lib/ia-texto` y `@/lib/ia-asistente`.
 * `@/lib/ia-imagenes` pide `"imagen"` explícitamente, porque su llamada tarda
 * del orden de diez veces más y es la que cuesta plata al reintentarse.
 *
 * Se construye de forma perezosa para que la app arranque sin
 * `OPENROUTER_API_KEY`: sin ella el resto de la plataforma funciona igual y las
 * tres funciones de IA quedan apagadas (ver `hayIAConfigurada`). Lanza si se lo
 * invoca igual sin la variable.
 */
export function obtenerClienteIA(perfil: PerfilIA = "texto"): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Falta la variable de entorno OPENROUTER_API_KEY. Cargala en el archivo .env para poder usar el cliente de IA.",
    );
  }

  const cacheado = clientesPorPerfil.get(perfil);
  if (cacheado) return cacheado;

  const cliente = new OpenAI({
    apiKey,
    baseURL: BASE_URL,
    ...PERFILES[perfil],
    defaultHeaders: {
      // OpenRouter usa estas cabeceras para atribuir el consumo al sitio.
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_SITE_NAME ?? "Ferias Municipales SMT",
    },
  });

  clientesPorPerfil.set(perfil, cliente);

  return cliente;
}
