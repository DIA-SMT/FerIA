import type { ReactNode } from "react";

/**
 * El marco de las pantallas de cuenta que no son el ingreso: centrado, con aire
 * arriba y lugar abajo para la burbuja de Migue —sin eso, al final de la página
 * tapa el botón de enviar de la encuesta—.
 *
 * Vivía en el `<main>` del layout. Se mudó acá cuando el ingreso pasó a ser una
 * escena de borde a borde (ver `EscenaIngreso`), que no puede tener márgenes
 * alrededor.
 */
export function MarcoAuth({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-start justify-center px-4 pt-10 pb-24 sm:pt-16">
      {children}
    </div>
  );
}
