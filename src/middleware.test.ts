import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NOMBRE_COOKIE } from "@/lib/auth/cookie";
import { emitirToken } from "@/lib/auth/token";
import { middleware } from "@/middleware";

/**
 * La primera barrera: quién llega a cada panel.
 *
 * El middleware decide con el token y sin consultar la base, así que un rol que
 * cambió hace un minuto puede venir viejo. Eso está contemplado —`session.ts`
 * vuelve a verificar y redirige— pero no es excusa para que esta capa se
 * equivoque: es la que evita que `/admin` ni se renderice para quien no
 * corresponde. Ver docs/autenticacion.md.
 */

const SECRETO = "un-secreto-de-prueba-bien-largo-para-hs256";
const ENTORNO = { ...process.env };

beforeEach(() => {
  process.env.SESION_SECRETO = SECRETO;
});

afterEach(() => {
  process.env = { ...ENTORNO };
});

/** Arma una petición a `ruta`, opcionalmente con sesión de ese rol. */
async function pedir(
  ruta: string,
  rol?: "ADMIN" | "VENDEDOR",
): Promise<Response> {
  const peticion = new NextRequest(new URL(`https://feria.test${ruta}`));

  if (rol) {
    const token = await emitirToken("11111111-1111-1111-1111-111111111111", rol);
    peticion.cookies.set(NOMBRE_COOKIE, token);
  }

  return middleware(peticion);
}

/** A dónde manda una respuesta de redirección, sin el dominio. */
function destino(respuesta: Response): string | null {
  const url = respuesta.headers.get("location");
  return url ? new URL(url).pathname + new URL(url).search : null;
}

describe("sin sesión", () => {
  it("manda al login y se acuerda de a dónde iba", async () => {
    const respuesta = await pedir("/admin/postulaciones");

    expect(destino(respuesta)).toBe("/ingresar?volverA=%2Fadmin%2Fpostulaciones");
  });

  it("también desde el panel del feriante", async () => {
    expect(destino(await pedir("/mi-stand/productos"))).toContain("/ingresar");
  });

  it("y desde la encuesta, que pide sesión aunque no pida rol", async () => {
    expect(destino(await pedir("/encuesta"))).toContain("/ingresar");
  });

  it("deja ver el login", async () => {
    expect(destino(await pedir("/ingresar"))).toBeNull();
  });
});

describe("con sesión de feriante", () => {
  it("entra a su panel", async () => {
    expect(destino(await pedir("/mi-stand", "VENDEDOR"))).toBeNull();
  });

  it("NO entra al panel municipal", async () => {
    // El caso que importa: un feriante no puede aprobar feriantes ni registrar
    // pagos de canon, y esto lo frena antes de que la página se renderice.
    expect(destino(await pedir("/admin", "VENDEDOR"))).toBe("/mi-stand");
    expect(destino(await pedir("/admin/postulaciones", "VENDEDOR"))).toBe("/mi-stand");
  });

  it("si ya está adentro, el login lo devuelve a su panel", async () => {
    expect(destino(await pedir("/ingresar", "VENDEDOR"))).toBe("/mi-stand");
  });
});

describe("con sesión municipal", () => {
  it("entra al panel de administración", async () => {
    expect(destino(await pedir("/admin/postulaciones", "ADMIN"))).toBeNull();
  });

  it("no entra al panel del feriante, que no es suyo", async () => {
    expect(destino(await pedir("/mi-stand", "ADMIN"))).toBe("/admin");
  });

  it("si ya está adentro, el login lo devuelve a su panel", async () => {
    expect(destino(await pedir("/ingresar", "ADMIN"))).toBe("/admin");
  });
});

describe("tokens que no sirven", () => {
  it("un token manipulado es lo mismo que no tener sesión", async () => {
    const peticion = new NextRequest(new URL("https://feria.test/admin"));
    const token = await emitirToken("11111111-1111-1111-1111-111111111111", "ADMIN");
    const [c, cuerpo, f] = token.split(".");
    peticion.cookies.set(NOMBRE_COOKIE, `${c}.${cuerpo?.slice(0, -2)}XX.${f}`);

    expect(destino(await middleware(peticion))).toContain("/ingresar");
  });

  it("un token firmado con otro secreto tampoco entra", async () => {
    const peticion = new NextRequest(new URL("https://feria.test/admin"));
    const token = await emitirToken("11111111-1111-1111-1111-111111111111", "ADMIN");
    peticion.cookies.set(NOMBRE_COOKIE, token);

    process.env.SESION_SECRETO = "otro-secreto-igual-de-largo-pero-distinto";

    expect(destino(await middleware(peticion))).toContain("/ingresar");
  });

  it("sin SESION_SECRETO no entra nadie, en vez de entrar cualquiera", async () => {
    const peticion = new NextRequest(new URL("https://feria.test/admin"));
    const token = await emitirToken("11111111-1111-1111-1111-111111111111", "ADMIN");
    peticion.cookies.set(NOMBRE_COOKIE, token);

    delete process.env.SESION_SECRETO;

    // Falla cerrado: una configuración incompleta deja a todos afuera y no a
    // todos adentro.
    expect(destino(await middleware(peticion))).toContain("/ingresar");
  });
});
