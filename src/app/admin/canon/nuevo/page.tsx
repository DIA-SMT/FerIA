import { registrarPago } from "@/actions/canon";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { FormularioPago } from "@/components/admin/formulario-pago";
import { Alerta } from "@/components/ui/alerta";
import { prisma } from "@/lib/db";
import { aNumero } from "@/lib/format";

export const metadata = { title: "Registrar pago de canon" };

export default async function PaginaNuevoPago({
  searchParams,
}: {
  searchParams: Promise<{ edicion?: string; vendedor?: string }>;
}) {
  const params = await searchParams;

  const [ediciones, vendedores] = await Promise.all([
    prisma.edicionFeria.findMany({
      orderBy: { fechaInicio: "desc" },
      select: {
        id: true,
        nombre: true,
        montoCanon: true,
        feria: { select: { nombre: true } },
      },
    }),
    prisma.vendedor.findMany({
      where: { estado: "APROBADO" },
      orderBy: { emprendimiento: "asc" },
      select: { id: true, emprendimiento: true },
    }),
  ]);

  const opcionesEdicion = ediciones.map((edicion) => ({
    id: edicion.id,
    etiqueta: edicion.nombre
      ? `${edicion.feria.nombre} — ${edicion.nombre}`
      : edicion.feria.nombre,
    montoCanon: aNumero(edicion.montoCanon),
  }));

  const opcionesVendedor = vendedores.map((vendedor) => ({
    id: vendedor.id,
    etiqueta: vendedor.emprendimiento,
  }));

  const sinDatos = ediciones.length === 0 || vendedores.length === 0;

  return (
    <div className="max-w-3xl">
      <EncabezadoPagina
        titulo="Registrar pago de canon"
        migas={[
          { href: "/admin/canon", texto: "Canon y permisos" },
          { texto: "Registrar pago" },
        ]}
      />

      {sinDatos ? (
        <Alerta tipo="advertencia" titulo="Faltan datos para registrar un pago">
          {ediciones.length === 0
            ? "Todavía no hay ediciones cargadas. Creá una edición de feria primero."
            : "Todavía no hay feriantes aprobados. Aprobá al menos una solicitud."}
        </Alerta>
      ) : (
        <FormularioPago
          accion={registrarPago}
          ediciones={opcionesEdicion}
          vendedores={opcionesVendedor}
          inicial={{
            edicionId: params.edicion,
            vendedorId: params.vendedor,
          }}
        />
      )}
    </div>
  );
}
