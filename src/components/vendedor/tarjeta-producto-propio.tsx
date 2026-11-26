import Link from "next/link";

import { alternarDisponibilidad, eliminarProducto } from "@/actions/productos";
import { Badge } from "@/components/ui/badge";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
import { CarruselDeFotos } from "@/components/ui/carrusel-de-fotos";
import { IconoEtiqueta, IconoLapiz, IconoMas } from "@/components/ui/iconos";
import { Tarjeta } from "@/components/ui/tarjeta";
import { EstadoDeRevision } from "@/components/vendedor/estado-de-revision";
import type { EstadoDeRevision as Estado } from "@/lib/revision";

/** Lo que necesita la tarjeta del dueño; sale tal cual de `prisma.producto`. */
export interface ProductoPropio {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagenes: string[];
  disponible: boolean;
  destacado: boolean;
}

/**
 * Un producto del catálogo visto por su dueño, en «Mi stand».
 *
 * La foto y el texto son los de la tarjeta pública —cuadrada, el procesador de
 * fotos devuelve 1:1, así que el feriante ve exactamente lo que ve el vecino—,
 * pero abajo, en lugar del botón de consultar, van las acciones del dueño. El
 * de consultar no va a propósito: cada toque cuenta como una consulta en las
 * estadísticas de la vidriera, y las del dueño no son de nadie.
 */
export function TarjetaProductoPropio({
  producto,
  revision = null,
  nuevo = false,
  seBorra = null,
}: {
  producto: ProductoPropio;
  /** Si tiene un cambio esperando la revisión de la administración. */
  revision?: Estado | null;
  /** Si ese cambio es el alta: todavía no lo ve ningún vecino. */
  nuevo?: boolean;
  /**
   * Si es un borrador, cuándo se borra si no lo toca («el jueves 3 de
   * diciembre»). Un borrador no se marca sin stock: se completa o se borra.
   */
  seBorra?: string | null;
}) {
  const borrador = seBorra !== null;
  return (
    <Tarjeta className="flex h-full flex-col overflow-hidden">
      <div className="relative">
        <CarruselDeFotos
          imagenes={producto.imagenes}
          alt={producto.nombre}
          icono={IconoEtiqueta}
          sizes="(max-width: 640px) 100vw, 33vw"
          ajuste="contain"
          className="aspect-square w-full"
        />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          {borrador && (
            <Badge tono="neutro" tamanio="sm" className="bg-superficie/95">
              Borrador
            </Badge>
          )}
          {producto.destacado && (
            <Badge tono="amarillo" tamanio="sm" className="bg-superficie/95">
              Destacado
            </Badge>
          )}
          {!producto.disponible && (
            <Badge tono="neutro" tamanio="sm" className="bg-superficie/95">
              Sin stock
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {producto.nombre.trim() ? (
          <h3 className="font-semibold text-slate-900">{producto.nombre}</h3>
        ) : (
          <h3 className="font-semibold text-slate-400 italic">Sin nombre</h3>
        )}
        {producto.descripcion && (
          <p className="lineas-2 mt-1 text-sm text-slate-600">
            {producto.descripcion}
          </p>
        )}
        {borrador && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Lo ves sólo vos. Completalo y mandalo a revisión; si no lo tocás, se
            borra {seBorra}.
          </p>
        )}
        {revision && (
          <EstadoDeRevision
            revision={revision}
            que={nuevo ? "Producto nuevo" : undefined}
            sinDescartar={nuevo}
            className="mt-3"
          />
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Link
            href={`/mi-stand/productos/${producto.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
          >
            <IconoLapiz className="size-3.5" />
            {borrador ? "Completar" : "Editar"}
          </Link>

          {!borrador && (
            <BotonConfirmar
              accion={alternarDisponibilidad}
              campos={{ productoId: producto.id }}
              variante="fantasma"
              className="text-slate-600"
            >
              {producto.disponible ? "Marcar sin stock" : "Marcar disponible"}
            </BotonConfirmar>
          )}

          <BotonConfirmar
            accion={eliminarProducto}
            campos={{ productoId: producto.id }}
            confirmacion={
              borrador
                ? `¿Borrar ${producto.nombre.trim() ? `«${producto.nombre.trim()}»` : "este borrador"}? Se borra con sus fotos.`
                : `¿Eliminar "${producto.nombre}" del catálogo? Esta acción no se puede deshacer.`
            }
            variante="fantasma"
            className="ml-auto text-red-600 hover:bg-red-50"
          >
            Eliminar
          </BotonConfirmar>
        </div>
      </div>
    </Tarjeta>
  );
}

/**
 * La primera tarjeta del catálogo del dueño: el lugar donde va el próximo
 * producto. Con el catálogo vacío es la única, y alcanza como invitación.
 */
export function TarjetaAgregarProducto() {
  // Dos enlaces y no uno con otro adentro: un enlace dentro de otro no es
  // HTML válido. El grande es el alta de a uno; el de abajo, varias fotos.
  return (
    <div className="flex h-full min-h-40 flex-col rounded-xl border-2 border-dashed border-municipal-300 bg-municipal-50/50 text-center transition-colors hover:border-municipal-500 hover:bg-municipal-50 sm:min-h-64">
      <Link
        href="/mi-stand/productos/nuevo"
        className="group flex flex-1 flex-col items-center justify-center gap-3 p-6"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-municipal-500 text-white shadow-sm transition-transform group-hover:scale-105">
          <IconoMas className="size-7" />
        </span>
        <span className="text-base font-semibold text-municipal-800">
          Agregar producto
        </span>
        <span className="text-sm text-slate-600">
          Con foto y descripción, para que sepan qué ofrecés.
        </span>
      </Link>
      <Link
        href="/mi-stand/productos/borradores"
        className="border-t border-dashed border-municipal-200 px-6 py-3 text-sm font-medium text-municipal-600 hover:text-municipal-700"
      >
        O subí varias fotos de una vez
      </Link>
    </div>
  );
}
