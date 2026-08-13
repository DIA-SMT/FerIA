import { notFound } from "next/navigation";

import { actualizarPago } from "@/actions/canon";
import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { FormularioPago } from "@/components/admin/formulario-pago";
import { prisma } from "@/lib/db";
import { aNumero, aValorInputFecha } from "@/lib/format";

export const metadata = { title: "Editar pago de canon" };

export default async function PaginaEditarPago({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [pago, ediciones, vendedores] = await Promise.all([
    prisma.pagoCanon.findUnique({
      where: { id },
      include: { vendedor: { select: { emprendimiento: true } } },
    }),
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

  if (!pago) notFound();

  return (
    <div className="max-w-3xl">
      <EncabezadoPagina
        titulo="Editar pago de canon"
        descripcion={pago.vendedor.emprendimiento}
        migas={[
          { href: "/admin/canon", texto: "Canon y permisos" },
          { texto: "Editar pago" },
        ]}
      />

      <FormularioPago
        accion={actualizarPago}
        ediciones={ediciones.map((edicion) => ({
          id: edicion.id,
          etiqueta: edicion.nombre
            ? `${edicion.feria.nombre} — ${edicion.nombre}`
            : edicion.feria.nombre,
          montoCanon: aNumero(edicion.montoCanon),
        }))}
        vendedores={vendedores.map((vendedor) => ({
          id: vendedor.id,
          etiqueta: vendedor.emprendimiento,
        }))}
        pago={{
          id: pago.id,
          vendedorId: pago.vendedorId,
          edicionId: pago.edicionId,
          monto: aNumero(pago.monto),
          fechaPago: aValorInputFecha(pago.fechaPago),
          medio: pago.medio,
          estado: pago.estado,
          observaciones: pago.observaciones,
          comprobante: pago.comprobante,
        }}
      />
    </div>
  );
}
