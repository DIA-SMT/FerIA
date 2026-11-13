import { afterEach, describe, expect, it, vi } from "vitest";

// El armado del prompt no consulta la base; se mockea para que importar el
// módulo no levante un cliente de Prisma.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { construirMensajes } from "@/lib/ia-asistente";

function sistema(area?: Parameters<typeof construirMensajes>[3]): string {
  return construirMensajes("(datos)", [], "hola", area)[0]!.content;
}

describe("la guía de cada área en el prompt de Migue", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("en el sitio público no habla de los paneles", () => {
    const texto = sistema();
    expect(texto).toContain("un vecino");
    expect(texto).not.toContain("/mi-stand");
    expect(texto).not.toContain("/admin");
  });

  it("al feriante le explica su panel con rutas que existen", () => {
    const texto = sistema("feriante");
    expect(texto).toContain("(/mi-stand/perfil)");
    expect(texto).toContain("(/mi-stand/productos)");
    expect(texto).not.toContain("/admin");
  });

  it("no le nombra el canon al feriante mientras no se cobra", () => {
    vi.stubEnv("MOSTRAR_CANON", "");
    expect(sistema("feriante")).not.toContain("/mi-stand/canon");

    vi.stubEnv("MOSTRAR_CANON", "true");
    expect(sistema("feriante")).toContain("(/mi-stand/canon)");
  });

  it("a la administración le explica su panel", () => {
    const texto = sistema("administracion");
    expect(texto).toContain("(/admin/postulaciones)");
    expect(texto).toContain("(/admin/ferias)");
    expect(texto).not.toContain("/mi-stand/perfil");
  });
});
