import { crearFeria } from "@/actions/ferias";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { FormularioFeria } from "@/components/admin/formulario-feria";

export const metadata = { title: "Nueva feria" };

export default function PaginaNuevaFeria() {
  return (
    <div className="max-w-3xl">
      <EncabezadoPagina
        titulo="Nueva feria"
        descripcion="Cargá los datos generales. Las fechas se definen después, en cada edición."
        migas={[
          { href: "/admin/ferias", texto: "Ferias" },
          { texto: "Nueva" },
        ]}
      />
      <FormularioFeria accion={crearFeria} />
    </div>
  );
}
