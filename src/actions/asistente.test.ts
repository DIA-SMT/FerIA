import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  El área la manda el navegador. Lo que se prueba acá es que eso no alcanza:
  Migue usa las consultas del panel sólo con una sesión de administrador
  verificada en el servidor, y lo que pregunta el personal no cae en el
  registro anónimo del público.
*/

const { sesion, responderConsulta, responderConsultaAdmin, prisma } =
  vi.hoisted(() => ({
    sesion: vi.fn(),
    responderConsulta: vi.fn(async () => "respuesta pública"),
    responderConsultaAdmin: vi.fn(async () => ({
      texto: "respuesta del panel",
      herramientas: ["resumen_pendientes"],
    })),
    prisma: {
      $transaction: vi.fn(async () => []),
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
vi.mock("@/lib/ia-asistente", async (original) => ({
  ...(await original<typeof import("@/lib/ia-asistente")>()),
  responderConsulta,
}));

import { preguntarAlAsistente } from "@/actions/asistente";

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
    expect(responderConsulta).not.toHaveBeenCalled();
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
    expect(responderConsulta).toHaveBeenCalledWith(
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
    expect(responderConsulta).toHaveBeenCalledOnce();
  });
});
