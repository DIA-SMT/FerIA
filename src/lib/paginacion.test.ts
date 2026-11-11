import { describe, expect, it } from "vitest";

import { HUECO, leerPagina, paginar, paginasVisibles } from "@/lib/paginacion";

/**
 * Los errores de paginación no rompen nada visible: una fila que aparece en dos
 * páginas, otra que no aparece en ninguna, una URL vieja que muestra «sin
 * resultados». Por eso se prueban los bordes.
 */

describe("leerPagina", () => {
  it("lee un número de página válido", () => {
    expect(leerPagina("3")).toBe(3);
    expect(leerPagina(["7", "9"])).toBe(7);
  });

  it("devuelve la primera ante cualquier cosa rara, sin romperse", () => {
    for (const raro of [undefined, "", "0", "-1", "2.5", "dos", "3abc", " 4"]) {
      expect(leerPagina(raro), String(raro)).toBe(1);
    }
  });
});

describe("paginar", () => {
  it("calcula páginas y salto", () => {
    expect(paginar(989, 1, 24)).toEqual({ pagina: 1, paginas: 42, salto: 0, porPagina: 24 });
    expect(paginar(989, 3, 24)).toMatchObject({ pagina: 3, salto: 48 });
  });

  it("la última página puede venir incompleta", () => {
    // 989 = 41 páginas llenas de 24 + 5 filas en la 42.
    const { salto } = paginar(989, 42, 24);
    expect(989 - salto).toBe(5);
  });

  it("acota una página que no existe a la última, en vez de mostrar vacío", () => {
    expect(paginar(50, 99, 24)).toMatchObject({ pagina: 3, salto: 48 });
  });

  it("sin filas hay igual una página, la primera", () => {
    expect(paginar(0, 5, 24)).toEqual({ pagina: 1, paginas: 1, salto: 0, porPagina: 24 });
  });

  it("un múltiplo exacto no deja una página vacía al final", () => {
    expect(paginar(48, 1, 24).paginas).toBe(2);
  });
});

describe("paginasVisibles", () => {
  it("muestra todas cuando son pocas", () => {
    expect(paginasVisibles(1, 1)).toEqual([1]);
    expect(paginasVisibles(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("muestra los extremos y dos a cada lado, con huecos", () => {
    expect(paginasVisibles(6, 42)).toEqual([1, HUECO, 4, 5, 6, 7, 8, HUECO, 42]);
  });

  it("no dibuja «…» para saltear una sola página: muestra el número", () => {
    // Entre 1 y 3 falta sólo el 2.
    expect(paginasVisibles(5, 42)).toEqual([1, 2, 3, 4, 5, 6, 7, HUECO, 42]);
  });

  it("en los bordes no inventa páginas fuera de rango", () => {
    expect(paginasVisibles(1, 42)).toEqual([1, 2, 3, HUECO, 42]);
    expect(paginasVisibles(42, 42)).toEqual([1, HUECO, 40, 41, 42]);
  });
});
