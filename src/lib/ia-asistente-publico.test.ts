import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Lo que el modelo manda como argumentos no se cree: se valida antes de tocar
  la base. Y lo que manda «vacío» —un rubro "" o null— se toma como que no
  filtró, en vez de devolverle un error que lo haga dar otra vuelta.
*/

const consultas = vi.hoisted(() => ({
  buscarFeriantesPublicos: vi.fn(async () => ({ total: 0, feriantes: [] })),
  verFeriantePublico: vi.fn(async () => ({})),
  modoFeriaPublico: vi.fn(async () => []),
  feriantesPorRubro: vi.fn(async () => ""),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/consultas-publicas", async (original) => ({
  ...(await original<typeof import("@/lib/consultas-publicas")>()),
  ...consultas,
}));

import { mensajeDeSistemaPublico } from "@/lib/ia-asistente";
import {
  EJECUTORES_PUBLICOS,
  HERRAMIENTAS_PUBLICAS,
} from "@/lib/ia-asistente-publico";
import { ejecutarCon } from "@/lib/ia-herramientas";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("las consultas del Migue público", () => {
  it("busca con lo que pidió y descarta los filtros vacíos", async () => {
    await ejecutarCon(
      EJECUTORES_PUBLICOS,
      "buscar_feriantes",
      JSON.stringify({ texto: " alfajores ", rubro: "", feria: null }),
    );
    expect(consultas.buscarFeriantesPublicos).toHaveBeenCalledWith({
      texto: "alfajores",
    });
  });

  it("no acepta un rubro que no existe", async () => {
    const resultado = await ejecutarCon(
      EJECUTORES_PUBLICOS,
      "buscar_feriantes",
      JSON.stringify({ rubro: "PANADERIA" }),
    );
    expect(resultado).toMatchObject({ error: "Argumentos inválidos." });
    expect(consultas.buscarFeriantesPublicos).not.toHaveBeenCalled();
  });

  it("ver_feriante pide el slug", async () => {
    const resultado = await ejecutarCon(
      EJECUTORES_PUBLICOS,
      "ver_feriante",
      "{}",
    );
    expect(resultado).toMatchObject({ error: "Argumentos inválidos." });

    await ejecutarCon(
      EJECUTORES_PUBLICOS,
      "ver_feriante",
      JSON.stringify({ slug: "dulces-de-tita" }),
    );
    expect(consultas.verFeriantePublico).toHaveBeenCalledWith("dulces-de-tita");
  });

  it("modo_feria sin tipo trae los dos", async () => {
    await ejecutarCon(
      EJECUTORES_PUBLICOS,
      "modo_feria",
      JSON.stringify({ tipo: "" }),
    );
    expect(consultas.modoFeriaPublico).toHaveBeenCalledWith(undefined);
  });

  it("cada consulta ofrecida tiene quién la corra", () => {
    for (const herramienta of HERRAMIENTAS_PUBLICAS) {
      expect(EJECUTORES_PUBLICOS).toHaveProperty(herramienta.function.name);
    }
  });
});

describe("el prompt del Migue público", () => {
  it("le pide buscar antes de decir que algo no está", () => {
    const texto = mensajeDeSistemaPublico("(datos)");
    expect(texto).toContain("buscar_feriantes");
    expect(texto).toContain("Nunca digas que alguien o algo no está");
  });
});
