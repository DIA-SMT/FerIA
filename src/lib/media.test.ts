import { afterEach, describe, expect, it } from "vitest";

import { urlPublica } from "@/lib/media";

/**
 * Cómo se arma la URL de un archivo guardado.
 *
 * En la base se guarda siempre la misma ruta (`ferias/abc.webp`), y de dónde
 * sale el archivo depende del entorno. Estos casos fijan esa decisión, que es
 * la que permitió mudar los archivos de Supabase al disco del servidor sin
 * tocar un solo dato.
 */

const ENTORNO = { ...process.env };
afterEach(() => {
  process.env = { ...ENTORNO };
});

function sinVariables() {
  delete process.env.NEXT_PUBLIC_ARCHIVOS_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
}

describe("urlPublica", () => {
  it("devuelve null cuando no hay ruta", () => {
    expect(urlPublica(null)).toBeNull();
    expect(urlPublica(undefined)).toBeNull();
    expect(urlPublica("")).toBeNull();
  });

  it("usa el disco propio cuando esta configurado", () => {
    sinVariables();
    process.env.NEXT_PUBLIC_ARCHIVOS_URL = "/archivos";

    expect(urlPublica("ferias/abc.webp")).toBe("/archivos/ferias/abc.webp");
  });

  it("no duplica la barra si el prefijo ya la trae", () => {
    sinVariables();
    process.env.NEXT_PUBLIC_ARCHIVOS_URL = "/archivos/";

    expect(urlPublica("ferias/abc.webp")).toBe("/archivos/ferias/abc.webp");
  });

  it("el disco propio le gana a Supabase si estan los dos", () => {
    // Durante la mudanza conviven las dos variables. Que gane el disco es lo
    // que hace que el corte sea prender una variable y no editar codigo.
    sinVariables();
    process.env.NEXT_PUBLIC_ARCHIVOS_URL = "/archivos";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ref.supabase.co";

    expect(urlPublica("productos/abc.webp")).toBe("/archivos/productos/abc.webp");
  });

  it("cae en Supabase cuando no hay disco propio", () => {
    sinVariables();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ref.supabase.co";

    expect(urlPublica("productos/abc.webp")).toBe(
      "https://ref.supabase.co/storage/v1/object/public/productos/abc.webp",
    );
  });

  it("devuelve null si no hay ningun origen configurado", () => {
    sinVariables();
    expect(urlPublica("productos/abc.webp")).toBeNull();
  });

  it("deja pasar una ruta absoluta tal cual", () => {
    sinVariables();
    process.env.NEXT_PUBLIC_ARCHIVOS_URL = "/archivos";

    expect(urlPublica("/una-imagen-del-sitio.webp")).toBe(
      "/una-imagen-del-sitio.webp",
    );
  });

  it("deja pasar una URL completa tal cual", () => {
    sinVariables();
    process.env.NEXT_PUBLIC_ARCHIVOS_URL = "/archivos";

    expect(urlPublica("https://otro.sitio/foto.webp")).toBe(
      "https://otro.sitio/foto.webp",
    );
  });
});
