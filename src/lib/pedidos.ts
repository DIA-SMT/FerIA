import { aCentavos } from "@/lib/dinero";
import type { ValorDecimal } from "@/lib/format";

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
