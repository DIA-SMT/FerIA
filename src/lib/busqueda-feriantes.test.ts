import { describe, expect, it } from "vitest";

import { alcanza, normalizar, puntuar } from "@/lib/busqueda-feriantes";

describe("normalizar", () => {
  it("saca tildes, mayúsculas y signos", () => {
    expect(normalizar("¡Doña Rosita!")).toBe("dona rosita");
    expect(normalizar("  Tejidos   del Cerro ")).toBe("tejidos del cerro");
  });
});

describe("puntuar", () => {
  const rosita = { emprendimiento: "Doña Rosita", responsable: "Rosa Pérez" };

  it("el nombre entero gana", () => {
    expect(puntuar("doña rosita", rosita)).toBe(100);
    expect(puntuar("DONA ROSITA", rosita)).toBe(100);
  });

  it("encuentra sin el tratamiento", () => {
    expect(puntuar("rosita", rosita)).toBeGreaterThan(0);
    expect(
      puntuar("doña rosita", { emprendimiento: "Rosita Dulces Caseros" }),
    ).toBeGreaterThan(0);
  });

  it("encuentra por el nombre de quien lo lleva", () => {
    expect(puntuar("rosa perez", rosita)).toBe(100);
    expect(puntuar("perez", rosita)).toBeGreaterThan(0);
  });

  it("tolera un error de tipeo en palabras largas", () => {
    expect(
      puntuar("tejdos cerro", { emprendimiento: "Tejidos del Cerro" }),
    ).toBeGreaterThan(0);
  });

  it("una palabra corta tiene que estar entera", () => {
    expect(
      puntuar("doña rosa", {
        emprendimiento: "Essen",
        responsable: "Rosales Carla",
      }),
    ).toBe(0);
    expect(
      puntuar("doña rosa", { emprendimiento: "Rosa Crochet Arte" }),
    ).toBeGreaterThan(0);
  });

  it("tolera un error de tipeo desde cuatro letras", () => {
    expect(
      puntuar("la viea escuela", { emprendimiento: "La vieja escuela" }),
    ).toBeGreaterThan(0);
  });

  it("no tolera errores en palabras cortas", () => {
    expect(puntuar("rosa", { emprendimiento: "Mesa Dulce" })).toBe(0);
  });

  it("todas las palabras tienen que aparecer", () => {
    expect(puntuar("rosita mates", { emprendimiento: "Doña Rosita" })).toBe(0);
  });

  it("ordena mejor lo que coincide entero que lo parcial", () => {
    const exacta = puntuar("la vieja escuela", {
      emprendimiento: "La Vieja Escuela",
    });
    const parcial = puntuar("la vieja escuela", {
      emprendimiento: "Escuela de Arte La Vieja Casona",
    });
    expect(exacta).toBeGreaterThan(parcial);
  });
});

describe("alcanza", () => {
  it("con una coincidencia exacta, descarta la que sólo se parece", () => {
    const exacta = puntuar("noelia perez", {
      emprendimiento: "Fricap",
      responsable: "Perez Clemente Maria Noelia",
    });
    const parecida = puntuar("noelia perez", {
      emprendimiento: "Drebriti.chic",
      responsable: "Jerez Jessica Noelia",
    });
    expect(parecida).toBeGreaterThan(0);
    expect(alcanza(parecida, exacta)).toBe(false);
  });

  it("deja todas las que tienen el nombre entero", () => {
    expect(alcanza(60, 80)).toBe(true);
    expect(alcanza(23, 80)).toBe(false);
  });
});
