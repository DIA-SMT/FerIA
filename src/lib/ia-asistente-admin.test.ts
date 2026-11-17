import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Lo que no puede fallar de Migue en el panel:

  · Que cada herramienta que se le ofrece al modelo tenga quién la corra, y
    que los argumentos malos vuelvan como error legible y no tiren abajo la
    respuesta.
  · Que lo que se le pasa al modelo no lleve documento ni datos de contacto,
    aunque la base los devuelva.
*/

const { prisma } = vi.hoisted(() => ({
  prisma: {
    vendedor: { findMany: vi.fn(), findUnique: vi.fn() },
    producto: { count: vi.fn() },
    interesStand: { aggregate: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/busqueda-feriantes", async (original) => ({
  ...(await original<typeof import("@/lib/busqueda-feriantes")>()),
  buscarFeriantes: vi.fn(async () => ["v1"]),
}));

import {
  buscarFeriantesAdmin,
  fichaFerianteAdmin,
} from "@/lib/consultas-admin";
import {
  HERRAMIENTAS,
  ejecutarHerramienta,
  limpiarEnlaces,
} from "@/lib/ia-asistente-admin";

/** Una ficha con todo lo privado cargado, para ver que no se filtra. */
const PRIVADO = {
  dni: "28111222",
  telefono: "3815550000",
  whatsapp: "5493815550001",
  email: "rosa.privada@ejemplo.com",
  direccion: "Calle Falsa 123",
};

const FICHA = {
  id: "v1",
  emprendimiento: "Doña Rosita",
  slug: "dona-rosita",
  rubro: "GASTRONOMIA",
  estado: "APROBADO",
  motivoRechazo: null,
  origen: "PROPIO",
  feriaOrigen: null,
  nombreResponsable: "Rosa Pérez",
  creadoEn: new Date("2026-10-01T12:00:00Z"),
  revisadoEn: new Date("2026-10-02T12:00:00Z"),
  usuario: { nombre: "Rosa Pérez", email: PRIVADO.email },
  postulaciones: [
    {
      estado: "ACEPTADA",
      creadoEn: new Date("2026-10-03T12:00:00Z"),
      revisadoEn: new Date("2026-10-04T12:00:00Z"),
      motivoRechazo: null,
      feria: { id: "f1", nombre: "Feria Gourmet" },
    },
  ],
  stands: [],
  cambios: [],
  _count: { productos: 3 },
  ...PRIVADO,
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.vendedor.findMany.mockResolvedValue([FICHA]);
  prisma.vendedor.findUnique.mockResolvedValue(FICHA);
  prisma.producto.count.mockResolvedValue(2);
  prisma.interesStand.aggregate.mockResolvedValue({
    _sum: { aperturas: 10, consultas: 2 },
  });
});

function sinDatosPrivados(resultado: unknown) {
  const texto = JSON.stringify(resultado);
  for (const valor of Object.values(PRIVADO)) {
    expect(texto).not.toContain(valor);
  }
}

describe("herramientas", () => {
  it("cada una que se ofrece al modelo se puede correr", async () => {
    for (const herramienta of HERRAMIENTAS) {
      const resultado = await ejecutarHerramienta(
        herramienta.function.name,
        "{",
      );
      // JSON roto: tiene que contestar el error de argumentos, no «no existe».
      expect(resultado).toEqual({
        error: "Los argumentos no son JSON válido.",
      });
    }
  });

  it("una que no existe vuelve como error", async () => {
    expect(await ejecutarHerramienta("borrar_todo", "{}")).toEqual({
      error: "No existe la consulta «borrar_todo».",
    });
  });

  it("los argumentos inválidos vuelven como error sin tocar la base", async () => {
    const resultado = await ejecutarHerramienta("buscar_feriantes", "{}");
    expect(resultado).toMatchObject({ error: "Argumentos inválidos." });
    expect(prisma.vendedor.findMany).not.toHaveBeenCalled();
  });
});

describe("lo que ve el modelo", () => {
  it("la búsqueda no lleva documento ni contacto", async () => {
    const resultado = await buscarFeriantesAdmin("doña rosita");
    expect(resultado.coincidencias[0]).toMatchObject({
      emprendimiento: "Doña Rosita",
      responsable: "Rosa Pérez",
      feriasHabilitadas: [
        { feria: "Feria Gourmet", enlace: "/admin/ferias/f1" },
      ],
      ficha: "/admin/feriantes/v1",
    });
    sinDatosPrivados(resultado);
  });

  it("la ficha no lleva documento ni contacto", async () => {
    const resultado = await fichaFerianteAdmin("v1");
    expect(resultado).toMatchObject({
      emprendimiento: "Doña Rosita",
      productos: { cargados: 3, publicados: 2 },
    });
    sinDatosPrivados(resultado);
  });
});

describe("limpiarEnlaces", () => {
  const traidas = new Set([
    "/admin/feriantes/v1",
    "/admin/revisiones?feria=gourmet",
  ]);

  it("deja los que trajo una consulta y las secciones fijas", () => {
    const texto =
      "[Doña Rosita](/admin/feriantes/v1), [Revisiones](/admin/revisiones?feria=gourmet) y [Postulaciones](/admin/postulaciones).";
    expect(limpiarEnlaces(texto, traidas)).toBe(texto);
  });

  it("saca los inventados y deja el texto", () => {
    expect(
      limpiarEnlaces(
        "Está en la [Feria de Artesanos](/admin/ferias/inventado).",
        traidas,
      ),
    ).toBe("Está en la Feria de Artesanos.");
  });
});
