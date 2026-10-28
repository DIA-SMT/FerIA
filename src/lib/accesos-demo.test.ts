import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * El panel de accesos rápidos del login, que es el que más caro salió.
 *
 * El 23/10/2026 `ACCESOS_DEMO` quedó prendida en el deploy y durante semanas
 * cualquiera que abriera `/ingresar` se hacía ADMIN del panel municipal con un
 * click. La defensa que se escribió entonces dependía de `VERCEL_ENV`, así que
 * la mudanza a una VPS la habría apagado en silencio: ningún test fallaba, la
 * página seguía andando y la barrera dejaba de existir.
 *
 * Por eso estos tests. No prueban que el panel se vea bonito: prueban que **no
 * se vea** en cada forma en que no tiene que verse.
 *
 * El módulo lee las contraseñas al importarse, así que cada caso resetea los
 * módulos y lo importa de nuevo con el entorno ya armado. Importarlo una sola
 * vez arriba haría que todos los casos compartieran el primer entorno.
 */

const ENTORNO_ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ENTORNO_ORIGINAL };
  vi.resetModules();
});

/** Arma el entorno desde cero y devuelve las cuentas que ofrecería el panel. */
async function cuentasCon(entorno: Record<string, string | undefined>) {
  for (const clave of [
    "NODE_ENV",
    "VERCEL_ENV",
    "ACCESOS_DEMO",
    "DATABASE_URL",
    "BASE_DE_PRODUCCION",
    "PROYECTO_SUPABASE_PROD",
    "SEED_PASSWORD_ADMIN",
    "SEED_PASSWORD_FERIANTE",
  ]) {
    delete process.env[clave];
  }

  Object.assign(process.env, entorno);

  vi.resetModules();
  const { cuentasDemo } = await import("@/lib/accesos-demo");
  return cuentasDemo();
}

const CON_CLAVES = {
  SEED_PASSWORD_ADMIN: "una-clave-cualquiera",
  SEED_PASSWORD_FERIANTE: "otra-clave-cualquiera",
};

const BASE_PROD = "postgresql://user:pass@db.abcdefgh.supabase.co:5432/postgres";

describe("cuentasDemo", () => {
  it("muestra las cuatro cuentas en desarrollo", async () => {
    const cuentas = await cuentasCon({
      NODE_ENV: "development",
      ...CON_CLAVES,
    });

    expect(cuentas).toHaveLength(4);
    expect(cuentas.map((c) => c.etiqueta)).toContain("Municipal");
  });

  it("no muestra nada en un deploy que sirve la base de produccion", async () => {
    // El caso que importa, y el que la version anterior dejaba de cubrir fuera
    // de Vercel: `ACCESOS_DEMO` prendida por olvido en un servidor propio.
    const cuentas = await cuentasCon({
      NODE_ENV: "production",
      ACCESOS_DEMO: "true",
      DATABASE_URL: BASE_PROD,
      PROYECTO_SUPABASE_PROD: "abcdefgh",
      ...CON_CLAVES,
    });

    expect(cuentas).toEqual([]);
  });

  it("tampoco con el nombre nuevo de la marca, BASE_DE_PRODUCCION", async () => {
    const cuentas = await cuentasCon({
      NODE_ENV: "production",
      ACCESOS_DEMO: "true",
      DATABASE_URL: "postgresql://user:pass@10.0.0.5:5432/feria_produccion",
      BASE_DE_PRODUCCION: "feria_produccion",
      ...CON_CLAVES,
    });

    expect(cuentas).toEqual([]);
  });

  it("sigue respetando VERCEL_ENV mientras el sitio viva en Vercel", async () => {
    const cuentas = await cuentasCon({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      ACCESOS_DEMO: "true",
      ...CON_CLAVES,
    });

    expect(cuentas).toEqual([]);
  });

  it("se muestra en un deploy de prueba, que es para lo que existe el flag", async () => {
    const cuentas = await cuentasCon({
      NODE_ENV: "production",
      ACCESOS_DEMO: "true",
      DATABASE_URL: "postgresql://user:pass@db.pruebas.supabase.co:5432/postgres",
      PROYECTO_SUPABASE_PROD: "abcdefgh",
      ...CON_CLAVES,
    });

    expect(cuentas).toHaveLength(4);
  });

  it("no se muestra en un deploy sin ACCESOS_DEMO", async () => {
    const cuentas = await cuentasCon({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@db.pruebas.supabase.co:5432/postgres",
      ...CON_CLAVES,
    });

    expect(cuentas).toEqual([]);
  });

  it("no se muestra sin contraseñas, aunque este habilitado", async () => {
    const cuentas = await cuentasCon({
      NODE_ENV: "development",
    });

    expect(cuentas).toEqual([]);
  });

  it("se muestra en desarrollo aunque apunte a la base de produccion", async () => {
    // Es el caso real de hoy y es deliberado: quien corre el proyecto en su
    // maquina ya tiene la service role key en el .env, o sea acceso total a esa
    // base. El panel no le da nada que no tenga.
    const cuentas = await cuentasCon({
      NODE_ENV: "development",
      DATABASE_URL: BASE_PROD,
      PROYECTO_SUPABASE_PROD: "abcdefgh",
      ...CON_CLAVES,
    });

    expect(cuentas).toHaveLength(4);
  });
});
