import { redirect } from "next/navigation";

/**
 * El catálogo del feriante ya no tiene pantalla propia: está dentro de «Mi
 * stand», donde se ve como lo ve el vecino, con la tarjeta de agregar primero.
 * Queda la dirección para que no se rompa un enlace guardado.
 */
export default function PaginaProductos() {
  redirect("/mi-stand#catalogo");
}
