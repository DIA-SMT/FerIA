import { describe, expect, it } from "vitest";

import { aCentavos, sumarImportes } from "@/lib/dinero";

/**
 * La prueba que importa es la del caso que nos rompió en producción.
 *
 * Un canon de $12.500,10 pagado en tres cuotas de $4.166,70 daba, sumando en
 * pesos, 12500.099999999998. El saldo quedaba en 1,8e-12 > 0, el permiso
 * figuraba VENCIDO y la columna «Saldo» mostraba «$ 0» porque el formateador
 * redondea: el feriante aparecía moroso por una deuda invisible.
 */
describe("aCentavos", () => {
  it("convierte pesos a centavos enteros", () => {
    expect(aCentavos(12500.1)).toBe(1250010);
    expect(aCentavos(4166.7)).toBe(416670);
    expect(aCentavos(0)).toBe(0);
  });

  it("acepta el Decimal de Prisma como string", () => {
    expect(aCentavos("12500.10")).toBe(1250010);
    expect(aCentavos("0.01")).toBe(1);
  });

  it("trata la ausencia de importe como cero", () => {
    expect(aCentavos(null)).toBe(0);
    expect(aCentavos(undefined)).toBe(0);
  });

  it("redondea al centavo y no trunca", () => {
    expect(aCentavos(0.005)).toBe(1);
    expect(aCentavos(0.004)).toBe(0);
  });
});

describe("sumarImportes", () => {
  it("no arrastra el error del punto flotante", () => {
    // En pesos esto da 12500.099999999998.
    expect(sumarImportes([4166.7, 4166.7, 4166.7])).toBe(12500.1);
    // Y acá está lo que de verdad importaba: el saldo cierra en cero exacto.
    expect(12500.1 - sumarImportes([4166.7, 4166.7, 4166.7])).toBe(0);
  });

  it("suma la lista vacia como cero", () => {
    expect(sumarImportes([])).toBe(0);
  });

  it("ignora los importes ausentes en vez de romper", () => {
    expect(sumarImportes([100, null, 50, undefined])).toBe(150);
  });

  it("suma muchos importes chicos sin derivar", () => {
    const cien = Array.from({ length: 100 }, () => 0.07);
    expect(sumarImportes(cien)).toBe(7);
  });

  it("mezcla numeros y strings, que es como llegan de Prisma", () => {
    expect(sumarImportes(["1500.50", 1500.5])).toBe(3001);
  });
});
