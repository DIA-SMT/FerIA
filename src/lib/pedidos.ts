import { aCentavos } from "@/lib/dinero";
import { formatearMoneda, type ValorDecimal } from "@/lib/format";

/**
 * Totales de un pedido.
 *
 * El total no se guarda en la base a propósito. Un total almacenado al lado de
 * las líneas que lo componen son dos números que pueden contradecirse, y con
 * el canon ya pasó: el tablero y la pantalla de canon mostraban cifras
 * distintas porque cada uno sumaba por su cuenta. Acá hay un solo lugar donde
 * se suma, y las líneas guardan el precio congelado al momento de pedir.
 */

/** Una línea de pedido, tal como se guarda o como viene del carrito. */
export interface LineaPedido {
  precioUnitario: ValorDecimal | null | undefined;
  cantidad: number;
}

/**
 * Subtotal de una línea, en pesos.
 *
 * La multiplicación va en centavos enteros: `cantidad` es un entero, así que
 * centavos × cantidad es exacto y no hay nada que redondear.
 */
export function subtotalLinea(linea: LineaPedido): number {
  return (aCentavos(linea.precioUnitario) * linea.cantidad) / 100;
}

/** Total del pedido, en pesos. */
export function totalPedido(lineas: readonly LineaPedido[]): number {
  const centavos = lineas.reduce(
    (suma, linea) => suma + aCentavos(linea.precioUnitario) * linea.cantidad,
    0,
  );
  return centavos / 100;
}

/** Cuántas unidades tiene el pedido en total. */
export function unidadesPedido(lineas: readonly LineaPedido[]): number {
  return lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
}

// ---------------------------------------------------------------------------
// Qué se puede pedir
// ---------------------------------------------------------------------------

/**
 * Si queda mercadería.
 *
 * `disponible` es el interruptor manual del feriante y `stock` el conteo. Son
 * dos cosas distintas y las dos mandan: `stock = null` significa que no lleva
 * control —lo normal en artesanía y en lo que se hace a pedido—, así que la
 * ausencia de número no es ausencia de mercadería. Lo que sí la es, es un 0.
 */
export function hayUnidades(producto: {
  disponible: boolean;
  stock: number | null;
}): boolean {
  return producto.disponible && producto.stock !== 0;
}

/**
 * Si el producto se puede poner en el carrito.
 *
 * Suma la condición del precio: sin precio no hay nada que sumar en un total.
 * Un producto sin precio no desaparece de la vidriera —se muestra y se
 * consulta por WhatsApp, como se hizo siempre—, sólo que no se pide desde acá.
 * Eso importa porque el padrón importado llega entero sin precios.
 */
export function sePuedePedir(producto: {
  disponible: boolean;
  stock: number | null;
  precio: number | null;
}): boolean {
  return (
    hayUnidades(producto) && producto.precio !== null && producto.precio > 0
  );
}

// ---------------------------------------------------------------------------
// El traspaso al feriante
// ---------------------------------------------------------------------------

/**
 * El mensaje con el que el vecino le escribe al feriante.
 *
 * Es la pieza donde la plataforma se corre: hasta acá el municipio publicó el
 * catálogo y armó el pedido; de acá en adelante hablan ellos dos y el pago se
 * arregla por fuera. Por eso el mensaje lleva el número de pedido —para que
 * los dos miren lo mismo— y el detalle completo, y no lleva ninguna promesa
 * sobre cómo se paga.
 */
export function mensajePedido(
  numero: number,
  emprendimiento: string,
  lineas: ReadonlyArray<{ nombre: string; cantidad: number } & LineaPedido>,
): string {
  const detalle = lineas
    .map(
      (linea) =>
        `• ${linea.cantidad} x ${linea.nombre} — ${formatearMoneda(
          subtotalLinea(linea),
        )}`,
    )
    .join("\n");

  return [
    `¡Hola ${emprendimiento}! Te hago el pedido #${numero} desde las Ferias Municipales de San Miguel de Tucumán.`,
    "",
    detalle,
    "",
    `Total: ${formatearMoneda(totalPedido(lineas))}`,
    "",
    "¿Cómo seguimos con el pago y la entrega?",
  ].join("\n");
}
