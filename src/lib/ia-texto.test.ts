import { describe, expect, it } from "vitest";

import {
  construirPrompt,
  construirPromptPreguntas,
  extraerPreguntas,
} from "@/lib/ia-texto";
import { alcanzaParaMejorar, respuestasContestadas } from "@/lib/redaccion";

const TALLER = { nombre: "La vieja escuela", categoria: "Gastronomía" };

describe("las preguntas que devuelve el modelo", () => {
  it("saca numeración, viñetas y negritas", () => {
    const bruto = [
      "1. ¿Qué platos hacés?",
      "2) ¿Con qué ingredientes cocinás?",
      "- ¿Qué tiene de bodegón tu cocina?",
      "• ¿Tomás encargos para eventos?",
      "**¿Cocinás todo vos o en equipo?**",
    ].join("\n");

    expect(extraerPreguntas(bruto)).toEqual([
      "¿Qué platos hacés?",
      "¿Con qué ingredientes cocinás?",
      "¿Qué tiene de bodegón tu cocina?",
      "¿Tomás encargos para eventos?",
      "¿Cocinás todo vos o en equipo?",
    ]);
  });

  it("descarta lo que no es una pregunta y las repetidas", () => {
    const bruto = [
      "Acá van las preguntas:",
      "",
      "¿Qué platos hacés?",
      "¿Qué platos hacés?",
      "¿Con qué ingredientes cocinás?",
    ].join("\n");

    expect(extraerPreguntas(bruto)).toEqual([
      "¿Qué platos hacés?",
      "¿Con qué ingredientes cocinás?",
    ]);
  });

  it("no pasa de cinco", () => {
    const bruto = Array.from({ length: 8 }, (_, i) => `¿Pregunta número ${i}?`);
    expect(extraerPreguntas(bruto.join("\n"))).toHaveLength(5);
  });
});

describe("el texto con lo que contestó en la entrevista", () => {
  const respuestas = [
    { pregunta: "¿Qué platos hacés?", respuesta: "Milanesas, guiso y flan casero" },
    { pregunta: "¿Tomás encargos?", respuesta: "  " },
  ];

  it("lleva las respuestas y deja afuera las salteadas", () => {
    const prompt = construirPrompt({ modo: "entrevista", respuestas }, TALLER);

    expect(prompt).toContain("R: Milanesas, guiso y flan casero");
    expect(prompt).not.toContain("¿Tomás encargos?");
  });

  it("no pide huecos entre corchetes", () => {
    const prompt = construirPrompt({ modo: "entrevista", respuestas }, TALLER);

    expect(prompt).toContain("NO dejes huecos, corchetes");
    expect(prompt).not.toMatch(/dejá .*entre corchetes/);
  });

  it("conserva lo poco que ya había escrito", () => {
    const prompt = construirPrompt(
      { modo: "entrevista", respuestas },
      { ...TALLER, descripcion: "Neo bodegón" },
    );

    expect(prompt).toContain("LO QUE YA HABÍA ESCRITO");
    expect(prompt).toContain("Neo bodegón");
  });
});

describe("el prompt de las preguntas", () => {
  it("adapta al rubro y no pregunta lo que tiene su propio campo", () => {
    const prompt = construirPromptPreguntas(TALLER);

    expect(prompt).toContain("Rubro: Gastronomía");
    expect(prompt).toContain("NO preguntes precios, teléfonos");
    expect(prompt).not.toContain("LO QUE YA ESCRIBIÓ");
  });

  it("le muestra lo escrito para no volver a preguntarlo", () => {
    const prompt = construirPromptPreguntas({
      ...TALLER,
      descripcion: "Hacemos comida casera",
    });

    expect(prompt).toContain("LO QUE YA ESCRIBIÓ:\nHacemos comida casera");
  });
});

describe("qué hacer con lo escrito", () => {
  it("con poco texto se pregunta, con bastante se mejora", () => {
    expect(alcanzaParaMejorar("hago tazas")).toBe(false);
    expect(alcanzaParaMejorar("x".repeat(120))).toBe(true);
    expect(alcanzaParaMejorar(null)).toBe(false);
  });

  it("las respuestas salteadas no cuentan", () => {
    expect(
      respuestasContestadas([
        { pregunta: "¿Uno?", respuesta: " sí " },
        { pregunta: "¿Dos?", respuesta: "" },
      ]),
    ).toEqual([{ pregunta: "¿Uno?", respuesta: "sí" }]);
  });
});
