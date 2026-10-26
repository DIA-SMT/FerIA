import { describe, expect, it } from "vitest";

import {
  mismoEstado,
  nuevoEstado,
  personaDeRespuesta,
  urlDeIngreso,
} from "@/lib/cidituc";

describe("urlDeIngreso", () => {
  const url = urlDeIngreso("abc123");

  it("pone el state DENTRO del fragmento, al lado de next", () => {
    // El Derivador usa HashRouter y lee la query del hash, no la de la URL.
    // Puesto afuera, la vuelta falla siempre con «estado» y no hay forma de
    // darse cuenta mirando el código de acá.
    expect(url).toContain("/#/login?");
    expect(url.split("#")[1]).toContain("state=abc123");
    expect(url.split("#")[1]).toContain("next=");
  });

  it("no deja nada en la query de la URL", () => {
    const sinFragmento = url.split("#")[0] ?? "";
    expect(sinFragmento).not.toContain("?");
  });
});

describe("nuevoEstado", () => {
  it("devuelve 32 caracteres hexadecimales", () => {
    expect(nuevoEstado()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("no se repite", () => {
    const muchos = new Set(Array.from({ length: 200 }, () => nuevoEstado()));
    expect(muchos.size).toBe(200);
  });
});

describe("mismoEstado", () => {
  it("acepta dos iguales", () => {
    expect(mismoEstado("abc123", "abc123")).toBe(true);
  });

  it("rechaza distintos", () => {
    expect(mismoEstado("abc123", "abc124")).toBe(false);
  });

  it("rechaza cuando falta alguno", () => {
    expect(mismoEstado(undefined, "abc")).toBe(false);
    expect(mismoEstado("abc", null)).toBe(false);
    expect(mismoEstado("", "")).toBe(false);
  });

  it("no revienta con largos distintos ni con tildes", () => {
    // `timingSafeEqual` tira si los buffers miden distinto, y «é» mide 1
    // caracter pero 2 bytes: medir en caracteres devolvía un 500 en vez de un
    // rechazo limpio. El valor de la vuelta lo escribe cualquiera.
    expect(mismoEstado("abc", "abcdef")).toBe(false);
    expect(() => mismoEstado("ab", "é")).not.toThrow();
    expect(mismoEstado("ab", "é")).toBe(false);
  });
});

describe("personaDeRespuesta", () => {
  const perfil = {
    usuarioSinContraseña: {
      id_persona: 1234,
      documento_persona: "20123456",
      nombre_persona: "Ana",
      apellido_persona: "Lopez",
      email_persona: "Ana.Lopez@Example.com",
      telefono_persona: "3815123456",
      nombre_barrio: "Centro",
    },
  };

  it("lee el perfil de authStatus", () => {
    expect(personaDeRespuesta(perfil)).toEqual({
      id: "1234",
      documento: "20123456",
      nombre: "Ana Lopez",
      email: "ana.lopez@example.com",
    });
  });

  it("acepta el documento como numero", () => {
    // El backend hace SELECT p.* sobre MySQL: exigir string descartaba
    // documentos perfectamente validos.
    const persona = personaDeRespuesta({
      usuarioSinContraseña: { documento_persona: 20123456 },
    });
    expect(persona?.documento).toBe("20123456");
  });

  it("limpia puntos y espacios del documento", () => {
    const persona = personaDeRespuesta({
      usuarioSinContraseña: { documento_persona: "20.123.456" },
    });
    expect(persona?.documento).toBe("20123456");
  });

  it("tambien entiende la forma de authStatusIA, con user", () => {
    const persona = personaDeRespuesta({
      user: { documento_persona: "20123456", nombre_persona: "Ana" },
    });
    expect(persona?.documento).toBe("20123456");
  });

  it("rechaza un perfil sin documento usable", () => {
    expect(personaDeRespuesta({ usuarioSinContraseña: {} })).toBeNull();
    expect(
      personaDeRespuesta({ usuarioSinContraseña: { documento_persona: "" } }),
    ).toBeNull();
    expect(
      personaDeRespuesta({
        usuarioSinContraseña: { documento_persona: "abc" },
      }),
    ).toBeNull();
    expect(
      personaDeRespuesta({
        usuarioSinContraseña: { documento_persona: "123" },
      }),
    ).toBeNull();
  });

  it("rechaza cualquier cosa que no sea un objeto", () => {
    expect(personaDeRespuesta(null)).toBeNull();
    expect(personaDeRespuesta("hola")).toBeNull();
    expect(personaDeRespuesta(undefined)).toBeNull();
  });

  it("no se trae nada que no vaya a usar", () => {
    // Del perfil llegan tambien permisos sobre otros sistemas, telefono y
    // barrio: lo que no se guarda no se puede filtrar.
    const persona = personaDeRespuesta(perfil);
    expect(Object.keys(persona ?? {}).sort()).toEqual([
      "documento",
      "email",
      "id",
      "nombre",
    ]);
  });

  it("tolera que falten el nombre y el correo", () => {
    const persona = personaDeRespuesta({
      usuarioSinContraseña: { documento_persona: "20123456" },
    });
    expect(persona).toEqual({
      id: null,
      documento: "20123456",
      nombre: null,
      email: null,
    });
  });
});
