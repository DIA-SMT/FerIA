import { Badge } from "@/components/ui/badge";
import { IconoEtiqueta, IconoWhatsapp } from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import { formatearMoneda, type ValorDecimal } from "@/lib/format";
import { linkWhatsapp, mensajeConsultaProducto } from "@/lib/whatsapp";

export interface ProductoPublico {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: ValorDecimal;
  imagenes: string[];
  disponible: boolean;
}

interface PropsTarjetaProducto {
  producto: ProductoPublico;
  emprendimiento: string;
  whatsapp: string;
}

export function TarjetaProducto({
  producto,
  emprendimiento,
  whatsapp,
}: PropsTarjetaProducto) {
  const portada = producto.imagenes[0] ?? null;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative">
        <ImagenPortada
          src={portada}
          alt={producto.nombre}
          icono={IconoEtiqueta}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="aspect-square w-full"
        />
        {!producto.disponible && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Badge tono="neutro">Sin stock</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-slate-900">{producto.nombre}</h3>

        {producto.descripcion && (
          <p className="lineas-3 mt-1 text-sm text-slate-600">
            {producto.descripcion}
          </p>
        )}

        <p className="mt-3 text-lg font-bold text-municipal-700">
          {formatearMoneda(producto.precio)}
        </p>

        {producto.disponible && (
          <a
            href={linkWhatsapp(
              whatsapp,
              mensajeConsultaProducto(emprendimiento, producto.nombre),
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            <IconoWhatsapp className="size-4" />
            Consultar por este producto
          </a>
        )}
      </div>
    </article>
  );
}
