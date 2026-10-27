import { describe, expect, it } from "vitest";

import { productoSchema } from "@/lib/validations/producto";

/**
 * Lo que el formulario manda de verdad, con el marketplace apagado.
 *
 * `PERMITIR_PRECIOS` en `false` hace que `FormularioProducto` ni dibuje los
 * campos de precio y stock, así que esas claves **no existen** en el `FormData`.
 * Es el caso normal hoy, no un borde.
 */
const SIN_MARKETPLACE = {
  productoId: "abc123",
  nombre: "Poncho de lana de oveja",
  descripcion: "Tejido en telar criollo",
  disponible: "on",
  imagenesActuales: "productos/vendedores/x/y.webp",
};

describe("productoSchema", () => {
  it("acepta un producto sin precio ni stock en el formulario", () => {
    // Durante un tiempo esto falló y el feriante veía «Revisá los datos
    // ingresados» sin ningún campo marcado en rojo: el error era de un campo
    // que no estaba en pantalla.
    const resultado = productoSchema.safeParse(SIN_MARKETPLACE);

    expect(resultado.success).toBe(true);
  });

  it("deja precio y stock sin tocar cuando el formulario no los manda", () => {
    const resultado = productoSchema.parse(SIN_MARKETPLACE);

    // `undefined` y no `null`: con el marketplace apagado el formulario no
    // opina sobre el precio, así que guardar no tiene que borrar el que ya
    // tenga cargado una ficha importada. `null` significaría «sacáselo».
    expect(resultado.precio).toBeUndefined();
    expect(resultado.stock).toBeUndefined();
  });

  it("entiende el campo vacío como «sin precio»", () => {
    const resultado = productoSchema.parse({
      ...SIN_MARKETPLACE,
      precio: "",
      stock: "",
    });

    expect(resultado.precio).toBeNull();
    expect(resultado.stock).toBeNull();
  });

  it("acepta la coma como separador decimal", () => {
    const resultado = productoSchema.parse({
      ...SIN_MARKETPLACE,
      precio: "12500,50",
    });

    expect(resultado.precio).toBe(12500.5);
  });

  it("rechaza un precio que no es un número", () => {
    const resultado = productoSchema.safeParse({
      ...SIN_MARKETPLACE,
      precio: "a convenir",
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.flatten().fieldErrors.precio).toBeDefined();
    }
  });

  it("toma como no marcada una casilla que el navegador no manda", () => {
    const resultado = productoSchema.parse(SIN_MARKETPLACE);

    expect(resultado.disponible).toBe(true);
    expect(resultado.destacado).toBe(false);
  });

  it("parte la lista de imágenes y descarta los vacíos", () => {
    const resultado = productoSchema.parse({
      ...SIN_MARKETPLACE,
      imagenesActuales: "uno.webp, dos.webp,,tres.webp",
    });

    expect(resultado.imagenesActuales).toEqual([
      "uno.webp",
      "dos.webp",
      "tres.webp",
    ]);
  });
});
