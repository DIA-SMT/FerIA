import Link from "next/link";

import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoEnlaceExterno, IconoUsuarios } from "@/components/ui/iconos";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCuerpo,
  TablaFila,
  Td,
  Th,
} from "@/components/ui/tabla";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/db";
import { formatearFecha } from "@/lib/format";
import {
  ESTADOS_VENDEDOR,
  RUBROS,
  TONO_ESTADO_VENDEDOR,
} from "@/lib/labels";
import { formatearWhatsapp } from "@/lib/whatsapp";
import type { EstadoVendedor, Prisma } from "@prisma/client";

export const metadata = { title: "Feriantes" };

const ESTADOS_VALIDOS = new Set(Object.keys(ESTADOS_VENDEDOR));

const FILTROS = [
  { valor: "", etiqueta: "Todos" },
  { valor: "APROBADO", etiqueta: "Aprobados" },
  { valor: "PENDIENTE", etiqueta: "Pendientes" },
  { valor: "RECHAZADO", etiqueta: "Rechazados" },
];

export default async function PaginaFeriantes({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const params = await searchParams;
  const estado =
    params.estado && ESTADOS_VALIDOS.has(params.estado)
      ? (params.estado as EstadoVendedor)
      : undefined;

  const where: Prisma.VendedorWhereInput = estado ? { estado } : {};

  const feriantes = await prisma.vendedor.findMany({
    where,
    orderBy: [{ estado: "asc" }, { emprendimiento: "asc" }],
    include: {
      usuario: { select: { email: true, nombre: true } },
      _count: { select: { productos: true, stands: true } },
    },
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Feriantes"
        descripcion="Todos los emprendimientos registrados en la plataforma, sin importar su estado."
      />

      <nav aria-label="Filtrar por estado" className="mb-5 flex flex-wrap gap-2">
        {FILTROS.map((filtro) => {
          const activo = (params.estado ?? "") === filtro.valor;
          const href = filtro.valor
            ? `/admin/feriantes?estado=${filtro.valor}`
            : "/admin/feriantes";

          return (
            <Link
              key={filtro.etiqueta}
              href={href}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors",
                activo
                  ? "bg-municipal-500 text-white ring-municipal-500"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {filtro.etiqueta}
            </Link>
          );
        })}
      </nav>

      {feriantes.length === 0 ? (
        <EstadoVacio
          icono={IconoUsuarios}
          titulo="Sin feriantes"
          descripcion={
            estado
              ? "No hay feriantes con ese estado."
              : "Todavía no se registró ningún emprendimiento."
          }
        />
      ) : (
        <Tarjeta className="overflow-hidden">
          <Tabla>
            <TablaCabecera>
              <tr>
                <Th>Emprendimiento</Th>
                <Th>Rubro</Th>
                <Th>Titular</Th>
                <Th>WhatsApp</Th>
                <Th>Estado</Th>
                <Th className="text-center">Productos</Th>
                <Th className="text-center">Stands</Th>
                <Th>Registro</Th>
                <Th />
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {feriantes.map((feriante) => (
                <TablaFila key={feriante.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        nombre={feriante.emprendimiento}
                        imagen={feriante.logo}
                        tamanio="sm"
                      />
                      <span className="font-medium text-slate-900">
                        {feriante.emprendimiento}
                      </span>
                    </div>
                  </Td>
                  <Td className="text-slate-500">{RUBROS[feriante.rubro]}</Td>
                  <Td>
                    <span className="block text-slate-700">
                      {feriante.usuario.nombre}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {feriante.usuario.email}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-slate-600">
                    {formatearWhatsapp(feriante.whatsapp)}
                  </Td>
                  <Td>
                    <Badge
                      tono={TONO_ESTADO_VENDEDOR[feriante.estado]}
                      tamanio="sm"
                    >
                      {ESTADOS_VENDEDOR[feriante.estado]}
                    </Badge>
                  </Td>
                  <Td className="text-center tabular-nums">
                    {feriante._count.productos}
                  </Td>
                  <Td className="text-center tabular-nums">
                    {feriante._count.stands}
                  </Td>
                  <Td className="whitespace-nowrap text-slate-500">
                    {formatearFecha(feriante.creadoEn)}
                  </Td>
                  <Td className="text-right">
                    {feriante.estado === "APROBADO" ? (
                      <Link
                        href={`/stands/${feriante.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
                      >
                        Ver stand
                        <IconoEnlaceExterno className="size-3.5" />
                      </Link>
                    ) : (
                      <Link
                        href="/admin/solicitudes"
                        className="text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
                      >
                        Revisar
                      </Link>
                    )}
                  </Td>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}
    </>
  );
}
