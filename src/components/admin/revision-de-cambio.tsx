import type { Rubro, SeccionDelStand } from "@prisma/client";
import Image from "next/image";
import type { ReactNode } from "react";

import { AccionesRevision } from "@/components/admin/acciones-revision";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatearFechaHora } from "@/lib/format";
import { RUBROS } from "@/lib/labels";
import { urlPublica } from "@/lib/media";
import {
  esProductoNuevo,
  leerDatos,
  type DatosContacto,
} from "@/lib/revision";

/** Lo publicado del feriante, para comparar. */
export interface StandPublicado extends DatosContacto {
  emprendimiento: string;
  rubro: Rubro;
  descripcion: string | null;
  imagenPortada: string | null;
  logo: string | null;
}

/** Lo publicado del producto, para comparar. `null` si ya no existe. */
export interface ProductoPublicado {
  nombre: string;
  descripcion: string | null;
  imagenes: string[];
  destacado: boolean;
}

export interface CambioParaRevisar {
  id: string;
  seccion: SeccionDelStand;
  datos: unknown;
  actualizadoEn: Date;
}

const TITULOS: Record<SeccionDelStand, string> = {
  PORTADA: "Portada",
  LOGO: "Logo",
  IDENTIDAD: "Nombre y rubro",
  DESCRIPCION: "Descripción",
  CONTACTO: "Contacto y redes",
  PRODUCTO: "Producto",
};

function Foto({
  ruta,
  forma,
  alt,
}: {
  ruta: string | null;
  forma: "apaisada" | "cuadrada";
  alt: string;
}) {
  const url = urlPublica(ruta);
  const marco = forma === "apaisada" ? "aspect-[16/7] w-full" : "size-28";
  if (!url) {
    return (
      <div
        className={cn(
          marco,
          "flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400",
        )}
      >
        Sin foto
      </div>
    );
  }
  return (
    <div className={cn(marco, "relative overflow-hidden rounded-lg ring-1 ring-slate-200")}>
      <Image src={url} alt={alt} fill sizes="320px" className="object-cover" />
    </div>
  );
}

/** «Ahora» a la izquierda, «Propuesta» a la derecha. */
function Comparacion({ antes, despues }: { antes: ReactNode; despues: ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Ahora
        </p>
        {antes}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-municipal-700 uppercase">
          Propuesta
        </p>
        {despues}
      </div>
    </div>
  );
}

function Texto({ valor }: { valor: string | null }) {
  return valor ? (
    <p className="text-sm whitespace-pre-line text-slate-800">{valor}</p>
  ) : (
    <p className="text-sm text-slate-400 italic">Vacío</p>
  );
}

/** Sólo los campos que cambian, uno por fila. */
function Diferencias({
  filas,
}: {
  filas: Array<{ etiqueta: string; antes: string | null; despues: string | null }>;
}) {
  const cambian = filas.filter((fila) => (fila.antes ?? "") !== (fila.despues ?? ""));
  if (cambian.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Guardó lo mismo que ya estaba publicado.
      </p>
    );
  }
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      {cambian.map((fila) => (
        <div key={fila.etiqueta} className="grid gap-1 py-2 sm:grid-cols-[9rem_1fr_1fr] sm:gap-3">
          <dt className="font-medium text-slate-500">{fila.etiqueta}</dt>
          <dd className="text-slate-500 line-through decoration-slate-300">
            {fila.antes || <span className="italic no-underline">vacío</span>}
          </dd>
          <dd className="font-medium text-slate-900">
            {fila.despues || <span className="font-normal text-slate-400 italic">vacío</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Fotos({ rutas, alt }: { rutas: string[]; alt: string }) {
  if (rutas.length === 0) {
    return <p className="text-sm text-slate-400 italic">Sin fotos</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {rutas.map((ruta) => (
        <div key={ruta} className="relative size-24 overflow-hidden rounded-lg ring-1 ring-slate-200">
          <Image src={urlPublica(ruta) ?? ""} alt={alt} fill sizes="96px" className="object-contain" />
        </div>
      ))}
    </div>
  );
}

function Detalle({
  cambio,
  stand,
  producto,
}: {
  cambio: CambioParaRevisar;
  stand: StandPublicado;
  producto: ProductoPublicado | null;
}) {
  switch (cambio.seccion) {
    case "PORTADA":
      return (
        <Comparacion
          antes={<Foto ruta={stand.imagenPortada} forma="apaisada" alt="Portada actual" />}
          despues={
            <Foto
              ruta={leerDatos("PORTADA", cambio.datos).imagenPortada}
              forma="apaisada"
              alt="Portada propuesta"
            />
          }
        />
      );
    case "LOGO":
      return (
        <Comparacion
          antes={<Foto ruta={stand.logo} forma="cuadrada" alt="Logo actual" />}
          despues={
            <Foto ruta={leerDatos("LOGO", cambio.datos).logo} forma="cuadrada" alt="Logo propuesto" />
          }
        />
      );
    case "IDENTIDAD": {
      const datos = leerDatos("IDENTIDAD", cambio.datos);
      return (
        <Diferencias
          filas={[
            { etiqueta: "Nombre", antes: stand.emprendimiento, despues: datos.emprendimiento },
            { etiqueta: "Rubro", antes: RUBROS[stand.rubro], despues: RUBROS[datos.rubro] },
          ]}
        />
      );
    }
    case "DESCRIPCION":
      return (
        <Comparacion
          antes={<Texto valor={stand.descripcion} />}
          despues={<Texto valor={leerDatos("DESCRIPCION", cambio.datos).descripcion} />}
        />
      );
    case "CONTACTO": {
      const datos = leerDatos("CONTACTO", cambio.datos);
      return (
        <Diferencias
          filas={[
            { etiqueta: "WhatsApp", antes: stand.whatsapp, despues: datos.whatsapp },
            { etiqueta: "Teléfono", antes: stand.telefono, despues: datos.telefono },
            { etiqueta: "Correo", antes: stand.email, despues: datos.email },
            { etiqueta: "Instagram", antes: stand.instagram, despues: datos.instagram },
            { etiqueta: "Facebook", antes: stand.facebook, despues: datos.facebook },
            { etiqueta: "Sitio web", antes: stand.sitioWeb, despues: datos.sitioWeb },
            { etiqueta: "Dirección (no se publica)", antes: stand.direccion, despues: datos.direccion },
          ]}
        />
      );
    }
    case "PRODUCTO": {
      if (!producto) {
        return <p className="text-sm text-slate-500">El producto ya no existe.</p>;
      }
      const datos = leerDatos("PRODUCTO", cambio.datos);
      if (esProductoNuevo(datos)) {
        return (
          <div className="space-y-3">
            <Fotos rutas={producto.imagenes} alt={producto.nombre} />
            <div>
              <p className="font-semibold text-slate-900">{producto.nombre}</p>
              <Texto valor={producto.descripcion} />
            </div>
          </div>
        );
      }
      const fotosCambian =
        datos.imagenes.join("|") !== producto.imagenes.join("|");
      return (
        <div className="space-y-4">
          <Diferencias
            filas={[
              { etiqueta: "Nombre", antes: producto.nombre, despues: datos.nombre },
              { etiqueta: "Descripción", antes: producto.descripcion, despues: datos.descripcion },
              {
                etiqueta: "Destacado",
                antes: producto.destacado ? "Sí" : "No",
                despues: datos.destacado ? "Sí" : "No",
              },
            ]}
          />
          {fotosCambian && (
            <Comparacion
              antes={<Fotos rutas={producto.imagenes} alt="Fotos actuales" />}
              despues={<Fotos rutas={datos.imagenes} alt="Fotos propuestas" />}
            />
          )}
        </div>
      );
    }
  }
}

/** Un cambio pendiente, con lo que hay, lo propuesto y los botones. */
export function RevisionDeCambio({
  cambio,
  stand,
  producto,
}: {
  cambio: CambioParaRevisar;
  stand: StandPublicado;
  producto: ProductoPublicado | null;
}) {
  const nuevo =
    cambio.seccion === "PRODUCTO" &&
    esProductoNuevo(leerDatos("PRODUCTO", cambio.datos));
  const titulo =
    cambio.seccion === "PRODUCTO"
      ? `${nuevo ? "Producto nuevo" : "Cambios en un producto"}${producto ? `: ${producto.nombre}` : ""}`
      : TITULOS[cambio.seccion];

  return (
    <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{titulo}</h3>
        <div className="flex items-center gap-2">
          {nuevo && (
            <Badge tono="celeste" tamanio="sm">
              Nuevo
            </Badge>
          )}
          <span className="text-xs text-slate-500">
            {formatearFechaHora(cambio.actualizadoEn)}
          </span>
        </div>
      </header>
      <Detalle cambio={cambio} stand={stand} producto={producto} />
      <div className="border-t border-slate-100 pt-3">
        <AccionesRevision cambioId={cambio.id} emprendimiento={stand.emprendimiento} />
      </div>
    </article>
  );
}
