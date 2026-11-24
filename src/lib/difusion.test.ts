import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { interesPorDiaDeLaSemana } from "@/lib/consultas-difusion";
import {
  enesimoDomingo,
  proximasFechasComerciales,
} from "@/lib/fechas-comerciales";

const dia = (texto: string) => new Date(`${texto}T00:00:00Z`);

describe("fechas comerciales", () => {
  it("los días de la madre y del padre caen en su tercer domingo", () => {
    expect(enesimoDomingo(2026, 10, 3)).toEqual(dia("2026-10-18"));
    expect(enesimoDomingo(2026, 6, 3)).toEqual(dia("2026-06-21"));
    // Un mes que empieza en domingo: ese ya es el primero.
    expect(enesimoDomingo(2026, 11, 1)).toEqual(dia("2026-11-01"));
  });

  it("trae las que vienen, en orden, cruzando el año", () => {
    const nombres = proximasFechasComerciales(dia("2026-11-24"), 45).map(
      (fecha) => fecha.nombre,
    );
    expect(nombres).toEqual([
      "Regalos empresariales de fin de año",
      "Navidad",
      "Año Nuevo",
      "Día de Reyes",
    ]);
  });

  it("la de hoy todavía cuenta", () => {
    expect(
      proximasFechasComerciales(dia("2026-12-24"), 1).map((f) => f.nombre),
    ).toEqual(["Navidad"]);
  });
});

describe("visitas por día de la semana", () => {
  it("con pocas visitas no dice nada", () => {
    expect(
      interesPorDiaDeLaSemana([
        { fecha: dia("2026-11-21"), aperturas: 10, consultas: 2 },
      ]),
    ).toBeNull();
  });

  it("suma por día de la semana y ordena del que más al que menos", () => {
    const dias = interesPorDiaDeLaSemana([
      // Dos sábados y un miércoles.
      { fecha: dia("2026-11-21"), aperturas: 20, consultas: 3 },
      { fecha: dia("2026-11-14"), aperturas: 15, consultas: 1 },
      { fecha: dia("2026-11-18"), aperturas: 8, consultas: 0 },
    ]);
    expect(dias).toEqual([
      { dia: "sábado", aperturas: 35, consultas: 4 },
      { dia: "miércoles", aperturas: 8, consultas: 0 },
    ]);
  });
});
