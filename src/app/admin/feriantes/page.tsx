import Link from "next/link";

import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoEnlaceExterno, IconoUsuarios } from "@/components/ui/iconos";
import { Paginacion } from "@/components/ui/paginacion";
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
import { PADRON_SIN_RECLAMAR, SOLICITUD_PENDIENTE } from "@/lib/feriantes";
import { formatearFecha, formatearNumero } from "@/lib/format";
import { leerPagina, paginar } from "@/lib/paginacion";
import { titularDe } from "@/lib/titular";
import { ESTADOS_VENDEDOR, RUBROS, TONO_ESTADO_VENDEDOR } from "@/lib/labels";
import { formatearWhatsapp } from "@/lib/whatsapp";
import type { EstadoVendedor, Prisma } from "@prisma/client";

export const metadata = { title: "Feriantes" };

const ESTADOS_VALIDOS = new Set(Object.keys(ESTADOS_VENDEDOR));

const FILTROS = [
  { valor: "", etiqueta: "Todos" },
  { valor: "APROBADO", etiqueta: "Aprobados" },
  { valor: "PENDIENTE", etiqueta: "Pendientes" },
  { valor: "RECHAZADO", etiqueta: "Rechazados" },
  { valor: "PADRON", etiqueta: "Padrón sin reclamar" },
];

/** Filas por página. Es una tabla de trabajo: más densa que el directorio. */
const POR_PAGINA = 50;

export default async function PaginaFeriantes({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const estado =
    params.estado && ESTADOS_VALIDOS.has(params.estado)
      ? (params.estado as EstadoVendedor)
      : undefined;
  const verPadron = params.estado === "PADRON";

  /*
    Cada filtro cuenta lo mismo que el número que lo resume en el tablero.

    «Aprobados» son todos los aprobados, padrón incluido: son fichas publicadas
    y el tablero las cuenta. «Pendientes» son las solicitudes, con la misma
    definición que el tablero y el contador del menú. El padrón sin reclamar
    tiene su propio filtro porque «sin titular» es otra cosa que el estado.
  */
  const where: Prisma.VendedorWhereInput = verPadron
    ? PADRON_SIN_RECLAMAR
    : estado === "PENDIENTE"
      ? SOLICITUD_PENDIENTE
      : estado
        ? { estado }
        : {};

  const total = await prisma.vendedor.count({ where });
  const { pagina, paginas, salto } = paginar(
    total,
    leerPagina(params.pagina),
    POR_PAGINA,
  );

  const feriantes = await prisma.vendedor.findMany({
    where,
    // El id desempata los nombres repetidos del padrón, para que ninguna ficha
    // aparezca en dos páginas ni falte en todas.
    orderBy: [{ estado: "asc" }, { emprendimiento: "asc" }, { id: "asc" }],
    skip: salto,
    take: POR_PAGINA,
    include: {
      usuario: { select: { email: true, nombre: true } },
      _count: { select: { productos: true, stands: true } },
      // En qué ferias presenciales está habilitado. Es el dato que antes no
      // estaba en ninguna pantalla: se podía ver cuántos stands tenía asignados
      // —que es logística de una edición— pero no de qué ferias es parte.
      postulaciones: {
        where: { estado: 'ACEPTADA' },
        orderBy: { feria: { nombre: 'asc' } },
        select: { id: true, feria: { select: { nombre: true, slug: true } } },
      },
    },
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Feriantes"
        descripcion="Todos los emprendimientos registrados en la plataforma, sin importar su estado."
      />

      <nav
        aria-label="Filtrar por estado"
        className="mb-5 flex flex-wrap gap-2"
      >
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
            verPadron
              ? "No hay fichas del padrón esperando que las reclamen."
              : estado === "PENDIENTE"
                ? "No hay solicitudes esperando revisión."
                : estado
                  ? "No hay feriantes con ese estado."
                  : "Todavía no se registró ningún emprendimiento."
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            {formatearNumero(total)} {total === 1 ? "feriante" : "feriantes"}
            {paginas > 1 && ` · página ${pagina} de ${paginas}`}
          </p>
          <Tarjeta className="overflow-hidden">
            <Tabla>
              <TablaCabecera>
                <tr>
                  <Th>Emprendimiento</Th>
                  <Th>Rubro</Th>
                  <Th>Titular</Th>
                  <Th>WhatsApp</Th>
                  <Th>Estado</Th>
                  <Th>Ferias presenciales</Th>
                  <Th className="text-center">Productos</Th>
                  <Th className="text-center">Stands</Th>
                  <Th>Registro</Th>
                  <Th />
                </tr>
              </TablaCabecera>
              <TablaCuerpo>
                {feriantes.map((feriante) => {
                  const titular = titularDe(feriante);

                  return (
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
                          {titular.nombre}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {titular.reclamada
                            ? titular.email
                            : (titular.email ?? "Sin cuenta")}
                        </span>
                        {!titular.reclamada && (
                          <Badge tono="neutro" tamanio="sm" className="mt-1">
                            Padrón sin reclamar
                          </Badge>
                        )}
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
                      <Td>
                        {feriante.postulaciones.length === 0 ? (
                          <span className="text-sm text-slate-400">
                            {feriante.estado === 'APROBADO'
                              ? 'Sólo online'
                              : '—'}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {feriante.postulaciones.map((postulacion) => (
                              <Badge
                                key={postulacion.id}
                                tono="azul"
                                tamanio="sm"
                              >
                                {postulacion.feria.nombre}
                              </Badge>
                            ))}
                          </div>
                        )}
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
                            href="/admin/postulaciones"
                            className="text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
                          >
                            Revisar
                          </Link>
                        )}
                      </Td>
                    </TablaFila>
                  );
                })}
              </TablaCuerpo>
            </Tabla>
          </Tarjeta>
          <Paginacion
            pagina={pagina}
            paginas={paginas}
            ruta="/admin/feriantes"
            parametros={{ estado: estado ?? (verPadron ? "PADRON" : undefined) }}
            className="mt-6"
          />
        </>
      )}
    </>
  );
}
