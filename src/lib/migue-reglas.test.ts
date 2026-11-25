import { describe, expect, it } from "vitest";

import {
  REGLAS_COMUNES,
  sinMarkdown,
  sinSaludoRepetido,
} from "@/lib/migue-reglas";

describe("sin saludar dos veces", () => {
  it("las reglas comunes le dicen que el chat ya saludó", () => {
    expect(REGLAS_COMUNES).toContain("no empieces tus respuestas con «¡Hola!»");
  });

  it("saca el «¡Hola!» del principio si la persona no saludó", () => {
    expect(
      sinSaludoRepetido(
        "¡Hola! Si buscás empanadas, te recomiendo a [Empanadas Doña Rosa](/stands/empanadas-donia-rosa).",
        "¿Dónde consigo empanadas?",
      ),
    ).toBe(
      "Si buscás empanadas, te recomiendo a [Empanadas Doña Rosa](/stands/empanadas-donia-rosa).",
    );
  });

  it("también con el nombre y con coma", () => {
    expect(
      sinSaludoRepetido(
        "¡Hola, Marta! Tu stand está aprobado.",
        "¿cómo va mi stand?",
      ),
    ).toBe("Tu stand está aprobado.");
    expect(
      sinSaludoRepetido(
        "Hola Marta, tu stand está aprobado.",
        "¿cómo va mi stand?",
      ),
    ).toBe("Tu stand está aprobado.");
    expect(sinSaludoRepetido("Hola, ¿qué feria te interesa?", "ferias")).toBe(
      "¿Qué feria te interesa?",
    );
    expect(
      sinSaludoRepetido("Buen día. Hay 3 revisiones pendientes.", "pendientes"),
    ).toBe("Hay 3 revisiones pendientes.");
  });

  it("si la persona saludó, el saludo queda", () => {
    expect(
      sinSaludoRepetido(
        "¡Hola, Marta! Tu stand está aprobado.",
        "Hola, ¿cómo va mi stand?",
      ),
    ).toBe("¡Hola, Marta! Tu stand está aprobado.");
    expect(
      sinSaludoRepetido(
        "¡Buenas! Sí, hay feria el sábado.",
        "buenas, ¿hay feria el sábado?",
      ),
    ).toBe("¡Buenas! Sí, hay feria el sábado.");
  });

  it("no toca lo que no es un saludo", () => {
    for (const texto of [
      "Buenas noticias: tu producto ya está publicado.",
      "Holanda no es una feria de acá.",
      "Tu stand está aprobado.",
    ]) {
      expect(sinSaludoRepetido(texto, "¿y mi producto?")).toBe(texto);
    }
  });

  it("saca las frases de entrada, aunque la persona haya saludado", () => {
    expect(
      sinSaludoRepetido(
        "¡Qué rico! Encontré a [Casa del Alfajor](/stands/casa-del-alfajor).",
        "busco alfajores",
      ),
    ).toBe("Encontré a [Casa del Alfajor](/stands/casa-del-alfajor).");
    expect(
      sinSaludoRepetido(
        "¡Qué buena pregunta! No tengo feriantes de velas.",
        "hola, ¿hay velas?",
      ),
    ).toBe("No tengo feriantes de velas.");
    expect(
      sinSaludoRepetido(
        "¡Con gusto te cuento! Hacen milanesas.",
        "¿qué hacen?",
      ),
    ).toBe("Hacen milanesas.");
    expect(sinSaludoRepetido("¡Claro! Hay 67.", "¿hay cosmética?")).toBe(
      "Hay 67.",
    );
    expect(
      sinSaludoRepetido(
        "¡Excelente, Rosa! ¿Cuántos te salen de una tanda?",
        "alfajores",
      ),
    ).toBe("¿Cuántos te salen de una tanda?");
  });

  it("no toca una exclamación que ya es la respuesta", () => {
    for (const texto of [
      "¡Sí! Hay feria el sábado.",
      "¡Claro que hay feria el sábado!",
      "¡Qué rico que suena! Te paso el catálogo.",
    ]) {
      expect(sinSaludoRepetido(texto, "¿hay feria?")).toBe(texto);
    }
  });

  it("si la respuesta es sólo el saludo, no la deja vacía", () => {
    expect(sinSaludoRepetido("¡Hola!", "?")).toBe("¡Hola!");
  });
});

describe("sin Markdown que el chat no dibuja", () => {
  it("saca negritas, viñetas con asterisco y títulos", () => {
    expect(
      sinMarkdown(
        "## Tu plan\n*   **Jueves 27:** contá que vas a la feria.\n* El sábado, historias.",
      ),
    ).toBe(
      "Tu plan\n- Jueves 27: contá que vas a la feria.\n- El sábado, historias.",
    );
  });

  it("no toca los hashtags ni los guiones", () => {
    const texto = "- Viernes a la noche.\n#HechoEnTucumán #Alfajores";
    expect(sinMarkdown(texto)).toBe(texto);
  });
});

describe("los botones para responder", () => {
  it("separa los de la última línea", async () => {
    const { separarOpciones } = await import("@/lib/migue-reglas");
    expect(
      separarOpciones(
        "¿Cuánto le querés ganar sobre lo que te cuesta?\n[[30 % | 50 % | El doble (100 %)]]",
      ),
    ).toEqual({
      texto: "¿Cuánto le querés ganar sobre lo que te cuesta?",
      opciones: ["30 %", "50 %", "El doble (100 %)"],
    });
  });

  it("sin corchetes no hay botones y el texto queda igual", async () => {
    const { separarOpciones } = await import("@/lib/migue-reglas");
    expect(separarOpciones("¿Cuánto tiempo te lleva la tanda?")).toEqual({
      texto: "¿Cuánto tiempo te lleva la tanda?",
      opciones: [],
    });
  });

  it("los del medio se sacan pero no se ofrecen", async () => {
    const { separarOpciones } = await import("@/lib/migue-reglas");
    expect(
      separarOpciones("Elegí [[Sí | No]] y después contame cuántas te salen."),
    ).toEqual({
      texto: "Elegí y después contame cuántas te salen.",
      opciones: [],
    });
  });

  it("descarta las vacías, las repetidas, las largas y las de más", async () => {
    const { separarOpciones } = await import("@/lib/migue-reglas");
    const { opciones } = separarOpciones(
      `¿Y?\n[[A | | A | ${"x".repeat(41)} | B | C | D | E]]`,
    );
    expect(opciones).toEqual(["A", "B", "C", "D"]);
  });
});
