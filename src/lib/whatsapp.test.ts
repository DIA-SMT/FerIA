import { describe, expect, it } from "vitest";

import {
  formatearWhatsapp,
  linkWhatsapp,
  normalizarWhatsapp,
} from "@/lib/whatsapp";

/**
 * Esta tabla estaba escrita como comentario al final de `whatsapp.ts`, con la
 * nota «cuando haya corredor de tests, esta tabla se copia tal cual». Acá está,
 * tal cual, y el comentario ya no hace falta.
 *
 * Por qué importa más que un formateo cualquiera: el número normalizado es el
 * botón principal de contacto de cada stand en la vidriera pública del
 * municipio. Un número que no existe y pasa la validación no se nota hasta que
 * un vecino le escribe a un desconocido.
 */

const VALIDOS: Array<[string, string, string]> = [
  ["0381 155-123456", "5493815123456", "formato local con 15"],
  ["+54 9 381 512-3456", "5493815123456", "internacional con 9"],
  ["3815123456", "5493815123456", "pelado"],
  ["381 512-3456", "5493815123456", "con guion"],
  ["0054 9 381 512 3456", "5493815123456", "prefijo 0054"],
  ["0054 381 512 3456", "5493815123456", "prefijo 0054 sin el 9"],
  ["54 0381 512-3456", "5493815123456", "0 de larga distancia en el medio"],
  ["54 15 381 512-3456", "5493815123456", "15 pegado adelante"],
  ["(0381) 15-5123456", "5493815123456", "con parentesis"],
  ["5493815123456", "5493815123456", "el formato en que ya se guarda"],
  ["+54 9 381 15 512-3456", "5493815123456", "9 y 15 a la vez"],
  ["011 15 5123-4567", "5491151234567", "caracteristica de 2 digitos"],
  ["1151234567", "5491151234567", "AMBA pelado"],
  ["+54 9 11 15 5123-4567", "5491151234567", "AMBA con 9 y 15"],
];

/**
 * Los marcados con (*) son los que cambiaron al endurecer la validación: antes
 * devolvían un número inexistente y se publicaba igual.
 */
const INVALIDOS: Array<[string, string]> = [
  ["15 5123456", "(*) el 15 no es caracteristica"],
  ["1551234567", "(*) idem, con largo de 10"],
  ["+54 9 15 5123-4567", "(*) falta la caracteristica"],
  ["549155123456", "(*) el numero roto que ya estaba guardado"],
  ["381512345", "(*) falta un digito"],
  ["38151234567", "(*) sobra un digito"],
  ["0381 000-0000", "(*) abonado en 0"],
  ["0381 155-12345", "(*) falta un digito"],
  ["+1 415 555 0123", "(*) no es argentino"],
  ["", "vacio"],
  ["hola", "sin digitos"],
  ["54", "solo el pais"],
];

describe("normalizarWhatsapp", () => {
  it.each(VALIDOS)("acepta %s → %s (%s)", (entrada, esperado) => {
    expect(normalizarWhatsapp(entrada)).toBe(esperado);
  });

  it.each(INVALIDOS)("rechaza %s — %s", (entrada) => {
    expect(normalizarWhatsapp(entrada)).toBeNull();
  });

  it("es idempotente: normalizar lo ya normalizado no lo cambia", () => {
    for (const [entrada] of VALIDOS) {
      const una = normalizarWhatsapp(entrada);
      expect(una).not.toBeNull();
      expect(normalizarWhatsapp(una as string)).toBe(una);
    }
  });

  it("rechaza los numeros del seed, que son inventados a proposito", () => {
    // Están fuera de forma válida para que los datos de demostración no puedan
    // contactar a nadie real. Ver el comentario en prisma/seed.ts.
    expect(normalizarWhatsapp("549381000000 1")).toBeNull();
    expect(normalizarWhatsapp("381 000-0001")).toBeNull();
  });
});

describe("formatearWhatsapp", () => {
  it("muestra el guardado en forma legible", () => {
    expect(formatearWhatsapp("5493815123456")).toBe("+54 9 381 512-3456");
  });

  it("no rompe con algo que no tenga la forma esperada", () => {
    expect(formatearWhatsapp("123")).toBe("+123");
  });
});

describe("linkWhatsapp", () => {
  it("arma el link de wa.me con el mensaje escapado", () => {
    const link = linkWhatsapp("5493815123456", "Hola ¿cómo va?");
    expect(link).toBe(
      "https://wa.me/5493815123456?text=Hola%20%C2%BFc%C3%B3mo%20va%3F",
    );
  });

  it("saca lo que no sea digito del numero", () => {
    expect(linkWhatsapp("+54 9 381 512-3456", "x")).toContain(
      "wa.me/5493815123456",
    );
  });
});
