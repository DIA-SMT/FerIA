/**
 * Quién cuenta como una persona mirando el market.
 *
 * Vive separado de `interes.ts` por la misma razón que `ruta-publica.ts` vive
 * separado de su ruta: esto es lógica pura —entra una `Headers`, sale un
 * booleano— y se puede probar sin levantar una base. Lo de al lado escribe en
 * Postgres y no se prueba así.
 */

/**
 * Agentes que no son una persona mirando una vidriera.
 *
 * No pretende ser exhaustiva —ninguna lista de estas lo es— sino evitar el
 * error **sistemático**: un bot recorre todos los stands y todos los links por
 * igual, así que no agrega ruido, aplana las diferencias, que es justamente lo
 * único que estamos midiendo. `whatsapp` y `telegram` entran acá porque son la
 * vista previa que arma el mensajero cuando alguien comparte el link, no una
 * visita.
 */
const AGENTES_AUTOMATICOS =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|go-http|java\/|headless|lighthouse|preview|monitor|uptime|semrush|ahrefs|petal|yandex/i;

/**
 * Si esta petición cuenta como una persona abriendo la vidriera.
 *
 * Lo que más hay que sacar son los *prefetch* de Next: cuando el mouse pasa por
 * encima de un link, Next se trae la página entera. Sin este filtro, alguien
 * que recorre la lista de stands con el mouse «abre» veinte vidrieras sin ver
 * ninguna, y el denominador deja de significar algo.
 *
 * Ojo con la cabecera `RSC` a secas: también viaja en las navegaciones de
 * verdad, las que ocurren al hacer clic, y ésas sí cuentan. La que delata al
 * prefetch es `Next-Router-Prefetch`.
 */
export function esVisitaDeUnaPersona(cabeceras: Headers): boolean {
  if (cabeceras.get("next-router-prefetch")) return false;
  if (cabeceras.get("purpose") === "prefetch") return false;
  if (cabeceras.get("sec-purpose")?.includes("prefetch")) return false;

  const agente = cabeceras.get("user-agent");
  // Sin user agent no hay navegador: es un script, y encima uno que se esconde.
  if (!agente) return false;

  return !AGENTES_AUTOMATICOS.test(agente);
}
