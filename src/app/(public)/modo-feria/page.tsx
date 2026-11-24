import { PortadaModoFeria } from "@/components/public/portada-modo-feria";
import { cantidadesPorTipo } from "@/lib/consultas-sello-propio";

export const metadata = {
  title: "Modo Feria — Regalos y servicios con sello propio",
  description:
    "Regalos y servicios con sello propio, hechos por feriantes de San Miguel de Tucumán, para empresas e instituciones. Elegí y escribile directo a quien lo hace.",
};

/** La entrada a Modo Feria, con sus dos opciones. */
export default async function PaginaModoFeria() {
  return <PortadaModoFeria cantidades={await cantidadesPorTipo()} />;
}
