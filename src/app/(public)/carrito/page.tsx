import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ListaCarritos } from "@/components/carrito/lista-carritos";
import { Alerta } from "@/components/ui/alerta";
import { hayPedidos } from "@/lib/marketplace";

export const metadata: Metadata = {
  title: "Mi pedido",
  // Un carrito no tiene nada que hacer en un buscador: lo que muestra es
  // distinto para cada visitante y no existe sin su navegador.
  robots: { index: false, follow: false },
};

export default function PaginaCarrito() {
  // Con los pedidos apagados la ruta no existe, en vez de mostrar un carrito
  // vacío que nunca se va a poder confirmar.
  if (!hayPedidos()) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Mi pedido
        </h1>
        <p className="mt-2 text-slate-600">
          Armá tu pedido y mandáselo directamente a cada feriante. Si pediste a
          más de un stand, cada uno es un pedido aparte.
        </p>
      </header>

      <Alerta tipo="info" className="mt-6">
        El pago y la entrega los arreglás directamente con quien produce. La
        Municipalidad no cobra, no retiene el dinero ni interviene en la
        operación.
      </Alerta>

      <ListaCarritos />
    </div>
  );
}
