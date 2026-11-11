import { describe, expect, it } from "vitest";

import { leerPadron } from "./feria-digital";
import { armarFichas, valor, type TablasRefercom } from "./refercom";

/**
 * El armado de fichas desde la base del municipio.
 *
 * Lo que puede salir mal acá no da error: una ficha con el teléfono de otra
 * persona, o con los productos de todo su rubro, se importa igual y aparece
 * mal después. Por eso se prueban los cruces, que es donde estaba el bug de la
 * vista que ellos mismos usan.
 */

/** Una base mínima: dos personas, tres emprendimientos, catálogos chicos. */
function tablas(cambios: Partial<TablasRefercom> = {}): TablasRefercom {
  return {
    personas: [
      {
        id_emprendedor: 1,
        dni: 30111222,
        apellido: "Pérez",
        nombre: "Ana",
        telefono: "381 5123456",
        domicilio: "Calle 1",
        email: "ana@example.com",
        instagram: "@ana",
        facebook: null,
      },
      {
        id_emprendedor: 2,
        dni: 0,
        apellido: " Gómez ",
        nombre: "Luis",
        telefono: "0",
        domicilio: "",
        email: null,
        instagram: null,
        facebook: null,
      },
    ],
    emprendimientos: [
      { id_emprendimiento: 10, id_emprendedor: 1, id_feria: 3, nombre_empre: "Dulces Ana" },
      { id_emprendimiento: 11, id_emprendedor: 1, id_feria: 4, nombre_empre: "Tejidos Ana" },
      { id_emprendimiento: 12, id_emprendedor: 2, id_feria: 3, nombre_empre: "Mates Luis" },
    ],
    rubrosDeEmprendimiento: [
      { id_emprendimiento: 10, id_rubro: 5 },
      { id_emprendimiento: 11, id_rubro: 29 },
      { id_emprendimiento: 12, id_rubro: 69 },
    ],
    rubros: [
      { id_rubro: 5, rubro: "PASTELERÍA / REPOSTERÍA / PANIFICACÍON " },
      { id_rubro: 29, rubro: "ARTESANIA EN TEJIDO" },
      { id_rubro: 69, rubro: "MATES Y ACCESORIOS" },
    ],
    ferias: [
      { id_feria: 3, feria: "GOURMET" },
      { id_feria: 4, feria: "CENTENARIO" },
    ],
    productosDeEmprendimiento: [
      { id_emprendimiento: 10, id_producto: 100 },
      { id_emprendimiento: 10, id_producto: 101 },
    ],
    productos: [
      { id_producto: 100, producto: "Alfajores" },
      { id_producto: 101, producto: "Tortas" },
      // Del mismo rubro, pero Ana no lo vende: no tiene que aparecer en su
      // ficha. Es exactamente lo que hace mal la vista `emprendimientos`.
      { id_producto: 102, producto: "Pan dulce" },
    ],
    ...cambios,
  };
}

describe("valor", () => {
  it("recorta y descarta lo vacío", () => {
    expect(valor("  Ana ")).toBe("Ana");
    expect(valor("   ")).toBeNull();
    expect(valor(null)).toBeNull();
    expect(valor(undefined)).toBeNull();
  });

  it("toma el 0 como vacío, que es como esa base marca lo que no se cargó", () => {
    expect(valor(0)).toBeNull();
    expect(valor("0")).toBeNull();
  });

  it("convierte los números a texto, que es como llega el DNI", () => {
    expect(valor(30111222)).toBe("30111222");
  });
});

describe("armarFichas", () => {
  it("arma una ficha por emprendimiento, aunque sean de la misma persona", () => {
    const fichas = armarFichas(tablas());
    expect(fichas.map((f) => f.id)).toEqual(["10", "11", "12"]);
    expect(fichas.filter((f) => f.dni === "30111222")).toHaveLength(2);
  });

  it("le pone a cada ficha los datos de su propia persona", () => {
    const [dulces, , mates] = armarFichas(tablas());
    expect(dulces).toMatchObject({
      emprendimiento: "Dulces Ana",
      nombre: "Ana",
      apellido: "Pérez",
      telefono: "381 5123456",
      dni: "30111222",
    });
    expect(mates).toMatchObject({ apellido: "Gómez", nombre: "Luis" });
  });

  it("no inventa contacto: el teléfono y el DNI en 0 quedan vacíos", () => {
    const mates = armarFichas(tablas())[2]!;
    expect(mates.telefono).toBeNull();
    expect(mates.dni).toBeNull();
    expect(mates.domicilio).toBeNull();
  });

  it("trae sólo los productos que vende, no todos los de su rubro", () => {
    const [dulces, tejidos] = armarFichas(tablas());
    expect(dulces!.productos).toEqual(["Alfajores", "Tortas"]);
    expect(tejidos!.productos).toEqual([]);
  });

  it("traduce la feria y el rubro por nombre, para que los lea el importador", () => {
    const [dulces, tejidos] = armarFichas(tablas());
    expect(dulces).toMatchObject({ feria: "GOURMET", rubros: ["PASTELERÍA / REPOSTERÍA / PANIFICACÍON"] });
    expect(tejidos).toMatchObject({ feria: "CENTENARIO", rubros: ["ARTESANIA EN TEJIDO"] });
  });

  it("descarta un rubro o un producto que ya no existe en su catálogo", () => {
    const fichas = armarFichas(
      tablas({
        rubrosDeEmprendimiento: [{ id_emprendimiento: 10, id_rubro: 999 }],
        productosDeEmprendimiento: [{ id_emprendimiento: 10, id_producto: 999 }],
      }),
    );
    expect(fichas[0]!.rubros).toEqual([]);
    expect(fichas[0]!.productos).toEqual([]);
  });

  it("no repite un producto que aparece dos veces en el detalle", () => {
    const fichas = armarFichas(
      tablas({
        productosDeEmprendimiento: [
          { id_emprendimiento: 10, id_producto: 100 },
          { id_emprendimiento: 10, id_producto: 100 },
        ],
      }),
    );
    expect(fichas[0]!.productos).toEqual(["Alfajores"]);
  });

  it("deja salir sin contacto a un emprendimiento cuya persona no existe", () => {
    const fichas = armarFichas(
      tablas({
        emprendimientos: [
          { id_emprendimiento: 13, id_emprendedor: 77, id_feria: null, nombre_empre: "Huérfano" },
        ],
      }),
    );
    // Sale, y el importador lo omite por falta de WhatsApp y lo lista: mejor
    // eso que perderlo sin que nadie se entere.
    expect(fichas[0]).toMatchObject({ emprendimiento: "Huérfano", telefono: null, feria: null });
  });

  it("produce fichas que el importador lee sin tocar", () => {
    const leidas = leerPadron(armarFichas(tablas()));
    expect(leidas).toHaveLength(3);
    expect(leidas[0]!.id).toBe("10");
  });
});
