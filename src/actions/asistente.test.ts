import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  El área la manda el navegador. Lo que se prueba acá es que eso no alcanza:
  Migue usa las consultas del panel sólo con una sesión de administrador
  verificada en el servidor, y lo que pregunta el personal no cae en el
  registro anónimo del público.
*/

const {
  sesion,
  responderConsultaPublica,
  responderConsultaAdmin,
  responderConsultaFeriante,
  prisma,
} = vi.hoisted(() => ({
  sesion: vi.fn(),
  responderConsultaPublica: vi.fn(async () => ({
    texto: "respuesta pública",
    herramientas: [] as string[],
  })),
  responderConsultaAdmin: vi.fn(async () => ({
    texto: "respuesta del panel",
    herramientas: ["resumen_pendientes"],
  })),
  responderConsultaFeriante: vi.fn(async () => ({
    texto: "respuesta del feriante",
    herramientas: [] as string[],
  })),
  prisma: {
    $transaction: vi.fn(async () => []),
    vendedor: { findUnique: vi.fn() },
    consultaAsistente: { create: vi.fn(), deleteMany: vi.fn() },
    consultaAdmin: { create: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "10.0.0.1" }),
}));
vi.mock("@/lib/session", () => ({ obtenerSesion: sesion }));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/ia-asistente-admin", () => ({ responderConsultaAdmin }));
vi.mock("@/lib/ia-asistente-feriante", async (original) => ({
  ...(await original<typeof import("@/lib/ia-asistente-feriante")>()),
  responderConsultaFeriante,
}));
vi.mock("@/lib/ia-asistente-publico", () => ({ responderConsultaPublica }));

import { preguntarAlAsistente } from "@/actions/asistente";
import { CONSULTA_DE_FINANZAS } from "@/lib/ia-asistente-feriante";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("preguntarAlAsistente", () => {
  it("con sesión de administrador usa las consultas del panel y deja constancia", async () => {
    sesion.mockResolvedValue({
      id: "u1",
      rol: "ADMIN",
      nombre: "Ana",
      email: "a@b.c",
    });

    const respuesta = await preguntarAlAsistente(
      [],
      "¿cuántas revisiones hay?",
      "administracion",
    );

    expect(respuesta).toEqual({ ok: true, texto: "respuesta del panel" });
    expect(responderConsultaAdmin).toHaveBeenCalledOnce();
    expect(responderConsultaPublica).not.toHaveBeenCalled();
    expect(prisma.consultaAdmin.create).toHaveBeenCalledWith({
      data: {
        usuarioId: "u1",
        pregunta: "¿cuántas revisiones hay?",
        herramientas: ["resumen_pendientes"],
        fallo: false,
      },
    });
    // Nada en el registro anónimo del público.
    expect(prisma.consultaAsistente.create).not.toHaveBeenCalled();
  });

  it("un feriante que dice «administracion» recibe al Migue público", async () => {
    sesion.mockResolvedValue({
      id: "u2",
      rol: "VENDEDOR",
      nombre: "B",
      email: "b@c.d",
    });

    const respuesta = await preguntarAlAsistente(
      [],
      "¿cuántas revisiones hay?",
      "administracion",
    );

    expect(respuesta).toEqual({ ok: true, texto: "respuesta pública" });
    expect(responderConsultaAdmin).not.toHaveBeenCalled();
    expect(responderConsultaPublica).toHaveBeenCalledWith(
      [],
      "¿cuántas revisiones hay?",
      {
        area: "publico",
      },
    );
  });

  it("sin sesión, también", async () => {
    sesion.mockResolvedValue(null);

    await preguntarAlAsistente(
      [],
      "¿qué feria tiene doña rosita?",
      "administracion",
    );

    expect(responderConsultaAdmin).not.toHaveBeenCalled();
    expect(responderConsultaPublica).toHaveBeenCalledOnce();
  });
});

describe("Migue del feriante", () => {
  const FERIANTE = {
    id: "u3",
    rol: "VENDEDOR",
    nombre: "ROSA PÉREZ",
    email: "r@p.q",
  };

  it("con sesión de feriante y ficha, contesta con su stand", async () => {
    sesion.mockResolvedValue(FERIANTE);
    prisma.vendedor.findUnique.mockResolvedValue({
      id: "v3",
      emprendimiento: "Doña Rosita",
    });

    const respuesta = await preguntarAlAsistente(
      [],
      "¿qué stand me tocó?",
      "feriante",
    );

    expect(respuesta).toEqual({ ok: true, texto: "respuesta del feriante" });
    expect(prisma.vendedor.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: "u3" } }),
    );
    expect(responderConsultaFeriante).toHaveBeenCalledWith(
      { vendedorId: "v3", nombre: "ROSA PÉREZ", emprendimiento: "Doña Rosita" },
      [],
      "¿qué stand me tocó?",
    );
    expect(prisma.consultaAsistente.create).toHaveBeenCalledWith({
      data: { pregunta: "¿qué stand me tocó?" },
    });
  });

  it("de una consulta de finanzas guarda que la hubo, no el texto", async () => {
    sesion.mockResolvedValue(FERIANTE);
    prisma.vendedor.findUnique.mockResolvedValue({
      id: "v3",
      emprendimiento: "Doña Rosita",
    });

    await preguntarAlAsistente(
      [],
      "la harina me cuesta 1200 el kilo",
      "feriante",
    );

    expect(prisma.consultaAsistente.create).toHaveBeenCalledWith({
      data: { pregunta: CONSULTA_DE_FINANZAS },
    });
  });

  it("los botones vienen aparte del texto", async () => {
    sesion.mockResolvedValue(FERIANTE);
    prisma.vendedor.findUnique.mockResolvedValue({
      id: "v3",
      emprendimiento: "Doña Rosita",
    });
    responderConsultaFeriante.mockResolvedValueOnce({
      texto: "¿Querés que la guarde?\n[[Sí, guardala | No, gracias]]",
      herramientas: ["calcular_precio"],
    });

    expect(await preguntarAlAsistente([], "50 %", "feriante")).toEqual({
      ok: true,
      texto: "¿Querés que la guarde?",
      opciones: ["Sí, guardala", "No, gracias"],
    });
  });

  it("la respuesta suelta a una pregunta del cálculo tampoco queda", async () => {
    sesion.mockResolvedValue(FERIANTE);
    prisma.vendedor.findUnique.mockResolvedValue({
      id: "v3",
      emprendimiento: "Doña Rosita",
    });

    await preguntarAlAsistente(
      [
        { rol: "usuario", texto: "24" },
        {
          rol: "asistente",
          texto: "¿Cuánto gastás en total en ingredientes para esa tanda?",
        },
      ],
      "15000",
      "feriante",
    );

    expect(prisma.consultaAsistente.create).toHaveBeenCalledWith({
      data: { pregunta: CONSULTA_DE_FINANZAS },
    });
  });

  it("recuerda toda la cuenta de un precio, no sólo los últimos ocho turnos", async () => {
    sesion.mockResolvedValue(FERIANTE);
    prisma.vendedor.findUnique.mockResolvedValue({
      id: "v3",
      emprendimiento: "Doña Rosita",
    });
    const historial = Array.from({ length: 20 }, (_, indice) => ({
      rol: indice % 2 === 0 ? ("asistente" as const) : ("usuario" as const),
      texto: `turno ${indice}`,
    }));

    await preguntarAlAsistente(historial, "No, gracias", "feriante");

    expect(responderConsultaFeriante).toHaveBeenCalledWith(
      expect.anything(),
      historial,
      "No, gracias",
    );
  });

  it("sin ficha de feriante, recibe al Migue público", async () => {
    sesion.mockResolvedValue(FERIANTE);
    prisma.vendedor.findUnique.mockResolvedValue(null);

    await preguntarAlAsistente([], "¿qué stand me tocó?", "feriante");

    expect(responderConsultaFeriante).not.toHaveBeenCalled();
    expect(responderConsultaPublica).toHaveBeenCalledOnce();
  });

  it("un administrador que dice «feriante» no entra a ningún stand", async () => {
    sesion.mockResolvedValue({
      id: "u1",
      rol: "ADMIN",
      nombre: "Ana",
      email: "a@b.c",
    });

    await preguntarAlAsistente([], "¿qué stand me tocó?", "feriante");

    expect(prisma.vendedor.findUnique).not.toHaveBeenCalled();
    expect(responderConsultaFeriante).not.toHaveBeenCalled();
  });
});
