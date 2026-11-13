import { describe, expect, it } from "vitest";

import { crearLimiteDeRitmo } from "@/lib/limite-de-ritmo";

describe("crearLimiteDeRitmo", () => {
  const minuto = 60_000;

  it("deja pasar hasta el máximo y corta el siguiente", () => {
    const supera = crearLimiteDeRitmo({ ventanaMs: 10 * minuto, maximo: 3 });
    expect(supera("ana", 0)).toBe(false);
    expect(supera("ana", 1)).toBe(false);
    expect(supera("ana", 2)).toBe(false);
    expect(supera("ana", 3)).toBe(true);
  });

  it("cuenta cada clave por separado", () => {
    const supera = crearLimiteDeRitmo({ ventanaMs: 10 * minuto, maximo: 1 });
    expect(supera("ana", 0)).toBe(false);
    expect(supera("beto", 0)).toBe(false);
    expect(supera("ana", 1)).toBe(true);
  });

  it("vuelve a dejar pasar cuando la ventana corrió", () => {
    const supera = crearLimiteDeRitmo({ ventanaMs: 10 * minuto, maximo: 1 });
    expect(supera("ana", 0)).toBe(false);
    expect(supera("ana", 9 * minuto)).toBe(true);
    expect(supera("ana", 10 * minuto)).toBe(false);
  });
});
