import { describe, expect, it } from "vitest";

import { redireccionRelativa } from "@/lib/redireccion";

describe("redireccionRelativa", () => {
  it("deja la Location relativa, sin dominio", () => {
    // Detrás de nginx, armarla contra `request.url` la mandaba a
    // localhost:3003. Relativa, la resuelve el navegador.
    const respuesta = redireccionRelativa("/encuesta");
    expect(respuesta.status).toBe(307);
    expect(respuesta.headers.get("location")).toBe("/encuesta");
  });

  it("conserva la query", () => {
    const respuesta = redireccionRelativa("/ingresar?error=cidituc-estado");
    expect(respuesta.headers.get("location")).toBe("/ingresar?error=cidituc-estado");
  });

  it("no acepta rutas que el navegador seguiría a otro dominio", () => {
    expect(() => redireccionRelativa("//otro.sitio/x")).toThrow();
    expect(() => redireccionRelativa("/\\otro.sitio")).toThrow();
    expect(() => redireccionRelativa("https://otro.sitio")).toThrow();
  });
});
