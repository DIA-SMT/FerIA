import Link from "next/link";

import {
  VistaStand,
  type ParticipacionVistaStand,
} from "@/components/public/vista-stand";
import { Alerta } from "@/components/ui/alerta";
import { AvisoDeLlegada } from "@/components/ui/aviso-flotante";
import {
  Tarjeta,
  TarjetaCuerpo,
  TarjetaEncabezado,
} from "@/components/ui/tarjeta";
import {
  EditarContacto,
  EditarDescripcion,
  EditarIdentidad,
  EditarLogo,
  EditarPortada,
} from "@/components/vendedor/editar-stand";
import { LineaDeInteres } from "@/components/vendedor/interes-en-la-vidriera";
import { MisFerias } from "@/components/vendedor/mis-ferias";
import {
  TarjetaAgregarProducto,
  TarjetaProductoPropio,
} from "@/components/vendedor/tarjeta-producto-propio";
import { hayIAConfigurada } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { formatearFechaHora } from "@/lib/format";
import { obtenerInteresDelStand } from "@/lib/interes";
import { RUBROS } from "@/lib/labels";
import { feriasDelFeriante, proximasAsignaciones } from "@/lib/mis-ferias";
import { obtenerVendedorActual } from "@/lib/session";

export const metadata = { title: "Mi stand" };

/** Para que el aviso de llegada diga lo que pasó (ver `actions/productos`). */
const AVISOS_DE_LLEGADA = {
  agregado: "Producto agregado al catálogo.",
  actualizado: "Producto actualizado.",
} as const;

export default async function PaginaMiStand({
  searchParams,
}: {
  searchParams: Promise<{ agregado?: string; actualizado?: string }>;
}) {
  const { vendedor } = await obtenerVendedorActual();

  // Las dos ramas sin alta muestran a qué ferias pertenece, aunque no dejen
  // pedir otra. Con el alta aprobada eso vive en «Mis ferias».
  const { postulaciones, disponibles } =
    vendedor.estado === "APROBADO"
      ? { postulaciones: [], disponibles: [] }
      : await feriasDelFeriante(vendedor.id);


  // -------------------------- Pendiente de aprobación ------------------------
  if (vendedor.estado === "PENDIENTE") {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Tu alta está en revisión
        </h1>

        <Alerta
          tipo="advertencia"
          titulo="Pendiente de aprobación"
          className="mt-4"
        >
          La Dirección de Relaciones Institucionales está revisando el alta de{" "}
          <strong>{vendedor.emprendimiento}</strong>. Cuando te den el alta vas
          a tener tu stand online —vas a poder editar tu vidriera y cargar tu
          catálogo— y desde ahí vas a poder pedir estar en las ferias
          presenciales que quieras.
        </Alerta>

        <div className="mt-6">
          <MisFerias
            postulaciones={postulaciones}
            feriasDisponibles={disponibles}
            puedePedir={false}
          />
        </div>

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
            "No se registró un motivo. Comunicate con la Dirección de Relaciones Institucionales para más información."}
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
                Acercate a la Dirección de Relaciones Institucionales con la documentación
                del emprendimiento para pedir una nueva revisión.
              </li>
            </ol>
          </TarjetaCuerpo>
        </Tarjeta>

        {/*
          Los pedidos de feria quedan a la vista pero no se puede hacer uno
          nuevo: pedir una feria necesita el alta, y el alta está rechazada. La
          salida es que la Dirección la reabra desde el panel, no que el
          feriante pida una plaza. Antes sí alcanzaba —aceptar una postulación
          volvía a publicar la ficha de rebote— y era justamente el atajo que
          mezclaba los dos permisos.
        */}
        <div className="mt-6">
          <MisFerias
            postulaciones={postulaciones}
            feriasDisponibles={disponibles}
            puedePedir={false}
          />
        </div>
      </>
    );
  }

  // -------------------------------- Aprobada --------------------------------
  /*
    El stand tal como lo ve el vecino, con un lápiz en cada parte.

    Antes esta pantalla era un resumen —tres números, avisos y ferias— y el
    stand se editaba en otras dos pestañas, «Mi vidriera» y «Catálogo», sin ver
    cómo quedaba. Ahora el feriante entra y lo primero que ve es su stand, y lo
    cambia donde lo ve. Las ferias pasaron a la pestaña «Mis ferias».
  */
  const [parametros, productos, participaciones, interes] = await Promise.all([
    searchParams,
    prisma.producto.findMany({
      where: { vendedorId: vendedor.id },
      orderBy: [{ destacado: "desc" }, { disponible: "desc" }, { nombre: "asc" }],
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        imagenes: true,
        disponible: true,
        destacado: true,
      },
    }),
    proximasAsignaciones(vendedor.id),
    obtenerInteresDelStand(vendedor.id),
  ]);

  const sinStock = productos.filter((producto) => !producto.disponible).length;
  const enStock = productos.length - sinStock;
  const resumenCatalogo =
    productos.length === 0
      ? null
      : `${enStock} ${enStock === 1 ? "disponible" : "disponibles"}${
          sinStock > 0 ? ` · ${sinStock} sin stock` : ""
        }`;

  const llegada = (
    Object.keys(AVISOS_DE_LLEGADA) as Array<keyof typeof AVISOS_DE_LLEGADA>
  ).find((clave) => parametros[clave] !== undefined);

  return (
    <>
      {llegada && (
        <AvisoDeLlegada
          mensaje={AVISOS_DE_LLEGADA[llegada]}
          parametro={llegada}
        />
      )}

      <div className="mb-5 space-y-3">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">
            Así te ven los vecinos.
          </span>{" "}
          Tocá el lápiz o la cámara para cambiar cualquier parte.{" "}
          {/* En pantallas anchas el enlace está arriba, en el encabezado. */}
          <Link
            href={`/stands/${vendedor.slug}`}
            target="_blank"
            className="font-medium text-municipal-600 hover:text-municipal-700 sm:hidden"
          >
            Ver mi stand público
          </Link>
        </p>
        <LineaDeInteres resumen={interes} />
      </div>

      <VistaStand
        vendedor={vendedor}
        participaciones={participaciones as ParticipacionVistaStand[]}
        resumenCatalogo={resumenCatalogo}
        edicion={{
          portada: <EditarPortada actual={vendedor.imagenPortada} />,
          logo: <EditarLogo actual={vendedor.logo} />,
          identidad: (
            <EditarIdentidad
              emprendimiento={vendedor.emprendimiento}
              rubro={vendedor.rubro}
            />
          ),
          descripcion: (
            <EditarDescripcion
              descripcion={vendedor.descripcion}
              emprendimiento={vendedor.emprendimiento}
              rubro={vendedor.rubro}
              hayIA={hayIAConfigurada()}
            />
          ),
          contacto: (
            <EditarContacto
              contacto={{
                whatsapp: vendedor.whatsapp,
                telefono: vendedor.telefono,
                email: vendedor.email,
                direccion: vendedor.direccion,
                instagram: vendedor.instagram,
                facebook: vendedor.facebook,
                sitioWeb: vendedor.sitioWeb,
              }}
            />
          ),
        }}
        catalogo={
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <li>
              <TarjetaAgregarProducto />
            </li>
            {productos.map((producto) => (
              <li key={producto.id}>
                <TarjetaProductoPropio producto={producto} />
              </li>
            ))}
          </ul>
        }
      />
    </>
  );
}
