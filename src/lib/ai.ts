import OpenAI from "openai";

/**
 * Cliente de OpenRouter (API compatible con OpenAI).
 *
 * Lo usan la edición de fotos de producto (`@/lib/ia-imagenes`) y la redacción
 * asistida de descripciones (`@/lib/ia-texto`).
 *
 * **Acá no hay modelo por defecto, a propósito.** Había uno genérico
 * (`OPENROUTER_MODEL`) y era una trampa: un modelo de texto y uno de imagen no
 * son intercambiables, así que la función de texto terminó heredando el modelo
 * de imagen que estaba cargado en el `.env` y saliendo a producir texto con él.
 * Cada módulo declara el suyo y su propia variable.
 *
 * Configuración en `.env`:
 *   OPENROUTER_API_KEY       — obligatoria para poder usarlo
 *   OPENROUTER_MODELO_IMAGEN — modelo de imagen (opcional, ver ia-imagenes.ts)
 *   OPENROUTER_MODELO_TEXTO  — modelo de texto  (opcional, ver ia-texto.ts)
 *   OPENROUTER_SITE_URL      — cabecera de atribución de OpenRouter (opcional)
 *   OPENROUTER_SITE_NAME     — cabecera de atribución de OpenRouter (opcional)
 */

const BASE_URL = "https://openrouter.ai/api/v1";

/** `true` si hay una API key cargada; permite degradar sin romper la app. */
export function hayIAConfigurada(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

let clienteCache: OpenAI | null = null;

/**
 * Devuelve el cliente de OpenRouter.
 *
 * Se construye de forma perezosa para que la app arranque sin `OPENROUTER_API_KEY`
 * (hoy nada de la plataforma lo necesita). Lanza si se lo invoca sin la variable.
 */
export function obtenerClienteIA(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Falta la variable de entorno OPENROUTER_API_KEY. Cargala en el archivo .env para poder usar el cliente de IA.",
    );
  }

  if (!clienteCache) {
    clienteCache = new OpenAI({
      apiKey,
      baseURL: BASE_URL,
      defaultHeaders: {
        // OpenRouter usa estas cabeceras para atribuir el consumo al sitio.
        "HTTP-Referer":
          process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_SITE_NAME ?? "Ferias Municipales SMT",
      },
    });
  }

  return clienteCache;
}
