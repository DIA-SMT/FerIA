import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  El tope de «Mejorar imagen con IA»: 5 por día, y el día es el de Tucumán.
  A las 22:00 de allá ya es el día siguiente en UTC, y no por eso se renueva.
*/

const prisma = vi.hoisted(() => ({
  fotoMejorada: { count: vi.fn(async () => 0) },
}));

vi.mock("@/lib/db", () => ({ prisma }));

import { fotosIARestantes } from "@/lib/cupo-fotos-ia";
import { inicioDelDiaEnZona } from "@/lib/format";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("el día de Tucumán", () => {
  it("empieza a las 00:00 de allá, que son las 03:00 UTC", () => {
    expect(inicioDelDiaEnZona(new Date("2026-11-25T15:00:00Z"))).toEqual(
      new Date("2026-11-25T03:00:00Z"),
    );
  });

  it("a las 22:00 de Tucumán sigue siendo el mismo día", () => {
    // 22:00 del 25 en Tucumán = 01:00 del 26 en UTC.
    expect(inicioDelDiaEnZona(new Date("2026-11-26T01:00:00Z"))).toEqual(
      new Date("2026-11-25T03:00:00Z"),
    );
  });

  it("a la medianoche de Tucumán ya es el día siguiente", () => {
    expect(inicioDelDiaEnZona(new Date("2026-11-26T03:00:00Z"))).toEqual(
      new Date("2026-11-26T03:00:00Z"),
    );
  });
});

describe("cuántas fotos le quedan por mejorar", () => {
  const ahora = new Date("2026-11-25T15:00:00Z");

  it("cuenta sólo las de hoy y del feriante", async () => {
    prisma.fotoMejorada.count.mockResolvedValueOnce(2);
    expect(await fotosIARestantes("v1", ahora)).toBe(3);
    expect(prisma.fotoMejorada.count).toHaveBeenCalledWith({
      where: {
        vendedorId: "v1",
        creadoEn: { gte: new Date("2026-11-25T03:00:00Z") },
      },
    });
  });

  it("nunca da menos de cero", async () => {
    prisma.fotoMejorada.count.mockResolvedValueOnce(7);
    expect(await fotosIARestantes("v1", ahora)).toBe(0);
  });
});
