import { redirect } from "next/navigation";

/**
 * «Mi vidriera» ya no existe como pantalla: la vidriera se edita sobre el stand
 * mismo, en «Mi stand», con un lápiz en cada parte. Queda la dirección para que
 * no se rompa un enlace guardado.
 */
export default function PaginaPerfil() {
  redirect("/mi-stand");
}
