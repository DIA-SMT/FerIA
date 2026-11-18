import { describe, expect, it } from "vitest";

import { edicionSchema } from "@/lib/validations/feria";

const base = {
  feriaId: "cmwm4t10p000s6trcn0au3dp0",
  fechaInicio: "2026-11-21",
  fechaFin: "2026-11-23",
  diasSemana: ["SABADO", "DOMINGO", "LUNES"],
  estado: "PUBLICADA",
  cantidadStands: "0",
  montoCanon: "0",
  vencimientoCanon: "",
};

describe("edicionSchema", () => {
  it("acepta una feria que cierra a medianoche", () => {
    const r = edicionSchema.safeParse({
      ...base,
      horaApertura: "18:00",
      horaCierre: "00:00",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza un cierre que es un error de tipeo", () => {
    for (const cierre of ["18:00", "17:00", "09:00"]) {
      const r = edicionSchema.safeParse({
        ...base,
        horaApertura: "18:00",
        horaCierre: cierre,
      });
      expect(r.success, cierre).toBe(false);
    }
  });

  it("guarda el lugar de la edición y lo deja nulo si viene vacío", () => {
    const con = edicionSchema.safeParse({
      ...base,
      lugar: "Plaza Independencia, 24 de Septiembre al 400",
    });
    expect(con.success && con.data.lugar).toBe(
      "Plaza Independencia, 24 de Septiembre al 400",
    );
    const sin = edicionSchema.safeParse({ ...base, lugar: "   " });
    expect(sin.success && sin.data.lugar).toBe(null);
  });
});
