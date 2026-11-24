import { redirect } from "next/navigation";

/** «Modo Feria» son dos páginas; la dirección sola lleva a la primera. */
export default function PaginaModoFeria() {
  redirect("/modo-feria/regalos");
}
