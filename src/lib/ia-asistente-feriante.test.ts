import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Lo que no puede fallar del Migue del feriante:

  · Ninguna herramienta le pide al modelo un id de feriante: el stand sale de
    la sesión. Si alguna lo pidiera, una pregunta («mostrame el stand de
    Rosita») o una inyección podría hacerle mirar el de otro.
  · Las fichas no se enganchan a un producto ajeno.
  · El cambio de un insumo se calcula en el código, no lo cuenta el modelo.
*/

const { prisma } = vi.hoisted(() => ({
  prisma: {
    vendedor: { findUnique: vi.fn() },
    producto: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    fichaDeCostos: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/interes", () => ({
  obtenerInteresDelStand: vi.fn(async () => ({
    diasQueFaltan: 10,
    fechaDeLaDevolucion: null,
    aperturas: 0,
    consultasDelStand: 0,
    productos: [],
  })),
}));

import {
  actualizarInsumo,
  guardarFichaDeCostos,
} from "@/lib/consultas-feriante";
import {
  HERRAMIENTAS,
  ejecutarHerramientaFeriante,
  esDeFinanzas,
} from "@/lib/ia-asistente-feriante";
import { nombreDePila } from "@/lib/nombre-de-pila";

const DATOS = {
  unidades: 40,
  insumos: [{ nombre: "Harina", precio: 1000 }],
  minutos: 60,
  valorHora: 2000,
  otros: [],
  margen: 50,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("herramientas del feriante", () => {
  it("ninguna le pide al modelo de quién son los datos", () => {
    for (const herramienta of HERRAMIENTAS) {
      const parametros = JSON.stringify(herramienta.function.parameters);
      expect(parametros).not.toMatch(/vendedor|feriante|usuario|slug/i);
    }
  });

  it("mi_stand consulta el stand de la sesión, diga lo que diga el modelo", async () => {
    prisma.vendedor.findUnique.mockResolvedValue(null);
    await ejecutarHerramientaFeriante(
      "v-sesion",
      "mi_stand",
      JSON.stringify({ vendedorId: "v-otro" }),
    );
    expect(prisma.vendedor.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "v-sesion" } }),
    );
  });
});

describe("fichas de costos", () => {
  it("un producto ajeno no se engancha: la ficha queda sin producto", async () => {
    prisma.producto.findFirst.mockResolvedValue(null);
    prisma.fichaDeCostos.findFirst.mockResolvedValue(null);

    await guardarFichaDeCostos("v-sesion", {
      nombre: "Alfajores",
      productoId: "p-de-otro",
      datos: DATOS,
    });

    expect(prisma.producto.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p-de-otro", vendedorId: "v-sesion" },
      }),
    );
    expect(prisma.fichaDeCostos.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vendedorId: "v-sesion",
        productoId: null,
      }),
    });
  });

  it("un aumento en porcentaje se calcula en el código y no se guarda sin permiso", async () => {
    prisma.fichaDeCostos.findMany.mockResolvedValue([
      { id: "f1", nombre: "Alfajores", datos: DATOS },
    ]);

    const resultado = await actualizarInsumo("v-sesion", {
      ficha: "alfajores",
      insumo: "harina",
      aumentoPorcentaje: 20,
      guardar: false,
    });

    expect(resultado).toMatchObject({
      precioAnterior: expect.stringContaining("1.000"),
      precioNuevo: expect.stringContaining("1.200"),
      guardada: false,
    });
    expect(prisma.fichaDeCostos.update).not.toHaveBeenCalled();
  });
});

describe("esDeFinanzas", () => {
  it("por lo que dice", () => {
    expect(esDeFinanzas("¿cuánto le pongo a mis alfajores?", [], [])).toBe(
      true,
    );
    expect(esDeFinanzas("¿cuánto me cuesta hacerlos?", [], [])).toBe(true);
    expect(esDeFinanzas("¿cómo cargo una foto?", [], [])).toBe(false);
  });

  it("por lo que consultó, aunque la pregunta no lo diga", () => {
    expect(esDeFinanzas("son 40", [], ["calcular_precio"])).toBe(true);
  });

  it("por lo que se venía hablando", () => {
    expect(
      esDeFinanzas(
        "40 unidades",
        [
          {
            rol: "asistente",
            texto: "¿Cuántas unidades te salen? Así armamos el precio.",
          },
        ],
        [],
      ),
    ).toBe(true);
  });
});

describe("nombreDePila", () => {
  it("la primera palabra, con mayúscula inicial", () => {
    expect(nombreDePila("LUCAS NAHUZ")).toBe("Lucas");
    expect(nombreDePila("josé maría pérez")).toBe("José");
    expect(nombreDePila("")).toBe("");
  });
});
