import { describe, expect, it } from "vitest";

import {
  leerPrecio,
  mensajeConsultaPropuesta,
  MODALIDADES_POR_TIPO,
  MODALIDADES_SELLO_PROPIO,
  precioOrientativo,
  tipoDeModalidad,
  tipoDesdeSegmento,
} from "@/lib/sello-propio";
import { propuestaSelloPropioSchema } from "@/lib/validations/sello-propio";

describe("tipoDeModalidad", () => {
  it("producto, caja y combo son regalos; food truck y patio, servicios", () => {
    expect(tipoDeModalidad("PRODUCTO")).toBe("REGALO");
    expect(tipoDeModalidad("CAJA")).toBe("REGALO");
    expect(tipoDeModalidad("COMBO")).toBe("REGALO");
    expect(tipoDeModalidad("FOOD_TRUCK")).toBe("SERVICIO");
    expect(tipoDeModalidad("PATIO_GASTRONOMICO")).toBe("SERVICIO");
  });

  it("cada modalidad está en un tipo y en uno solo", () => {
    const repartidas = [
      ...MODALIDADES_POR_TIPO.REGALO,
      ...MODALIDADES_POR_TIPO.SERVICIO,
    ];
    expect([...repartidas].sort()).toEqual(
      Object.keys(MODALIDADES_SELLO_PROPIO).sort(),
    );
  });
});

describe("tipoDesdeSegmento", () => {
  it("regalos y servicios; cualquier otra cosa no es una página", () => {
    expect(tipoDesdeSegmento("regalos")).toBe("REGALO");
    expect(tipoDesdeSegmento("servicios")).toBe("SERVICIO");
    expect(tipoDesdeSegmento("Regalos")).toBeNull();
    expect(tipoDesdeSegmento("otra")).toBeNull();
  });
});

describe("leerPrecio", () => {
  it("el punto separa miles, como se escribe acá", () => {
    expect(leerPrecio("15.000")).toBe(15000);
    expect(leerPrecio("$ 1.250.000")).toBe(1250000);
    expect(leerPrecio("8000")).toBe(8000);
  });

  it("descarta los centavos", () => {
    expect(leerPrecio("15.000,50")).toBe(15000);
  });

  it("vacío o sin números es null", () => {
    expect(leerPrecio("")).toBeNull();
    expect(leerPrecio("a consultar")).toBeNull();
  });
});

describe("precioOrientativo", () => {
  it("arma el precio con su unidad", () => {
    expect(precioOrientativo(15000, "por caja")?.replace(/\s/g, " ")).toBe(
      "$ 15.000 por caja",
    );
  });

  it("sin unidad, sólo el precio; sin precio, nada", () => {
    expect(precioOrientativo(8000, null)?.replace(/\s/g, " ")).toBe("$ 8.000");
    expect(precioOrientativo(null, "por caja")).toBeNull();
  });
});

describe("mensajeConsultaPropuesta", () => {
  it("nombra la propuesta y la convocatoria", () => {
    expect(mensajeConsultaPropuesta("Caja dulce", "REGALO")).toContain(
      "«Caja dulce» en Regalos con sello propio",
    );
    expect(mensajeConsultaPropuesta("Patio", "SERVICIO")).toContain(
      "Servicios con sello propio",
    );
  });
});

describe("propuestaSelloPropioSchema", () => {
  const base = {
    vendedorId: "c123",
    modalidad: "CAJA",
    titulo: "Caja dulce navideña",
    descripcion: "Pan dulce, alfajores y garrapiñada en caja de cartón.",
  };

  it("lo opcional vacío queda en null y la casilla ausente es borrador", () => {
    const datos = propuestaSelloPropioSchema.parse({
      ...base,
      precio: "",
      precioUnidad: "",
      minimo: "",
    });
    expect(datos.precio).toBeNull();
    expect(datos.precioUnidad).toBeNull();
    expect(datos.minimo).toBeNull();
    expect(datos.publicada).toBe(false);
  });

  it("lee el precio con puntos de miles", () => {
    const datos = propuestaSelloPropioSchema.parse({
      ...base,
      precio: "15.000",
      publicada: "on",
    });
    expect(datos.precio).toBe(15000);
    expect(datos.publicada).toBe(true);
  });

  it("pide el feriante y la modalidad", () => {
    const resultado = propuestaSelloPropioSchema.safeParse({
      ...base,
      vendedorId: "",
      modalidad: "",
    });
    expect(resultado.success).toBe(false);
    const errores = resultado.error?.flatten().fieldErrors;
    expect(errores?.vendedorId).toEqual(["Elegí el feriante que la ofrece."]);
    expect(errores?.modalidad).toBeDefined();
  });

  it("un precio de cero no es un precio", () => {
    expect(
      propuestaSelloPropioSchema.safeParse({ ...base, precio: "0" }).success,
    ).toBe(false);
  });
});
