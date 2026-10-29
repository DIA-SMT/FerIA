import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La ruta que entrega los archivos públicos.
 *
 * Los cuatro buckets viven en la misma carpeta, separados sólo por el nombre.
 * La lista blanca de `BUCKETS_PUBLICOS` es lo único que impide que un
 * comprobante de canon salga por la misma puerta que la foto de un tomate, así
 * que estos casos existen para que nadie la "simplifique" sin enterarse.
 */

const ENTORNO = { ...process.env };
let raiz: string;

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), "feria-publicos-"));
  process.env.ALMACENAMIENTO_LOCAL = raiz;
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ENTORNO };
  vi.resetModules();
});

/** Deja un archivo en el disco y pide esa misma ruta por la vía pública. */
async function pedir(rutaLogica: string): Promise<Response> {
  const destino = path.join(raiz, rutaLogica);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, "contenido");

  const { GET } = await import("@/app/archivos/[...ruta]/route");
  return GET(new Request(`http://local/archivos/${rutaLogica}`), {
    params: Promise.resolve({ ruta: rutaLogica.split("/") }),
  });
}

describe("GET /archivos/[...ruta]", () => {
  it("entrega un archivo de un bucket publico", async () => {
    const respuesta = await pedir("ferias/abc.webp");

    expect(respuesta.status).toBe(200);
    expect(await respuesta.text()).toBe("contenido");
    expect(respuesta.headers.get("cache-control")).toContain("immutable");
  });

  it("NO entrega un comprobante, aunque el archivo exista en el disco", async () => {
    const respuesta = await pedir("comprobantes/pago-de-alguien.pdf");

    expect(respuesta.status).toBe(404);
  });

  it("NO entrega nada de un bucket inventado", async () => {
    const respuesta = await pedir("secretos/cosas.webp");

    expect(respuesta.status).toBe(404);
  });

  it("rechaza una ruta sin bucket", async () => {
    const { GET } = await import("@/app/archivos/[...ruta]/route");
    const respuesta = await GET(new Request("http://local/archivos/suelta.webp"), {
      params: Promise.resolve({ ruta: ["suelta.webp"] }),
    });

    expect(respuesta.status).toBe(400);
  });

  it("devuelve 404 si el archivo no existe", async () => {
    const { GET } = await import("@/app/archivos/[...ruta]/route");
    const respuesta = await GET(new Request("http://local/archivos/ferias/no.webp"), {
      params: Promise.resolve({ ruta: ["ferias", "no.webp"] }),
    });

    expect(respuesta.status).toBe(404);
  });
});
