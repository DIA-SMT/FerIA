import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Los borradores de productos: qué fotos quedan al guardar, cuáles se borran
  del disco, y que los vencidos se borren con sus fotos sin tocar lo que ya
  se mandó a revisión.
*/

const prisma = vi.hoisted(() => ({
  producto: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));
const almacenamiento = vi.hoisted(() => ({ eliminar: vi.fn(async () => {}) }));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/storage", () => ({ almacenamiento }));

import {
  borradorCompleto,
  cuandoSeBorra,
  fotosDelProducto,
  fotosQueSobran,
  seBorraEl,
} from "@/lib/borradores";
import { podarBorradoresVencidos } from "@/lib/poda-de-borradores";

const mia = (nombre: string) => `productos/vendedores/v1/${nombre}.webp`;
const ajena = (nombre: string) => `productos/vendedores/v2/${nombre}.webp`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("las fotos del producto al guardar", () => {
  it("quedan las que tenía y dejó, más las nuevas", () => {
    expect(
      fotosDelProducto({
        enElProducto: [mia("a"), mia("b")],
        conservadas: [mia("a")],
        nuevas: [mia("c")],
        vendedorId: "v1",
      }),
    ).toEqual([mia("a"), mia("c")]);
  });

  it("no acepta fotos de otro feriante ni conservar una que no tenía", () => {
    expect(
      fotosDelProducto({
        enElProducto: [mia("a")],
        conservadas: [mia("a"), mia("x")],
        nuevas: [ajena("b"), mia("c")],
        vendedorId: "v1",
      }),
    ).toEqual([mia("a"), mia("c")]);
  });

  it("sin repetir y hasta cuatro", () => {
    expect(
      fotosDelProducto({
        enElProducto: [mia("a")],
        conservadas: [mia("a")],
        nuevas: [mia("a"), mia("b"), mia("c"), mia("d"), mia("e")],
        vendedorId: "v1",
      }),
    ).toEqual([mia("a"), mia("b"), mia("c"), mia("d")]);
  });
});

describe("las fotos que sobran después de guardar", () => {
  it("las que tenía y ya no, y las descartadas; nunca una en uso", () => {
    expect(
      fotosQueSobran({
        antes: [mia("a"), mia("b")],
        descartadas: [mia("c"), mia("b"), ajena("z")],
        ahora: [mia("a"), mia("d")],
        vendedorId: "v1",
      }),
    ).toEqual([mia("b"), mia("c")]);
  });
});

describe("cuándo se borra un borrador", () => {
  it("a los siete días del último cambio", () => {
    expect(seBorraEl(new Date("2026-11-26T13:00:00Z"))).toEqual(
      new Date("2026-12-03T13:00:00Z"),
    );
  });

  it("dicho con el día de Tucumán", () => {
    // 23:30 del 26 en Tucumán son las 02:30 del 27 en UTC: se borra el 3, no el 4.
    expect(cuandoSeBorra(new Date("2026-11-27T02:30:00Z"))).toBe(
      "el jueves 3 de diciembre",
    );
  });

  it("para mandarlo a revisión alcanza con el nombre", () => {
    expect(borradorCompleto("")).toBe(false);
    expect(borradorCompleto("  a ")).toBe(false);
    expect(borradorCompleto("Té")).toBe(true);
  });
});

describe("la poda de los vencidos", () => {
  const ahora = new Date("2026-12-10T12:00:00Z");

  it("busca los borradores sin cambios hace más de 7 días", async () => {
    prisma.producto.findMany.mockResolvedValueOnce([]);
    expect(await podarBorradoresVencidos(ahora)).toBe(0);
    expect(prisma.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          borrador: true,
          actualizadoEn: { lt: new Date("2026-12-03T12:00:00Z") },
        },
      }),
    );
    expect(prisma.producto.deleteMany).not.toHaveBeenCalled();
  });

  it("borra las filas y sus fotos, pero no las de uno que ya se mandó", async () => {
    prisma.producto.findMany
      .mockResolvedValueOnce([
        { id: "p1", imagenes: [mia("a")] },
        { id: "p2", imagenes: [mia("b")] },
      ])
      // p2 se mandó a revisión entre la consulta y el borrado: sigue existiendo.
      .mockResolvedValueOnce([{ id: "p2" }]);
    prisma.producto.deleteMany.mockResolvedValueOnce({ count: 1 });

    expect(await podarBorradoresVencidos(ahora)).toBe(1);
    expect(prisma.producto.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] }, borrador: true },
    });
    expect(almacenamiento.eliminar).toHaveBeenCalledTimes(1);
    expect(almacenamiento.eliminar).toHaveBeenCalledWith(mia("a"));
  });
});
