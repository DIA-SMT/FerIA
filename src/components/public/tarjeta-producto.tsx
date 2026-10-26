import { BotonAgregar } from "@/components/carrito/boton-agregar";
import { Badge } from "@/components/ui/badge";
import { IconoEtiqueta, IconoWhatsapp } from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import { formatearMoneda } from "@/lib/format";
import { hayUnidades, sePuedePedir } from "@/lib/pedidos";
import { linkWhatsapp, mensajeConsultaProducto } from "@/lib/whatsapp";

export interface ProductoPublico {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagenes: string[];
  disponible: boolean;
  /** Ya convertido a `number`: un `Decimal` de Prisma no cruza al cliente. */
  precio: number | null;
  stock: number | null;
}

/**
 * Qué parte del marketplace está habilitada.
 *
 * Llega como prop y no se lee del entorno acá por la misma razón que `hayIA`:
 * la decisión se toma una vez en la página, que es un Server Component, y así
 * el componente del carrito ni siquiera entra en el bundle cuando está
 * apagado. Ver `src/lib/marketplace.ts`.
 */
export interface EstadoMarketplace {
  precios: boolean;
  pedidos: boolean;
}

interface PropsTarjetaProducto {
  producto: ProductoPublico;
  stand: { slug: string; emprendimiento: string };
  whatsapp: string;
  marketplace: EstadoMarketplace;
}

export function TarjetaProducto({
  producto,
  stand,
  whatsapp,
  marketplace,
}: PropsTarjetaProducto) {
  const portada = producto.imagenes[0] ?? null;
  const quedan = hayUnidades(producto);
  const pedible = marketplace.pedidos && sePuedePedir(producto);
  const muestraPrecio = marketplace.precios && producto.precio !== null;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative">
        <ImagenPortada
          src={portada}
          alt={producto.nombre}
          icono={IconoEtiqueta}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          ajuste="contain"
          className="aspect-square w-full"
        />
        {!quedan && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Badge tono="neutro">Sin stock</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-slate-900">{producto.nombre}</h3>

        {muestraPrecio && (
          <p className="mt-1 text-lg font-bold text-slate-900">
            {formatearMoneda(producto.precio)}
          </p>
        )}

        {producto.descripcion && (
          <p className="lineas-3 mt-1 text-sm text-slate-600">
            {producto.descripcion}
          </p>
        )}

        {/* Quedan pocas: sólo se avisa cuando el feriante lleva la cuenta y el
            número es chico. Con stock en null no hay nada que avisar, y con
            stock alto el cartel es presión de venta y no información. */}
        {quedan && producto.stock !== null && producto.stock <= 5 && (
          <p className="mt-1 text-xs font-medium text-amber-700">
            Quedan {producto.stock}
          </p>
        )}

        {/* `mt-auto` ancla el pie: con precios o sin ellos, es lo que mantiene
            alineadas las tarjetas de la grilla. */}
        <div className="mt-auto pt-4">
          {pedible ? (
            <BotonAgregar
              stand={stand}
              producto={{
                id: producto.id,
                nombre: producto.nombre,
                // `sePuedePedir` ya garantizó que no es null.
                precio: producto.precio ?? 0,
                imagen: portada,
              }}
            />
          ) : (
            quedan && (
              <a
                href={linkWhatsapp(
                  whatsapp,
                  mensajeConsultaProducto(
                    stand.emprendimiento,
                    producto.nombre,
                  ),
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
              >
                <IconoWhatsapp className="size-4" />
                Consultar por este producto
              </a>
            )
          )}
        </div>
      </div>
    </article>
  );
}
