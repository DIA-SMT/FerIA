import { describe, expect, it } from "vitest";

import {
  hayUnidades,
  mensajePedido,
  sePuedePedir,
  subtotalLinea,
  totalPedido,
  unidadesPedido,
} from "@/lib/pedidos";

describe("subtotalLinea", () => {
  it("multiplica en centavos, no en pesos", () => {
    // 12500.5 * 2 en pesos da 25001.000000000004 en algunos motores.
    expect(subtotalLinea({ precioUnitario: 12500.5, cantidad: 2 })).toBe(25001);
    expect(subtotalLinea({ precioUnitario: 4166.7, cantidad: 3 })).toBe(
      12500.1,
    );
  });

  it("una linea sin precio no suma nada", () => {
    expect(subtotalLinea({ precioUnitario: null, cantidad: 5 })).toBe(0);
  });
});

describe("totalPedido", () => {
  it("suma las lineas sin arrastrar centavos", () => {
    expect(
      totalPedido([
        { precioUnitario: 12500.5, cantidad: 2 },
        { precioUnitario: 28000, cantidad: 1 },
      ]),
    ).toBe(53001);
  });

  it("un pedido vacio vale cero", () => {
    expect(totalPedido([])).toBe(0);
  });

  it("coincide con la suma de sus subtotales", () => {
    const lineas = [
      { precioUnitario: 4166.7, cantidad: 3 },
      { precioUnitario: 1234.56, cantidad: 7 },
      { precioUnitario: "999.99", cantidad: 11 },
    ];
    // Es la propiedad que justifica no guardar el total en la base: el total y
    // el detalle no pueden contradecirse porque salen del mismo lugar.
    const porLinea = lineas.reduce(
      (suma, linea) => suma + Math.round(subtotalLinea(linea) * 100),
      0,
    );
    expect(Math.round(totalPedido(lineas) * 100)).toBe(porLinea);
  });
});

describe("unidadesPedido", () => {
  it("cuenta unidades y no lineas", () => {
    expect(
      unidadesPedido([
        { precioUnitario: 10, cantidad: 2 },
        { precioUnitario: 10, cantidad: 3 },
      ]),
    ).toBe(5);
  });
});

describe("hayUnidades", () => {
  it("sin control de stock siempre queda mercaderia", () => {
    expect(hayUnidades({ disponible: true, stock: null })).toBe(true);
  });

  it("stock 0 es «no me queda», que no es lo mismo que no llevar la cuenta", () => {
    expect(hayUnidades({ disponible: true, stock: 0 })).toBe(false);
  });

  it("el interruptor del feriante manda sobre el stock", () => {
    expect(hayUnidades({ disponible: false, stock: 10 })).toBe(false);
  });
});

describe("sePuedePedir", () => {
  it("sin precio no se puede pedir, aunque haya stock", () => {
    // Es el caso del padron importado: entra entero sin precios.
    expect(sePuedePedir({ disponible: true, stock: null, precio: null })).toBe(
      false,
    );
  });

  it("precio 0 tampoco: seria regalarlo", () => {
    expect(sePuedePedir({ disponible: true, stock: null, precio: 0 })).toBe(
      false,
    );
  });

  it("con precio y mercaderia, si", () => {
    expect(sePuedePedir({ disponible: true, stock: 3, precio: 1500 })).toBe(
      true,
    );
  });

  it("agotado no se pide aunque tenga precio", () => {
    expect(sePuedePedir({ disponible: true, stock: 0, precio: 1500 })).toBe(
      false,
    );
  });
});

describe("mensajePedido", () => {
  const lineas = [
    { nombre: "Jarro de ceramica", precioUnitario: 12500.5, cantidad: 2 },
    { nombre: "Fuente de barro", precioUnitario: 28000, cantidad: 1 },
  ];

  it("lleva el numero de pedido para que los dos miren lo mismo", () => {
    expect(mensajePedido(42, "Alfareria La Cienaga", lineas)).toContain("#42");
  });

  it("detalla cada linea con su subtotal y cierra con el total", () => {
    const mensaje = mensajePedido(42, "Alfareria La Cienaga", lineas);
    expect(mensaje).toContain("2 x Jarro de ceramica");
    expect(mensaje).toContain("1 x Fuente de barro");
    expect(mensaje).toMatch(/Total: .*53\.001/);
  });

  it("no promete nada sobre como se paga", () => {
    // El municipio no cobra: el mensaje no puede sugerir lo contrario.
    const mensaje = mensajePedido(1, "X", lineas).toLowerCase();
    for (const palabra of ["pagar ahora", "abonar", "tarjeta", "mercadopago"]) {
      expect(mensaje).not.toContain(palabra);
    }
  });
});
