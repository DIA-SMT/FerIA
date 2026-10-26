import type { ReactNode } from "react";

import { ProveedorCarrito } from "@/components/carrito/estado-carrito";
import { AsistenteBurbuja } from "@/components/public/asistente-burbuja";
import { EncabezadoPublico } from "@/components/public/encabezado-publico";
import { ProveedorAsistente } from "@/components/public/estado-asistente";
import { PiePublico } from "@/components/public/pie-publico";
import { hayIAConfigurada } from "@/lib/ai";
import { hayPedidos } from "@/lib/marketplace";

export default function LayoutPublico({ children }: { children: ReactNode }) {
  // Con los pedidos apagados el proveedor no se monta: el estado del carrito,
  // su lectura de localStorage y el indicador del encabezado no llegan al
  // navegador. Apagar el flag deja el sitio exactamente como estaba.
  const contenido = (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-municipal-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Saltar al contenido
      </a>

      <EncabezadoPublico />

      <main id="contenido" className="flex-1">
        {children}
      </main>

      <PiePublico />

      {/* Sin OPENROUTER_API_KEY la burbuja se montaba igual en todas las
          páginas públicas y le contestaba un error genérico a cada vecino que
          la abría. Esto es un Server Component, así que la decisión se toma
          acá y el componente del asistente ni siquiera llega al navegador. */}
      {hayIAConfigurada() && <AsistenteBurbuja />}
    </div>
  );

  // El proveedor del asistente envuelve TODO el layout y no sólo la burbuja:
  // el buscador de la portada también lo consume, para mandarle la consulta
  // directo. Sin IA configurada no se monta, y ahí `useAsistente()` devuelve
  // `null` y el buscador vuelve a ser un formulario común.
  const conAsistente = hayIAConfigurada() ? (
    <ProveedorAsistente>{contenido}</ProveedorAsistente>
  ) : (
    contenido
  );

  if (!hayPedidos()) return conAsistente;

  return <ProveedorCarrito>{conAsistente}</ProveedorCarrito>;
}
