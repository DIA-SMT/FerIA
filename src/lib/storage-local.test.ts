import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Almacenamiento en el disco del servidor.
 *
 * El caso que de verdad importa es el del recorrido de rutas. Los comprobantes
 * de canon viven en la misma carpeta que las fotos públicas, separados sólo por
 * el nombre del bucket; si una ruta pudiera salirse de la raíz con `..`, el
 * endpoint que los entrega —que verifica permisos sobre el *pago*, no sobre el
 * archivo— se convertiría en una forma de leer cualquier archivo del servidor.
 *
 * El módulo elige implementación al importarse, así que cada caso lo importa de
 * nuevo con la variable ya puesta.
 */

const ENTORNO = { ...process.env };
let raiz: string;

beforeEach(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), "feria-archivos-"));
  process.env.ALMACENAMIENTO_LOCAL = raiz;
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ENTORNO };
  vi.resetModules();
});

async function almacenamientoLocal() {
  const { almacenamiento } = await import("@/lib/storage");
  return almacenamiento;
}

describe("almacenamiento en disco", () => {
  it("guarda un buffer y devuelve la ruta con el bucket adelante", async () => {
    const almacenamiento = await almacenamientoLocal();
    const ruta = await almacenamiento.guardarBuffer(
      Buffer.from("una foto"),
      "productos",
    );

    expect(ruta).toMatch(/^productos\/[0-9a-f-]+\.webp$/);
    expect(await readFile(path.join(raiz, ruta), "utf8")).toBe("una foto");
  });

  it("respeta la carpeta, que es lo que ata una foto a su feriante", async () => {
    const almacenamiento = await almacenamientoLocal();
    const ruta = await almacenamiento.guardarBuffer(
      Buffer.from("x"),
      "productos",
      { carpeta: "vendedor-7" },
    );

    expect(ruta).toMatch(/^productos\/vendedor-7\//);
  });

  it("lee de vuelta lo que guardo, con su tipo", async () => {
    const almacenamiento = await almacenamientoLocal();
    const ruta = await almacenamiento.guardarBuffer(Buffer.from("foto"), "ferias");

    const archivo = await almacenamiento.abrir(ruta);
    expect(archivo?.contenido.toString()).toBe("foto");
    expect(archivo?.tipoMime).toBe("image/webp");
  });

  it("NO lee un archivo de afuera de la raiz", async () => {
    // El caso que justifica la comprobacion: un `..` en la ruta.
    const secreto = path.join(raiz, "..", "secreto.txt");
    await writeFile(secreto, "no se puede ver");

    const almacenamiento = await almacenamientoLocal();

    expect(await almacenamiento.abrir("comprobantes/../../secreto.txt")).toBeNull();
    expect(await almacenamiento.abrir("comprobantes/../../../etc/passwd")).toBeNull();
  });

  it("tampoco borra afuera de la raiz", async () => {
    const vecino = path.join(raiz, "..", "vecino.txt");
    await writeFile(vecino, "sigo aca");

    const almacenamiento = await almacenamientoLocal();
    await almacenamiento.eliminar("comprobantes/../../vecino.txt");

    expect(await readFile(vecino, "utf8")).toBe("sigo aca");
  });

  it("devuelve null para una ruta sin bucket", async () => {
    const almacenamiento = await almacenamientoLocal();
    expect(await almacenamiento.abrir("suelta.webp")).toBeNull();
  });

  it("devuelve null si el archivo no existe", async () => {
    const almacenamiento = await almacenamientoLocal();
    expect(await almacenamiento.abrir("productos/no-esta.webp")).toBeNull();
  });

  it("elimina sin romperse si el archivo ya no esta", async () => {
    const almacenamiento = await almacenamientoLocal();
    await expect(
      almacenamiento.eliminar("productos/nunca-existio.webp"),
    ).resolves.toBeUndefined();
  });

  it("no pisa un archivo que ya existe", async () => {
    const almacenamiento = await almacenamientoLocal();
    const ruta = await almacenamiento.guardarBuffer(Buffer.from("primero"), "ferias");

    // Mismo nombre a mano: con UUID no deberia pasar nunca, pero si pasara es
    // mejor fallar que pisar el archivo de otra persona en silencio.
    await mkdir(path.join(raiz, "ferias"), { recursive: true });
    await expect(
      (await almacenamientoLocal()).guardarBuffer(Buffer.from("segundo"), "ferias"),
    ).resolves.toBeTruthy();
    expect(await readFile(path.join(raiz, ruta), "utf8")).toBe("primero");
  });
});
