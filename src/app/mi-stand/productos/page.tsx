import Link from "next/link";

import { alternarDisponibilidad, eliminarProducto } from "@/actions/productos";
import { BotonConfirmar } from "@/components/ui/boton-confirmar";
import { Badge } from "@/components/ui/badge";
import { BotonLink } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  IconoEtiqueta,
  IconoLapiz,
  IconoMas,
} from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import { Tarjeta } from "@/components/ui/tarjeta";
import { prisma } from "@/lib/db";
import { requerirVendedorAprobado } from "@/lib/session";

export const metadata = { title: "Catálogo" };

export default async function PaginaProductos() {
  const { vendedor } = await requerirVendedorAprobado();

  const productos = await prisma.producto.findMany({
    where: { vendedorId: vendedor.id },
    orderBy: [{ destacado: "desc" }, { creadoEn: "desc" }],
  });

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Mi catálogo
          </h1>
          <p className="mt-1 text-slate-600">
            {productos.length === 0
              ? "Todavía no cargaste productos."
              : `${productos.length} ${
                  productos.length === 1 ? "producto" : "productos"
                } en tu vidriera.`}
          </p>
        </div>
        <BotonLink href="/mi-stand/productos/nuevo">
          <IconoMas className="size-4" />
          Agregar producto
        </BotonLink>
      </header>

      {productos.length === 0 ? (
        <EstadoVacio
          icono={IconoEtiqueta}
          titulo="Tu catálogo está vacío"
          descripcion="Cargá tus productos con foto y descripción para que los vecinos sepan qué ofrecés antes de escribirte."
          accion={
            <BotonLink href="/mi-stand/productos/nuevo">
              Agregar el primero
            </BotonLink>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {productos.map((producto) => (
            <li key={producto.id}>
              <Tarjeta className="flex h-full flex-col overflow-hidden">
                <div className="relative">
                  <ImagenPortada
                    src={producto.imagenes[0] ?? null}
                    alt={producto.nombre}
                    icono={IconoEtiqueta}
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="aspect-[4/3] w-full"
                  />
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
                    {producto.destacado && (
                      <Badge tono="amarillo" tamanio="sm" className="bg-white/95">
                        Destacado
                      </Badge>
                    )}
                    {!producto.disponible && (
                      <Badge tono="neutro" tamanio="sm" className="bg-white/95">
                        Sin stock
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h2 className="font-semibold text-slate-900">
                    {producto.nombre}
                  </h2>
                  {producto.descripcion && (
                    <p className="lineas-2 mt-1 text-sm text-slate-600">
                      {producto.descripcion}
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <Link
                      href={`/mi-stand/productos/${producto.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-municipal-600 transition-colors hover:text-municipal-700"
                    >
                      <IconoLapiz className="size-3.5" />
                      Editar
                    </Link>

                    <BotonConfirmar
                      accion={alternarDisponibilidad}
                      campos={{ productoId: producto.id }}
                      variante="fantasma"
                      className="text-slate-600"
                    >
                      {producto.disponible
                        ? "Marcar sin stock"
                        : "Marcar disponible"}
                    </BotonConfirmar>

                    <BotonConfirmar
                      accion={eliminarProducto}
                      campos={{ productoId: producto.id }}
                      confirmacion={`¿Eliminar "${producto.nombre}" del catálogo? Esta acción no se puede deshacer.`}
                      variante="fantasma"
                      className="ml-auto text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </BotonConfirmar>
                  </div>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
