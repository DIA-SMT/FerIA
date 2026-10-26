import { Rubro } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  clave,
  leerPadron,
  listaDeTextos,
  texto,
  traducirFeria,
  traducirRubro,
} from "./feria-digital";

/**
 * El padrón de Mi Feria Digital son cientos de fichas cargadas a mano durante
 * años. Lo que se prueba acá es la traducción: si se equivoca, el error no se
 * ve en la importación —termina bien y dice que importó todo— sino después, en
 * la vidriera, con gente en el rubro equivocado o sin aparecer.
 */

describe("leerPadron", () => {
  it("lee un arreglo pelado", () => {
    const fichas = leerPadron([{ id: "1", nombre_emprendimiento: "A" }]);
    expect(fichas).toHaveLength(1);
    expect(fichas[0]?.id).toBe("1");
  });

  it("lee { emprendedores: [...] }", () => {
    const fichas = leerPadron({ emprendedores: [{ id: "1" }, { id: "2" }] });
    expect(fichas.map((f) => f.id)).toEqual(["1", "2"]);
  });

  it("lee la respuesta de la API REST de Firestore", () => {
    // Los valores vienen envueltos en su tipo y el id es el ultimo segmento
    // de `name`. Se soporta porque no sabemos como nos van a pasar el export.
    const fichas = leerPadron({
      documents: [
        {
          name: "projects/x/databases/(default)/documents/emprendedores/10216233",
          fields: {
            nombre_emprendimiento: { stringValue: "F y M" },
            rubros: {
              arrayValue: { values: [{ stringValue: "AROMAS Y ESENCIAS" }] },
            },
            dni: { integerValue: "40216233" },
            activo: { booleanValue: true },
            domicilio: { nullValue: null },
          },
        },
      ],
    });

    expect(fichas[0]?.id).toBe("10216233");
    expect(fichas[0]?.nombre_emprendimiento).toBe("F y M");
    expect(fichas[0]?.rubros).toEqual(["AROMAS Y ESENCIAS"]);
    expect(fichas[0]?.dni).toBe(40216233);
    expect(fichas[0]?.activo).toBe(true);
    expect(fichas[0]?.domicilio).toBeNull();
  });

  it("lee un objeto indexado por id", () => {
    const fichas = leerPadron({
      "10216233": { nombre_emprendimiento: "F y M" },
      "10791761": { nombre_emprendimiento: "La Cabaña" },
    });
    expect(fichas.map((f) => f.id).sort()).toEqual(["10216233", "10791761"]);
  });

  it("usa `ident` cuando no hay `id`", () => {
    expect(leerPadron([{ ident: "99" }])[0]?.id).toBe("99");
  });

  it("avisa en vez de importar basura si el archivo no tiene forma", () => {
    expect(() => leerPadron("hola")).toThrow(/arreglo de fichas/);
    expect(() => leerPadron(42)).toThrow(/arreglo de fichas/);
    expect(() => leerPadron([1, 2])).toThrow(/fila 0/);
  });
});

describe("texto", () => {
  it("recorta y descarta lo vacio", () => {
    expect(texto("  hola  ")).toBe("hola");
    expect(texto("   ")).toBeNull();
    expect(texto("")).toBeNull();
  });

  it("acepta numeros, que es como llegan algunos campos", () => {
    expect(texto(40216233)).toBe("40216233");
    expect(texto(0)).toBe("0");
  });

  it("descarta lo que no sea texto ni numero", () => {
    expect(texto(null)).toBeNull();
    expect(texto({})).toBeNull();
    expect(texto(true)).toBeNull();
  });
});

describe("listaDeTextos", () => {
  it("acepta un arreglo", () => {
    expect(listaDeTextos(["a", "b"])).toEqual(["a", "b"]);
  });

  it("acepta un solo string", () => {
    expect(listaDeTextos("a")).toEqual(["a"]);
  });

  it("acepta objetos con nombre", () => {
    expect(listaDeTextos([{ nombre: "Aceites" }, { name: "Velas" }])).toEqual([
      "Aceites",
      "Velas",
    ]);
  });

  it("saltea los vacios en vez de dejar huecos", () => {
    expect(listaDeTextos(["a", "", null, "  ", "b"])).toEqual(["a", "b"]);
  });
});

describe("clave", () => {
  it("saca tildes, sube a mayusculas y colapsa espacios", () => {
    expect(clave("Artesanía  en Madera")).toBe("ARTESANIA EN MADERA");
    expect(clave("Vº Centenario")).toBe("V CENTENARIO");
  });
});

describe("traducirRubro", () => {
  it.each([
    ["GASTRONOMÍA", Rubro.GASTRONOMIA],
    ["MARROQUINERÍA", Rubro.MARROQUINERIA],
    ["PRODUCTOS REGIONALES", Rubro.PRODUCTOS_REGIONALES],
    ["INDUMENTARIA", Rubro.INDUMENTARIA],
    ["COSMÉTICOS Y MAQUILLAJE", Rubro.COSMETICA_NATURAL],
  ])("traduce %s con la tabla exacta", (entrada, esperado) => {
    const resultado = traducirRubro([entrada]);
    expect(resultado.rubro).toBe(esperado);
    expect(resultado.reconocido).toBe(true);
  });

  it.each([
    ["ARTESANÍA EN MADERA", Rubro.ARTESANIAS],
    ["ARTESANÍA EN CERÁMICA", Rubro.ARTESANIAS],
    ["RECICLADOS Y ARTESANÍAS", Rubro.ARTESANIAS],
  ])("cae en las reglas por palabra: %s", (entrada, esperado) => {
    // Ojo con el orden de las reglas: gana la primera que coincide.
    expect(traducirRubro([entrada]).rubro).toBe(esperado);
  });

  it.each([
    ["PASTELERÍA ARTESANAL", Rubro.GASTRONOMIA],
    ["CERVEZA ARTESANAL", Rubro.GASTRONOMIA],
    ["COSMÉTICA ARTESANAL", Rubro.COSMETICA_NATURAL],
    ["TEJIDOS ARTESANALES", Rubro.INDUMENTARIA],
  ])(
    "«artesanal» no se come la categoria concreta: %s",
    (entrada, esperado) => {
      // «Artesanal» es un adjetivo y califica cualquier cosa. Cuando estaba
      // junto al sustantivo «artesanía» y arriba de todo, se llevaba a
      // ARTESANIAS media feria gastronomica.
      expect(traducirRubro([entrada]).rubro).toBe(esperado);
    },
  );

  it("«artesanal» solo, sin categoria que lo reclame, si es artesania", () => {
    expect(traducirRubro(["PRODUCTO ARTESANAL"]).rubro).toBe(Rubro.ARTESANIAS);
  });

  it("manda a OTROS lo que no reconoce, y lo dice", () => {
    const resultado = traducirRubro(["SERVICIOS DE ASTROLOGÍA"]);
    expect(resultado.rubro).toBe(Rubro.OTROS);
    expect(resultado.reconocido).toBe(false);
    // El texto original se conserva para que el reporte lo liste y la
    // Dirección pueda revisarlo, en vez de que quede enterrado.
    expect(resultado.origen).toBe("SERVICIOS DE ASTROLOGÍA");
  });

  it("prueba todos los candidatos y no solo el primero", () => {
    const resultado = traducirRubro(["NO EXISTE", "GASTRONOMÍA"]);
    expect(resultado.rubro).toBe(Rubro.GASTRONOMIA);
  });

  it("sin rubro cae en OTROS sin romper", () => {
    expect(traducirRubro(undefined).rubro).toBe(Rubro.OTROS);
    expect(traducirRubro([]).origen).toBeNull();
  });

  it("acepta un rubro suelto y no solo un arreglo", () => {
    expect(traducirRubro("GASTRONOMÍA").rubro).toBe(Rubro.GASTRONOMIA);
  });
});

describe("traducirFeria", () => {
  it.each([
    ["Feria Emprendedores", "emprendedores"],
    ["Vº Centenario", "v-centenario"],
    ["V CENTENARIO", "v-centenario"],
    ["manantial sur", "manantial-sur"],
    ["Paseo Gastronómico", "gastronomico"],
    ["Feria Digital", "creadores-digitales"],
    ["Plaza Congresales", "plaza-congresales"],
  ])("traduce %s → %s", (entrada, esperado) => {
    expect(traducirFeria(entrada)).toBe(esperado);
  });

  it("deja pasar los slugs que ya son canonicos", () => {
    expect(traducirFeria("gourmet")).toBe("gourmet");
    expect(traducirFeria("artesanos")).toBe("artesanos");
  });

  it("guarda normalizada la que no conoce, en vez de perderla", () => {
    expect(traducirFeria("Feria Nueva Del Parque")).toBe(
      "feria-nueva-del-parque",
    );
  });

  it("sin feria devuelve null", () => {
    expect(traducirFeria(null)).toBeNull();
    expect(traducirFeria("  ")).toBeNull();
  });
});
