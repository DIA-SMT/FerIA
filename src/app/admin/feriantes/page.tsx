import Link from "next/link";

import { EncabezadoPagina } from "@/components/admin/encabezado-pagina";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { estilosBoton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoBuscar,
  IconoEnlaceExterno,
  IconoUsuarios,
} from "@/components/ui/iconos";
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
import { buscarFeriantes } from "@/lib/busqueda-feriantes";
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

/**
 * Con una búsqueda no se pagina: se muestran las mejores coincidencias, de la
 * mejor a la peor. Más que esto ya no es buscar a alguien.
 */
const MAXIMO_BUSQUEDA = 100;

export default async function PaginaFeriantes({
  searchParams,
}: {
  searchParams: Promise<{
    estado?: string;
    pagina?: string;
    q?: string;
    feria?: string;
  }>;
}) {
  const params = await searchParams;
  // La misma búsqueda que usa Migue: sin tildes, sin «doña», con errores de
  // tipeo. Por el nombre del emprendimiento o el de quien lo lleva.
  const busqueda = params.q?.trim().slice(0, 100) ?? "";
  const encontrados = busqueda
    ? await buscarFeriantes(busqueda, MAXIMO_BUSQUEDA)
    : null;
  const estado =
    params.estado && ESTADOS_VALIDOS.has(params.estado)
      ? (params.estado as EstadoVendedor)
      : undefined;
  const verPadron = params.estado === "PADRON";

  // Los habilitados en una feria: es adonde manda Migue cuando la lista no
  // entra en el chat.
  const ferias = await prisma.feria.findMany({
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, slug: true },
  });
  const feria = ferias.find((opcion) => opcion.slug === params.feria);

  /** La misma vista con algún parámetro cambiado (o sacado, con `""`). */
  function enlace(cambios: Record<string, string>) {
    const consulta = new URLSearchParams();
    const actuales: Record<string, string | undefined> = {
      estado: params.estado,
      q: busqueda || undefined,
      feria: feria?.slug,
    };
    for (const [clave, valor] of Object.entries({ ...actuales, ...cambios })) {
      if (valor) consulta.set(clave, valor);
    }
    return consulta.size ? `/admin/feriantes?${consulta}` : "/admin/feriantes";
  }

  /*
    Cada filtro cuenta lo mismo que el número que lo resume en el tablero.

    «Aprobados» son todos los aprobados, padrón incluido: son fichas publicadas
    y el tablero las cuenta. «Pendientes» son las solicitudes, con la misma
    definición que el tablero y el contador del menú. El padrón sin reclamar
    tiene su propio filtro porque «sin titular» es otra cosa que el estado.
  */
  const porEstado: Prisma.VendedorWhereInput = verPadron
    ? PADRON_SIN_RECLAMAR
    : estado === "PENDIENTE"
      ? SOLICITUD_PENDIENTE
      : estado
        ? { estado }
        : {};
  const where: Prisma.VendedorWhereInput = {
    AND: [
      porEstado,
      feria
        ? { postulaciones: { some: { feriaId: feria.id, estado: "ACEPTADA" } } }
        : {},
      encontrados ? { id: { in: encontrados } } : {},
    ],
  };

  const total = await prisma.vendedor.count({ where });
  const { pagina, paginas, salto } = encontrados
    ? { pagina: 1, paginas: 1, salto: 0 }
    : paginar(total, leerPagina(params.pagina), POR_PAGINA);

  const sinOrdenar = await prisma.vendedor.findMany({
    where,
    // El id desempata los nombres repetidos del padrón, para que ninguna ficha
    // aparezca en dos páginas ni falte en todas.
    orderBy: [{ estado: "asc" }, { emprendimiento: "asc" }, { id: "asc" }],
    skip: salto,
    take: encontrados ? MAXIMO_BUSQUEDA : POR_PAGINA,
    include: {
      usuario: { select: { email: true, nombre: true } },
      _count: { select: { productos: true, stands: true } },
      // En qué ferias presenciales está habilitado. Es el dato que antes no
      // estaba en ninguna pantalla: se podía ver cuántos stands tenía asignados
      // —que es logística de una edición— pero no de qué ferias es parte.
      postulaciones: {
        where: { estado: "ACEPTADA" },
        orderBy: { feria: { nombre: "asc" } },
        select: { id: true, feria: { select: { nombre: true, slug: true } } },
      },
    },
  });

  // Con búsqueda, en el orden de la búsqueda: lo que mejor coincide, arriba.
  const feriantes = encontrados
    ? [...sinOrdenar].sort(
        (a, b) => encontrados.indexOf(a.id) - encontrados.indexOf(b.id),
      )
    : sinOrdenar;

  return (
    <>
      <EncabezadoPagina
        titulo="Feriantes"
        descripcion="Todos los emprendimientos registrados en la plataforma, sin importar su estado."
      />

      <form
        action="/admin/feriantes"
        role="search"
        className="mb-4 flex max-w-3xl flex-wrap items-center gap-2"
      >
        {params.estado && (
          <input type="hidden" name="estado" value={params.estado} />
        )}
        <label htmlFor="feria-feriantes" className="sr-only">
          Feria
        </label>
        <select
          id="feria-feriantes"
          name="feria"
          defaultValue={feria?.slug ?? ""}
          className="h-10 max-w-48 shrink-0 rounded-lg border border-slate-300 bg-superficie px-2 text-sm text-slate-900 focus:border-municipal-500 focus:ring-2 focus:ring-municipal-500/30 focus:outline-none"
        >
          <option value="">Todas las ferias</option>
          {ferias.map((opcion) => (
            <option key={opcion.id} value={opcion.slug}>
              {opcion.nombre}
            </option>
          ))}
        </select>
        <label htmlFor="q-feriantes" className="sr-only">
          Buscar un feriante
        </label>
        <div className="relative min-w-0 flex-1">
          <IconoBuscar className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            id="q-feriantes"
            name="q"
            type="search"
            defaultValue={busqueda}
            placeholder="Nombre del emprendimiento o de quien lo lleva"
            className="h-10 w-full rounded-lg border border-slate-300 bg-superficie pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-municipal-500 focus:ring-2 focus:ring-municipal-500/30 focus:outline-none"
          />
        </div>
        <button type="submit" className={estilosBoton("primario", "md")}>
          Buscar
        </button>
        {(busqueda || feria) && (
          <Link
            href={enlace({ q: "", feria: "" })}
            className={estilosBoton("fantasma", "md")}
          >
            Limpiar
          </Link>
        )}
      </form>

      <nav
        aria-label="Filtrar por estado"
        className="mb-5 flex flex-wrap gap-2"
      >
        {FILTROS.map((filtro) => {
          const activo = (params.estado ?? "") === filtro.valor;
          const href = enlace({ estado: filtro.valor });

          return (
            <Link
              key={filtro.etiqueta}
              href={href}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors",
                activo
                  ? "bg-municipal-500 text-white ring-municipal-500"
                  : "bg-superficie text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900",
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
            busqueda
              ? `Ningún feriante coincide con «${busqueda}»${estado || verPadron || feria ? " con esos filtros" : ""}. Probá con otra parte del nombre.`
              : feria
                ? `No hay feriantes habilitados en ${feria.nombre}${estado || verPadron ? " con ese estado" : ""}.`
                : verPadron
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
            {feria && ` habilitados en ${feria.nombre}`}
            {busqueda && ` coinciden con «${busqueda}»`}
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
                          <Link
                            href={`/admin/feriantes/${feriante.id}`}
                            className="font-medium text-slate-900 hover:text-municipal-700 hover:underline"
                          >
                            {feriante.emprendimiento}
                          </Link>
                        </div>
                      </Td>
                      <Td className="text-slate-500">
                        {RUBROS[feriante.rubro]}
                      </Td>
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
                            {feriante.estado === "APROBADO"
                              ? "Sólo online"
                              : "—"}
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
            parametros={{
              estado: estado ?? (verPadron ? "PADRON" : undefined),
              feria: feria?.slug,
            }}
            className="mt-6"
          />
        </>
      )}
    </>
  );
}
