import {
  buscarFeriantesElegibles,
  crearPropuestaSelloPropio,
} from "@/actions/sello-propio";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { FormularioPropuesta } from "@/components/admin/formulario-propuesta";

export const metadata = { title: "Nueva propuesta" };

export default function PaginaNuevaPropuesta() {
  return (
    <div className="max-w-3xl">
      <EncabezadoPagina
        titulo="Nueva propuesta"
        migas={[
          { href: "/admin/modo-feria", texto: "Modo Feria" },
          { texto: "Nueva" },
        ]}
      />
      <FormularioPropuesta
        accion={crearPropuestaSelloPropio}
        buscarFeriantes={buscarFeriantesElegibles}
        volver="/admin/modo-feria"
      />
    </div>
  );
}
