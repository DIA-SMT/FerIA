import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NOMBRE_COOKIE, opcionesCookie, opcionesParaBorrar } from "@/lib/auth/cookie";
import { hashearPassword, verificarPassword } from "@/lib/auth/password";
import {
  convieneRenovar,
  DURACION_SEGUNDOS,
  emitirToken,
  leerToken,
} from "@/lib/auth/token";

/**
 * El mecanismo de sesión propio, el que reemplazó a Supabase Auth.
 *
 * Es el único código de seguridad que escribimos nosotros, así que estas
 * pruebas no están para que el archivo tenga pruebas: cada caso corresponde a
 * una forma concreta de entrar sin permiso, y varios cubren atributos de una
 * línea que alguien podría "limpiar" sin saber qué sostenían.
 *
 * Ver docs/autenticacion.md.
 */

const SECRETO = "un-secreto-de-prueba-bien-largo-para-hs256";
const ENTORNO = { ...process.env };

beforeEach(() => {
  process.env.SESION_SECRETO = SECRETO;
});

afterEach(() => {
  process.env = { ...ENTORNO };
  vi.unstubAllEnvs();
});

describe("contraseñas", () => {
  it("verifica la contraseña correcta y rechaza la incorrecta", async () => {
    const hash = await hashearPassword("una-clave-cualquiera");

    expect(await verificarPassword("una-clave-cualquiera", hash)).toBe(true);
    expect(await verificarPassword("otra-clave", hash)).toBe(false);
  });

  it("lee los hash heredados de Supabase, con prefijo 2a", async () => {
    // Las contraseñas que ya existían vienen de Supabase Auth en bcrypt `$2a$`.
    // Si esto fallara, las dieciséis personas tendrían que elegir una nueva.
    const heredado =
      "$2a$10$0Yh8u3QUu1jPH1tq205j0.LMHlrLo11bT4dp9Bcdlbf2xjn2/QZPG";

    expect(await verificarPassword("clave-de-prueba", heredado)).toBe(true);
    expect(await verificarPassword("otra", heredado)).toBe(false);
  });

  it("sin hash devuelve false, pero habiendo trabajado lo mismo", async () => {
    // El caso del usuario inexistente, y el de la cuenta de CiDiTuc que nunca
    // eligió contraseña. Si acá se saliera sin calcular nada, el tiempo de
    // respuesta delataría qué correos están registrados.
    const empezo = Date.now();
    const resultado = await verificarPassword("lo-que-sea", null);
    const tardo = Date.now() - empezo;

    expect(resultado).toBe(false);
    // Un bcrypt de costo 10 ronda los 50 ms. Con el umbral en 10 ms la prueba
    // no es sensible a la máquina, pero sí detecta que se devuelva de una.
    expect(tardo).toBeGreaterThan(10);
  });

  it("el mismo texto da hash distintos, porque lleva sal", async () => {
    const a = await hashearPassword("misma-clave");
    const b = await hashearPassword("misma-clave");

    expect(a).not.toBe(b);
    expect(await verificarPassword("misma-clave", a)).toBe(true);
    expect(await verificarPassword("misma-clave", b)).toBe(true);
  });
});

describe("token de sesión", () => {
  it("lo que se firma es lo que se lee", async () => {
    const token = await emitirToken("11111111-1111-1111-1111-111111111111", "ADMIN");
    const credencial = await leerToken(token);

    expect(credencial?.usuarioId).toBe("11111111-1111-1111-1111-111111111111");
    expect(credencial?.rol).toBe("ADMIN");
  });

  it("devuelve null si no hay token", async () => {
    expect(await leerToken(undefined)).toBeNull();
    expect(await leerToken(null)).toBeNull();
    expect(await leerToken("")).toBeNull();
  });

  it("rechaza un token manipulado", async () => {
    const token = await emitirToken("11111111-1111-1111-1111-111111111111", "VENDEDOR");
    // Cambiarle un carácter al payload invalida la firma.
    const [cabecera, cuerpo, firma] = token.split(".");
    const alterado = `${cabecera}.${cuerpo?.slice(0, -2)}XX.${firma}`;

    expect(await leerToken(alterado)).toBeNull();
  });

  it("rechaza un token firmado con otro secreto", async () => {
    const token = await emitirToken("11111111-1111-1111-1111-111111111111", "ADMIN");

    process.env.SESION_SECRETO = "otro-secreto-igual-de-largo-pero-distinto";
    expect(await leerToken(token)).toBeNull();
  });

  it("rechaza un token vencido", async () => {
    const vencido = await new SignJWT({ rol: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("11111111-1111-1111-1111-111111111111")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 10_000)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRETO));

    expect(await leerToken(vencido)).toBeNull();
  });

  it("rechaza un rol que no existe, aunque la firma sea nuestra", async () => {
    // Un rol inventado no debería circular por las comparaciones del middleware
    // ni aunque el token esté bien firmado.
    const raro = await new SignJWT({ rol: "SUPERADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("11111111-1111-1111-1111-111111111111")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRETO));

    expect(await leerToken(raro)).toBeNull();
  });

  it("rechaza un token sin sujeto", async () => {
    const sinSujeto = await new SignJWT({ rol: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRETO));

    expect(await leerToken(sinSujeto)).toBeNull();
  });

  it("rechaza un token sin firma (alg none)", async () => {
    const cabecera = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const cuerpo = Buffer.from(
      JSON.stringify({
        sub: "11111111-1111-1111-1111-111111111111",
        rol: "ADMIN",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");

    expect(await leerToken(`${cabecera}.${cuerpo}.`)).toBeNull();
  });

  it("no firma nada sin SESION_SECRETO", async () => {
    delete process.env.SESION_SECRETO;

    await expect(
      emitirToken("11111111-1111-1111-1111-111111111111", "ADMIN"),
    ).rejects.toThrow(/SESION_SECRETO/);
  });

  it("no acepta un secreto corto", async () => {
    process.env.SESION_SECRETO = "corto";

    await expect(
      emitirToken("11111111-1111-1111-1111-111111111111", "ADMIN"),
    ).rejects.toThrow(/32/);
  });
});

describe("renovación deslizante", () => {
  const credencial = {
    usuarioId: "11111111-1111-1111-1111-111111111111",
    rol: "ADMIN" as const,
    emitidoEn: new Date("2026-10-29T10:00:00Z"),
  };

  it("no renueva un token recién emitido", () => {
    expect(convieneRenovar(credencial, new Date("2026-10-29T11:00:00Z"))).toBe(false);
  });

  it("renueva pasada la mitad de la vida", () => {
    // Tres días de vida: a las 37 horas ya pasó la mitad.
    expect(convieneRenovar(credencial, new Date("2026-10-30T23:00:00Z"))).toBe(true);
  });
});

describe("cookie de sesión", () => {
  it("no la puede leer el JavaScript de la pagina", () => {
    // Sin httpOnly, un XSS en cualquier rincón del sitio se lleva la sesión.
    expect(opcionesCookie().httpOnly).toBe(true);
  });

  it("no viaja en peticiones que origina otro sitio", () => {
    // "lax" y no "strict": el regreso desde CiDiTuc es una navegación desde
    // otro dominio, y con "strict" la persona aterrizaría deslogueada.
    expect(opcionesCookie().sameSite).toBe("lax");
  });

  it("exige HTTPS en produccion y no en desarrollo", () => {
    // NODE_ENV viene declarado de solo lectura en los tipos de Next.
    vi.stubEnv("NODE_ENV", "production");
    expect(opcionesCookie().secure).toBe(true);

    vi.stubEnv("NODE_ENV", "development");
    expect(opcionesCookie().secure).toBe(false);
  });

  it("dura lo mismo que el token", () => {
    expect(opcionesCookie().maxAge).toBe(DURACION_SEGUNDOS);
  });

  it("se borra con los mismos atributos, o no se borra", () => {
    // El navegador identifica una cookie por nombre, dominio y camino. Borrarla
    // con otro `path` deja viva la original y "cerrar sesión" no cierra nada.
    const puesta = opcionesCookie();
    const borrada = opcionesParaBorrar();

    expect(borrada.path).toBe(puesta.path);
    expect(borrada.secure).toBe(puesta.secure);
    expect(borrada.sameSite).toBe(puesta.sameSite);
    expect(borrada.maxAge).toBe(0);
  });

  it("tiene un nombre propio y no el de Supabase", () => {
    expect(NOMBRE_COOKIE).toBe("feria_sesion");
  });
});
