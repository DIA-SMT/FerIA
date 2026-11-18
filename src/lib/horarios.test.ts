import { describe, expect, it } from "vitest";

import {
  abreEnFecha,
  diaDeFecha,
  formatearDias,
  formatearRangoHorario,
  horarioPosible,
  lugarDeEdicion,
  resumenHorario,
  semanaDe,
} from "@/lib/horarios";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const edicion = (extra: Partial<Parameters<typeof abreEnFecha>[0]> = {}) => ({
  fechaInicio: dia("2026-10-19"),
  fechaFin: dia("2026-10-25"),
  diasSemana: [],
  horaApertura: null,
  horaCierre: null,
  horario: null,
  ...extra,
});

describe("diaDeFecha", () => {
  it("lee el dia en UTC, no en la zona del servidor", () => {
    // Las columnas son DATE y se guardan a medianoche UTC. Con getDay() en vez
    // de getUTCDay(), al oeste de Greenwich la semana entera se corre un dia.
    expect(diaDeFecha(dia("2026-10-26"))).toBe("LUNES");
    expect(diaDeFecha(dia("2026-10-25"))).toBe("DOMINGO");
    expect(diaDeFecha(dia("2026-10-31"))).toBe("SABADO");
  });
});

describe("semanaDe", () => {
  it("arranca el lunes, aunque le pases un domingo", () => {
    const semana = semanaDe(dia("2026-10-25"));
    expect(semana).toHaveLength(7);
    expect(diaDeFecha(semana[0] as Date)).toBe("LUNES");
    expect(semana[0]?.toISOString().slice(0, 10)).toBe("2026-10-19");
    expect(semana[6]?.toISOString().slice(0, 10)).toBe("2026-10-25");
  });

  it("un lunes se devuelve a si mismo como primer dia", () => {
    const semana = semanaDe(dia("2026-10-26"));
    expect(semana[0]?.toISOString().slice(0, 10)).toBe("2026-10-26");
  });
});

describe("abreEnFecha", () => {
  it("sin dias cargados abre todos los del rango", () => {
    // Es el comportamiento anterior a que existieran estos campos: lo que
    // permite que la Direccion los complete de a poco sin que una edicion
    // vieja desaparezca de la portada.
    expect(abreEnFecha(edicion(), dia("2026-10-21"))).toBe(true);
  });

  it("con dias cargados respeta solo esos", () => {
    const e = edicion({ diasSemana: ["SABADO", "DOMINGO"] });
    expect(abreEnFecha(e, dia("2026-10-24"))).toBe(true);
    expect(abreEnFecha(e, dia("2026-10-21"))).toBe(false);
  });

  it("fuera del rango de fechas no abre, aunque el dia coincida", () => {
    const e = edicion({ diasSemana: ["SABADO"] });
    expect(abreEnFecha(e, dia("2026-10-31"))).toBe(false);
  });

  it("los bordes del rango estan incluidos", () => {
    expect(abreEnFecha(edicion(), dia("2026-10-19"))).toBe(true);
    expect(abreEnFecha(edicion(), dia("2026-10-25"))).toBe(true);
    expect(abreEnFecha(edicion(), dia("2026-10-18"))).toBe(false);
  });
});

describe("formatearDias", () => {
  it("usa coma y una y final", () => {
    expect(formatearDias(["LUNES", "MIERCOLES", "SABADO"])).toBe(
      "Lun, Mié y Sáb",
    );
  });

  it("ordena por la semana y no por como vino de la base", () => {
    expect(formatearDias(["DOMINGO", "SABADO"])).toBe("Sáb y Dom");
  });

  it("un solo dia va solo", () => {
    expect(formatearDias(["VIERNES"])).toBe("Vie");
  });

  it("los siete se dicen con palabras", () => {
    expect(
      formatearDias([
        "LUNES",
        "MARTES",
        "MIERCOLES",
        "JUEVES",
        "VIERNES",
        "SABADO",
        "DOMINGO",
      ]),
    ).toBe("Todos los días");
  });

  it("sin dias no inventa nada", () => {
    expect(formatearDias([])).toBeNull();
  });
});

describe("formatearRangoHorario", () => {
  it("saca el cero de la izquierda, que es ruido al leer", () => {
    expect(formatearRangoHorario("08:00", "14:00")).toBe("8:00 a 14:00");
  });

  it("si falta una de las dos no muestra media verdad", () => {
    expect(formatearRangoHorario("08:00", null)).toBeNull();
    expect(formatearRangoHorario(null, "14:00")).toBeNull();
  });
});

describe("resumenHorario", () => {
  it("con dias y horas arma la linea completa", () => {
    expect(
      resumenHorario(
        edicion({
          diasSemana: ["SABADO", "DOMINGO"],
          horaApertura: "08:00",
          horaCierre: "14:00",
        }),
      ),
    ).toBe("Sáb y Dom · 8:00 a 14:00");
  });

  it("sin los campos nuevos cae al texto libre de siempre", () => {
    expect(
      resumenHorario(edicion({ horario: "Sábados y domingos de 17 a 23 h" })),
    ).toBe("Sábados y domingos de 17 a 23 h");
  });

  it("los campos nuevos le ganan al texto viejo", () => {
    // Si estan los dos, el que puede quedar desactualizado es el texto.
    expect(
      resumenHorario(
        edicion({
          diasSemana: ["SABADO"],
          horaApertura: "08:00",
          horaCierre: "14:00",
          horario: "algo viejo que quedo ahi",
        }),
      ),
    ).toBe("Sáb · 8:00 a 14:00");
  });

  it("sin nada no inventa un horario", () => {
    expect(resumenHorario(edicion())).toBeNull();
  });
});

describe("ferias que cierran a medianoche", () => {
  it("la medianoche se escribe 00:00, como en los anuncios", () => {
    expect(formatearRangoHorario("18:00", "00:00")).toBe("18:00 a 00:00");
    expect(formatearRangoHorario("16:30", "00:00")).toBe("16:30 a 00:00");
  });

  it("acepta cerrar a las 00 o de madrugada", () => {
    expect(horarioPosible("18:00", "00:00")).toBe(true);
    expect(horarioPosible("20:00", "02:00")).toBe(true);
    expect(horarioPosible("17:00", "23:00")).toBe(true);
  });

  it("sigue rechazando lo que es un error de tipeo", () => {
    expect(horarioPosible("18:00", "18:00")).toBe(false);
    expect(horarioPosible("18:00", "17:00")).toBe(false);
    expect(horarioPosible("18:00", "07:00")).toBe(false);
  });
});

describe("lugarDeEdicion", () => {
  const feria = { direccion: "Parque Avellaneda" };

  it("sin lugar propio, es el de la feria", () => {
    expect(lugarDeEdicion({ lugar: null }, feria)).toBe("Parque Avellaneda");
    expect(lugarDeEdicion({ lugar: "  " }, feria)).toBe("Parque Avellaneda");
    expect(lugarDeEdicion({}, feria)).toBe("Parque Avellaneda");
  });

  it("con lugar propio, es ése", () => {
    expect(
      lugarDeEdicion(
        { lugar: " Plaza Independencia, 24 de Septiembre al 300 " },
        feria,
      ),
    ).toBe("Plaza Independencia, 24 de Septiembre al 300");
  });
});

describe("los días de un fin de semana largo", () => {
  it("se cuentan desde el primer día de la edición", () => {
    const finde = edicion({
      fechaInicio: dia("2026-11-21"),
      fechaFin: dia("2026-11-23"),
      diasSemana: ["LUNES", "SABADO"],
      horaApertura: "18:00",
      horaCierre: "00:00",
    });
    expect(resumenHorario(finde)).toBe("Sáb y Lun · 18:00 a 00:00");
    expect(
      resumenHorario({ ...finde, diasSemana: ["SABADO", "DOMINGO", "LUNES"] }),
    ).toBe("Sáb, Dom y Lun · 18:00 a 00:00");
  });

  it("en una edición larga, la semana de siempre", () => {
    expect(
      resumenHorario(
        edicion({
          fechaInicio: dia("2026-11-21"),
          fechaFin: dia("2026-12-20"),
          diasSemana: ["LUNES", "SABADO"],
        }),
      ),
    ).toBe("Lun y Sáb");
  });
});
