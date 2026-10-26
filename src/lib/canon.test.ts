import { describe, expect, it } from "vitest";

import {
  calcularPermisos,
  calcularResumenCanon,
  generaObligacionCanon,
} from "@/lib/canon";

/**
 * El canon es lo que el feriante le paga al municipio: es plata real y es la
 * pantalla desde la que se llama por teléfono a quien debe. Un error acá hace
 * que alguien aparezca moroso sin deber, o que alguien que debe no aparezca.
 *
 * `calcularResumenCanon` recibe el día por parámetro justamente para esto: se
 * puede probar sin depender del reloj.
 */

const HOY = new Date("2026-10-26T00:00:00.000Z");
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const pago = (
  monto: number | string,
  estado: "PAGADO" | "PENDIENTE" | "ANULADO" = "PAGADO",
) => ({ monto, estado });

describe("calcularResumenCanon", () => {
  it("el caso que nos rompio: tres cuotas que cierran exacto", () => {
    // Sumando en pesos daba 12500.099999999998, el saldo quedaba en 1,8e-12 y
    // el permiso figuraba VENCIDO con la columna «Saldo» mostrando «$ 0».
    const resumen = calcularResumenCanon(
      {
        montoCanon: 12500.1,
        vencimientoCanon: dia("2026-10-01"),
        pagos: [pago(4166.7), pago(4166.7), pago(4166.7)],
      },
      HOY,
    );

    expect(resumen.saldo).toBe(0);
    expect(resumen.estado).toBe("AL_DIA");
  });

  it("sin canon no hay obligacion, aunque este vencido", () => {
    const resumen = calcularResumenCanon(
      { montoCanon: 0, vencimientoCanon: dia("2026-01-01"), pagos: [] },
      HOY,
    );
    expect(resumen.estado).toBe("SIN_CANON");
  });

  it("impago y pasada la fecha es VENCIDO", () => {
    const resumen = calcularResumenCanon(
      { montoCanon: 10000, vencimientoCanon: dia("2026-10-01"), pagos: [] },
      HOY,
    );
    expect(resumen.estado).toBe("VENCIDO");
    expect(resumen.saldo).toBe(10000);
    expect(resumen.diasParaVencer).toBe(-25);
  });

  it("impago pero todavia a tiempo es PENDIENTE", () => {
    const resumen = calcularResumenCanon(
      { montoCanon: 10000, vencimientoCanon: dia("2026-11-10"), pagos: [] },
      HOY,
    );
    expect(resumen.estado).toBe("PENDIENTE");
    expect(resumen.diasParaVencer).toBe(15);
  });

  it("sin fecha de vencimiento nunca vence", () => {
    const resumen = calcularResumenCanon(
      { montoCanon: 10000, vencimientoCanon: null, pagos: [] },
      HOY,
    );
    expect(resumen.estado).toBe("PENDIENTE");
    expect(resumen.diasParaVencer).toBeNull();
  });

  it("un pago cargado dos veces se ve, no se aplasta", () => {
    // Antes el excedente moria en un Math.max(0, …) sobre el saldo y quedaba
    // indistinguible de un pago bien cargado. Exponerlo es lo que permite
    // que alguien lo revise.
    const resumen = calcularResumenCanon(
      {
        montoCanon: 10000,
        vencimientoCanon: dia("2026-11-10"),
        pagos: [pago(10000), pago(10000)],
      },
      HOY,
    );

    expect(resumen.estado).toBe("AL_DIA");
    expect(resumen.saldo).toBe(0);
    expect(resumen.aFavor).toBe(10000);
  });

  it("solo cuentan los pagos en estado PAGADO", () => {
    const resumen = calcularResumenCanon(
      {
        montoCanon: 10000,
        vencimientoCanon: dia("2026-10-01"),
        pagos: [pago(10_000, "PENDIENTE"), pago(5000, "ANULADO")],
      },
      HOY,
    );

    expect(resumen.totalPagado).toBe(0);
    expect(resumen.estado).toBe("VENCIDO");
  });

  it("acepta los Decimal de Prisma como string", () => {
    const resumen = calcularResumenCanon(
      {
        montoCanon: "12500.10",
        vencimientoCanon: null,
        pagos: [pago("12500.10")],
      },
      HOY,
    );
    expect(resumen.estado).toBe("AL_DIA");
  });
});

describe("generaObligacionCanon", () => {
  it("un borrador no le cobra a nadie", () => {
    expect(generaObligacionCanon({ estado: "BORRADOR" })).toBe(false);
  });

  it("publicada, en curso y finalizada si", () => {
    // Una edicion terminada con canon impago sigue siendo plata adeudada.
    for (const estado of ["PUBLICADA", "EN_CURSO", "FINALIZADA"] as const) {
      expect(generaObligacionCanon({ estado })).toBe(true);
    }
  });
});

describe("calcularPermisos", () => {
  const edicion = {
    estado: "EN_CURSO" as const,
    montoCanon: 10000,
    vencimientoCanon: dia("2026-10-01"),
    stands: [
      { vendedorId: "ana" },
      { vendedorId: "beto" },
      { vendedorId: null },
    ],
    pagos: [{ vendedorId: "ana", monto: 10000, estado: "PAGADO" as const }],
  };

  it("un permiso por stand ocupado, ninguno por los libres", () => {
    const permisos = calcularPermisos([edicion]);
    expect(permisos).toHaveLength(2);
    expect(permisos.map((p) => p.vendedorId).sort()).toEqual(["ana", "beto"]);
  });

  it("el pago de uno NO le salda el canon al otro", () => {
    // Si el filtro por vendedorId fallara, Beto figuraria al dia con la plata
    // que puso Ana y el municipio dejaria de reclamarle.
    const permisos = calcularPermisos([edicion]);
    const porVendedor = new Map(permisos.map((p) => [p.vendedorId, p.resumen]));

    expect(porVendedor.get("ana")?.estado).toBe("AL_DIA");
    expect(porVendedor.get("beto")?.estado).toBe("VENCIDO");
    expect(porVendedor.get("beto")?.saldo).toBe(10000);
  });

  it("saltea las ediciones en borrador", () => {
    expect(calcularPermisos([{ ...edicion, estado: "BORRADOR" }])).toEqual([]);
  });

  it("sin ediciones no hay permisos", () => {
    expect(calcularPermisos([])).toEqual([]);
  });

  it("deja pasar las columnas extra de cada pantalla", () => {
    // El genérico existe para que /admin/canon y el tablero puedan traer cada
    // uno sus columnas sin que el cálculo las conozca.
    const [permiso] = calcularPermisos([
      {
        ...edicion,
        nombre: "Edicion Primavera",
        stands: [{ vendedorId: "ana", numero: 7 }],
      },
    ]);

    expect(permiso?.edicion.nombre).toBe("Edicion Primavera");
    expect(permiso?.stand.numero).toBe(7);
  });
});
