import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { raiz, relevancia, type FichaPublica } from "@/lib/consultas-publicas";

/*
  Los casos salen de la comparación con el Migue de antes (24/11/2026), que
  tenía el padrón entero en el prompt y encontraba estos por su cuenta.
*/

const ficha = (
  emprendimiento: string,
  datos: Partial<FichaPublica> = {},
): FichaPublica => ({
  emprendimiento,
  slug: emprendimiento.toLowerCase().replace(/\s+/g, "-"),
  productos: [],
  ...datos,
});

describe("raiz", () => {
  it("saca el plural", () => {
    expect(raiz("alfajores")).toBe("alfajor");
    expect(raiz("velas")).toBe("vela");
    expect(raiz("empanadas")).toBe("empanada");
    expect(raiz("jabones")).toBe("jabon");
    expect(raiz("miel")).toBe("miel");
  });
});

describe("relevancia en el buscador público", () => {
  it("«alfajores» encuentra la casa del alfajor", () => {
    expect(
      relevancia("alfajores", ficha("Kyntuc La Casa del Alfajor")),
    ).toBeGreaterThan(0);
  });

  it("un nombre escrito todo junto también vale", () => {
    expect(
      relevancia("la viejaescuela", ficha("La vieja escuela")),
    ).toBeGreaterThanOrEqual(60);
  });

  it("busca en los productos y en la descripción", () => {
    const conVelas = ficha("Luz de Luna", {
      productos: [{ nombre: "Vela de soja" }],
    });
    const conDescripcion = ficha("Rincón", {
      descripcion: "Hacemos empanadas salteñas al horno de barro.",
    });
    expect(relevancia("velas", conVelas)).toBeGreaterThan(0);
    expect(relevancia("empanadas", conDescripcion)).toBeGreaterThan(0);
  });

  it("lo que vende pesa más que lo que se parece", () => {
    const vendeVelas = ficha("Luz de Luna", {
      productos: [{ nombre: "Velas aromáticas" }],
    });
    const soloAroma = ficha("Aroma y Calma");
    expect(relevancia("velas aromáticas", vendeVelas)).toBeGreaterThan(
      relevancia("velas aromáticas", soloAroma),
    );
    // Pero si no hay nada mejor, el parecido aparece.
    expect(relevancia("velas aromáticas", soloAroma)).toBeGreaterThan(0);
  });

  it("no compara con el nombre de quien lleva el emprendimiento", () => {
    // La ficha pública no lo tiene; esto es para que nadie lo agregue.
    const conTitular = {
      ...ficha("Dulces del Valle"),
      responsable: "Rosa Pérez",
    } as FichaPublica;
    expect(relevancia("rosa perez", conTitular)).toBe(0);
  });

  it("«busco» o «hay» no cuentan como lo buscado", () => {
    expect(relevancia("busco", ficha("Busco Regalos"))).toBeGreaterThan(0);
    expect(relevancia("hay miel", ficha("Hay Tabla"))).toBe(0);
  });
});
