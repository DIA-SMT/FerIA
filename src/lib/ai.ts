import OpenAI from "openai";

/**
 * Cliente de OpenRouter (API compatible con OpenAI).
 *
 * Por ahora la plataforma NO usa ninguna funcionalidad de IA: este módulo
 * sólo deja el cliente configurado y listo para cuando se sume alguna
 * (por ejemplo, redacción asistida de descripciones de emprendimientos o
 * clasificación automática de rubros).
 *
 * Configuración en `.env`:
 *   OPENROUTER_API_KEY   — obligatoria para poder usarlo
 *   OPENROUTER_MODEL     — modelo por defecto (opcional)
 *   OPENROUTER_SITE_URL  — cabecera de atribución de OpenRouter (opcional)
 *   OPENROUTER_SITE_NAME — cabecera de atribución de OpenRouter (opcional)
 */

const BASE_URL = "https://openrouter.ai/api/v1";

/** Modelo usado si quien llama no especifica otro. */
export const MODELO_POR_DEFECTO =
  process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4.5";

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
