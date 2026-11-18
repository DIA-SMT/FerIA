import { describe, expect, it } from "vitest";

import {
  calcularCostos,
  costoDelInsumo,
  datosDeCostosSchema,
  redondearPrecio,
  type DatosDeCostos,
} from "@/lib/costos";

/** Una tanda de alfajores: 40 unidades. */
const ALFAJORES: DatosDeCostos = {
  unidades: 40,
  insumos: [
    // 1 kg a $1.200 y se usan 500 g → $600.
    {
      nombre: "Harina",
      precio: 1200,
      cantidadComprada: 1,
      unidadComprada: "kg",
      cantidadUsada: 500,
      unidadUsada: "g",
    },
    // Lo que se usa, directo.
    { nombre: "Dulce de leche", precio: 3000 },
  ],
  minutos: 120,
  valorHora: 3000,
  otros: [{ nombre: "Envoltorios", monto: 400 }],
  margen: 50,
  costoDelDia: 5000,
  precioActual: 300,
};

describe("costoDelInsumo", () => {
  it("pasa de kilos a gramos", () => {
    expect(costoDelInsumo(ALFAJORES.insumos[0]!)).toBe(600);
  });

  it("de litros a mililitros", () => {
    expect(
      costoDelInsumo({
        nombre: "Leche",
        precio: 1500,
        cantidadComprada: 1,
        unidadComprada: "l",
        cantidadUsada: 250,
        unidadUsada: "ml",
      }),
    ).toBe(375);
  });

  it("no compara peso con unidades", () => {
    expect(
      costoDelInsumo({
        nombre: "Huevos",
        precio: 3000,
        cantidadComprada: 1,
        unidadComprada: "kg",
        cantidadUsada: 6,
        unidadUsada: "unidad",
      }),
    ).toEqual({ error: expect.stringContaining("Huevos") });
  });
});

describe("redondearPrecio", () => {
  it("siempre hacia arriba, de a pasos cómodos", () => {
    expect(redondearPrecio(181.5)).toBe(190);
    expect(redondearPrecio(190)).toBe(190);
    expect(redondearPrecio(1201)).toBe(1250);
    expect(redondearPrecio(12_001)).toBe(12_100);
    expect(redondearPrecio(0)).toBe(0);
  });
});

describe("calcularCostos", () => {
  const resultado = calcularCostos(ALFAJORES);
  if ("error" in resultado) throw new Error(resultado.error);

  it("suma la tanda: insumos, trabajo y otros", () => {
    // 600 + 3000 de insumos; 2 h × 3000 de trabajo; 400 de envoltorios.
    expect(resultado.tanda).toEqual({
      insumos: 3600,
      trabajo: 6000,
      otros: 400,
      total: 10_000,
    });
  });

  it("baja a la unidad", () => {
    expect(resultado.porUnidad).toEqual({
      insumos: 90,
      trabajo: 150,
      otros: 10,
      total: 250,
    });
  });

  it("el precio sugerido es el costo más la ganancia, redondeado", () => {
    expect(resultado.precioExacto).toBe(375);
    expect(resultado.precioSugerido).toBe(380);
    expect(resultado.gananciaPorUnidad).toBe(130);
  });

  it("compara con el precio de hoy", () => {
    expect(resultado.conPrecioActual).toEqual({
      precio: 300,
      gananciaPorUnidad: 50,
      margen: 20,
    });
  });

  it("cuántas hay que vender para cubrir el día", () => {
    // 5000 / 130 = 38,4 → 39.
    expect(resultado.paraCubrirElDia).toBe(39);
  });

  it("con el precio de hoy por debajo del costo, el margen es negativo", () => {
    const perdida = calcularCostos({ ...ALFAJORES, precioActual: 200 });
    if ("error" in perdida) throw new Error(perdida.error);
    expect(perdida.conPrecioActual?.margen).toBe(-20);
  });
});

describe("datosDeCostosSchema", () => {
  it("acepta números como texto, como vienen de un formulario", () => {
    const leidos = datosDeCostosSchema.parse({
      ...ALFAJORES,
      unidades: "40",
      margen: "50",
    });
    expect(leidos.unidades).toBe(40);
  });

  it("no acepta una tanda sin unidades", () => {
    expect(
      datosDeCostosSchema.safeParse({ ...ALFAJORES, unidades: 0 }).success,
    ).toBe(false);
  });
});
