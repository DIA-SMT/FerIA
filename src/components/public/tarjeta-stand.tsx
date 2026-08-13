import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { IconoTienda } from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import { RUBROS } from "@/lib/labels";
import type { Rubro } from "@prisma/client";

export interface StandResumido {
  slug: string;
  emprendimiento: string;
  rubro: Rubro;
  descripcion: string | null;
  imagenPortada: string | null;
  logo: string | null;
  cantidadProductos: number;
}

export function TarjetaStand({
  stand,
  prioridad = false,
}: {
  stand: StandResumido;
  prioridad?: boolean;
}) {
  return (
    <Link
      href={`/stands/${stand.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-tarjeta)] transition-all hover:-translate-y-0.5 hover:border-celeste-300 hover:shadow-[var(--shadow-tarjeta-hover)]"
    >
      <ImagenPortada
        src={stand.imagenPortada}
        alt={stand.emprendimiento}
        icono={IconoTienda}
        prioridad={prioridad}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        className="aspect-[16/9] w-full"
      />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <Avatar
            nombre={stand.emprendimiento}
            imagen={stand.logo}
            tamanio="md"
            // Se superpone al borde de la portada, como en una vidriera.
            className="-mt-9 ring-2 ring-white"
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="truncate font-semibold text-slate-900 transition-colors group-hover:text-municipal-700">
              {stand.emprendimiento}
            </h3>
            <Badge tono="celeste" tamanio="sm" className="mt-1">
              {RUBROS[stand.rubro]}
            </Badge>
          </div>
        </div>

        {stand.descripcion && (
          <p className="lineas-3 mt-3 text-sm text-slate-600">
            {stand.descripcion}
          </p>
        )}

        <p className="mt-auto pt-4 text-xs text-slate-500">
          {stand.cantidadProductos === 0
            ? "Catálogo en preparación"
            : `${stand.cantidadProductos} ${
                stand.cantidadProductos === 1 ? "producto" : "productos"
              } en el catálogo`}
        </p>
      </div>
    </Link>
  );
}
