import { describe, expect, it } from "vitest";

import { esVisitaDeUnaPersona } from "@/lib/visitas";

/**
 * Quién cuenta como una persona abriendo una vidriera.
 *
 * Estos casos existen porque el error que miden es invisible: el contador
 * siempre devuelve un número, y un número inflado parejo por prefetch y bots
 * se lee igual que uno bueno. Lo que se mide después son **diferencias entre
 * productos**, así que un ruido uniforme no agrega ruido: borra la señal.
 */

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

function peticion(cabeceras: Record<string, string>): Headers {
  return new Headers(cabeceras);
}

describe("esVisitaDeUnaPersona", () => {
  it("cuenta a alguien que abre la vidriera desde el navegador", () => {
    expect(esVisitaDeUnaPersona(peticion({ "user-agent": CHROME }))).toBe(true);
    expect(esVisitaDeUnaPersona(peticion({ "user-agent": ANDROID }))).toBe(true);
  });

  it("no cuenta los prefetch de Next", () => {
    // Pasar el mouse por la lista de stands se trae la página de cada uno.
    expect(
      esVisitaDeUnaPersona(
        peticion({ "user-agent": CHROME, "Next-Router-Prefetch": "1" }),
      ),
    ).toBe(false);
    expect(
      esVisitaDeUnaPersona(peticion({ "user-agent": CHROME, purpose: "prefetch" })),
    ).toBe(false);
    expect(
      esVisitaDeUnaPersona(
        peticion({ "user-agent": CHROME, "Sec-Purpose": "prefetch;prerender" }),
      ),
    ).toBe(false);
  });

  it("sí cuenta una navegación de verdad, que también viaja como RSC", () => {
    // La diferencia con el caso anterior es toda la prueba: `RSC` por sí sola
    // no delata un prefetch, delata una navegación del lado del cliente.
    expect(
      esVisitaDeUnaPersona(peticion({ "user-agent": CHROME, RSC: "1" })),
    ).toBe(true);
  });

  it("no cuenta bots, escáneres ni vistas previas de mensajeros", () => {
    const automaticos = [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "facebookexternalhit/1.1",
      "WhatsApp/2.23.20.0",
      "TelegramBot (like TwitterBot)",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    ];

    for (const agente of automaticos) {
      expect(
        esVisitaDeUnaPersona(peticion({ "user-agent": agente })),
        agente,
      ).toBe(false);
    }
  });

  it("no cuenta una petición sin user agent", () => {
    // Un navegador siempre manda uno. Lo que no manda ninguno es un script.
    expect(esVisitaDeUnaPersona(peticion({}))).toBe(false);
  });
});
