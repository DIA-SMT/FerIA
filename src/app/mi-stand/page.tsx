import Link from "next/link";

import { Alerta } from "@/components/ui/alerta";
import { Badge } from "@/components/ui/badge";
import { BotonLink } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoCalendario,
  IconoEnlaceExterno,
  IconoEtiqueta,
  IconoUbicacion,
} from "@/components/ui/iconos";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import { EDICIONES_PUBLICAS } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { formatearFechaHora, formatearRangoFechas, hoyUTC } from "@/lib/format";
import { RUBROS } from "@/lib/labels";
import { obtenerVendedorActual } from "@/lib/session";

export const metadata = { title: "Resumen" };

export default async function PaginaMiStand() {
  const { vendedor } = await obtenerVendedorActual();

  // -------------------------- Pendiente de aprobación ------------------------
  if (vendedor.estado === "PENDIENTE") {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Tu solicitud está en revisión
        </h1>

        <Alerta
          tipo="advertencia"
          titulo="Pendiente de aprobación"
          className="mt-4"
        >
          La Dirección de Ferias y Mercados está revisando los datos de{" "}
          <strong>{vendedor.emprendimiento}</strong>. Cuando la aprueben vas a
          poder editar tu vidriera, cargar tu catálogo y ser asignado a un stand
          en las próximas ediciones.
        </Alerta>

        <Tarjeta className="mt-6">
          <TarjetaEncabezado titulo="Datos que presentaste" />
          <TarjetaCuerpo>
            <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Emprendimiento</dt>
                <dd className="font-medium text-slate-900">
                  {vendedor.emprendimiento}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Rubro</dt>
                <dd className="font-medium text-slate-900">
                  {RUBROS[vendedor.rubro]}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">WhatsApp</dt>
                <dd className="font-medium text-slate-900">
                  {vendedor.whatsapp}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Solicitud enviada</dt>
                <dd className="font-medium text-slate-900">
                  {formatearFechaHora(vendedor.creadoEn)}
                </dd>
              </div>
              {vendedor.descripcion && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Descripción</dt>
                  <dd className="whitespace-pre-line text-slate-800">
                    {vendedor.descripcion}
                  </dd>
                </div>
              )}
            </dl>
          </TarjetaCuerpo>
        </Tarjeta>

        <p className="mt-6 text-sm text-slate-500">
          Mientras tanto podés{" "}
          <Link
            href="/ferias"
            className="font-medium text-municipal-600 hover:text-municipal-700"
          >
            mirar las ferias publicadas
          </Link>{" "}
          para ver en cuáles te gustaría participar.
        </p>
      </>
    );
  }

  // ------------------------------- Rechazada --------------------------------
  if (vendedor.estado === "RECHAZADO") {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Tu solicitud fue rechazada
        </h1>

        <Alerta tipo="error" titulo="Solicitud rechazada" className="mt-4">
          {vendedor.motivoRechazo ??
            "No se registró un motivo. Comunicate con la Dirección de Ferias y Mercados para más información."}
        </Alerta>

        <Tarjeta className="mt-6">
          <TarjetaEncabezado
            titulo="¿Qué podés hacer?"
            descripcion="La decisión no es definitiva."
          />
          <TarjetaCuerpo>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-municipal-100 text-xs font-semibold text-municipal-700">
                  1
                </span>
                Revisá el motivo del rechazo y corregí lo observado.
              </li>
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-municipal-100 text-xs font-semibold text-municipal-700">
                  2
                </span>
                Acercate a la Dirección de Ferias y Mercados con la documentación
                del emprendimiento para pedir una nueva revisión.
              </li>
            </ol>
          </TarjetaCuerpo>
        </Tarjeta>
      </>
    );
  }

  // -------------------------------- Aprobada --------------------------------
  const hoy = hoyUTC();

  const [asignaciones, productos, productosDisponibles] = await Promise.all([
    prisma.stand.findMany({
      where: {
        vendedorId: vendedor.id,
        edicion: { ...EDICIONES_PUBLICAS, fechaFin: { gte: hoy } },
      },
      orderBy: { edicion: { fechaInicio: "asc" } },
      include: {
        edicion: {
          include: { feria: { select: { nombre: true, slug: true, direccion: true } } },
        },
      },
    }),
    prisma.producto.count({ where: { vendedorId: vendedor.id } }),
    prisma.producto.count({
      where: { vendedorId: vendedor.id, disponible: true },
    }),
  ]);

  const vidrieraIncompleta =
    !vendedor.descripcion || !vendedor.imagenPortada || productos === 0;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Hola, {vendedor.emprendimiento}
          </h1>
          <p className="mt-1 text-slate-600">
            Tu stand está publicado en el market municipal.
          </p>
        </div>
        <BotonLink href={`/stands/${vendedor.slug}`} externo variante="contorno">
          Ver mi stand
          <IconoEnlaceExterno className="size-4" />
        </BotonLink>
      </div>

      {vidrieraIncompleta && (
        <Alerta
          tipo="info"
          titulo="Completá tu vidriera"
          className="mt-5"
        >
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {!vendedor.descripcion && (
              <li>Contá de qué se trata tu emprendimiento.</li>
            )}
            {!vendedor.imagenPortada && (
              <li>Subí una foto de portada para tu stand.</li>
            )}
            {productos === 0 && <li>Cargá al menos un producto al catálogo.</li>}
          </ul>
          <p className="mt-2 flex flex-wrap gap-3">
            <Link
              href="/mi-stand/perfil"
              className="font-medium underline underline-offset-2"
            >
              Editar mi vidriera
            </Link>
            <Link
              href="/mi-stand/productos/nuevo"
              className="font-medium underline underline-offset-2"
            >
              Agregar un producto
            </Link>
          </p>
        </Alerta>
      )}

      {/* -------------------------- Métricas rápidas ------------------------- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Tarjeta>
          <TarjetaCuerpo>
            <p className="text-sm text-slate-500">Ferias próximas</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {asignaciones.length}
            </p>
          </TarjetaCuerpo>
        </Tarjeta>
        <Tarjeta>
          <TarjetaCuerpo>
            <p className="text-sm text-slate-500">Productos en catálogo</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{productos}</p>
          </TarjetaCuerpo>
        </Tarjeta>
        <Tarjeta>
          <TarjetaCuerpo>
            <p className="text-sm text-slate-500">Disponibles</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {productosDisponibles}
            </p>
          </TarjetaCuerpo>
        </Tarjeta>
      </div>

      {/* ---------------------------- Asignaciones --------------------------- */}
      <Tarjeta className="mt-6">
        <TarjetaEncabezado
          titulo="Mis próximas ferias"
          descripcion="Las asignaciones las define la Dirección de Ferias y Mercados."
        />
        <TarjetaCuerpo>
          {asignaciones.length === 0 ? (
            <EstadoVacio
              icono={IconoCalendario}
              titulo="Todavía no tenés stands asignados"
              descripcion="Cuando te asignen un lugar en una próxima edición, lo vas a ver acá."
              accion={
                <BotonLink href="/ferias" variante="contorno" tamanio="sm">
                  Ver ferias publicadas
                </BotonLink>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {asignaciones.map((stand) => (
                <li
                  key={stand.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/ferias/${stand.edicion.feria.slug}`}
                      className="font-semibold text-slate-900 transition-colors hover:text-municipal-700"
                    >
                      {stand.edicion.feria.nombre}
                    </Link>
                    {stand.edicion.nombre && (
                      <p className="text-sm text-municipal-600">
                        {stand.edicion.nombre}
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                      <IconoCalendario className="size-4 shrink-0 text-slate-400" />
                      {formatearRangoFechas(
                        stand.edicion.fechaInicio,
                        stand.edicion.fechaFin,
                      )}{" "}
                      · {stand.edicion.horario}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
                      <IconoUbicacion className="size-4 shrink-0 text-slate-400" />
                      {stand.edicion.feria.direccion}
                    </p>
                  </div>
                  <Badge tono="amarillo">Stand {stand.numero}</Badge>
                </li>
              ))}
            </ul>
          )}
        </TarjetaCuerpo>
      </Tarjeta>

      <div className="mt-6 flex flex-wrap gap-3">
        <BotonLink href="/mi-stand/productos/nuevo" variante="secundario">
          <IconoEtiqueta className="size-4" />
          Agregar producto
        </BotonLink>
        <BotonLink href="/mi-stand/perfil" variante="contorno">
          Editar mi vidriera
        </BotonLink>
      </div>
    </>
  );
}
