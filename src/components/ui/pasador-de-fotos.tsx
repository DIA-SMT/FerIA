"use client";

import { useState } from "react";

import {
  IconoChevronDerecha,
  IconoChevronIzquierda,
} from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import { cn } from "@/lib/cn";

/**
 * La parte interactiva de `CarruselDeFotos`: las flechas y el estado.
 *
 * Está en su propio archivo porque `"use client"` se aplica por archivo, y la
 * decisión de si hace falta un carrusel conviene tomarla en el servidor. Ver el
 * comentario de `carrusel-de-fotos.tsx`: no es una separación de prolijidad,
 * es lo que permite que el componente de arriba siga recibiendo un ícono.
 *
 * Acá no hay prop `icono` justamente por eso: a este componente sólo se llega
 * con dos fotos o más, así que el relleno de «todavía no hay imagen» no puede
 * aparecer nunca.
 */
export function PasadorDeFotos({
  imagenes,
  alt,
  sizes,
  ajuste = "contain",
  className,
}: {
  imagenes: string[];
  alt: string;
  sizes?: string;
  ajuste?: "cover" | "contain";
  className?: string;
}) {
  const [indice, setIndice] = useState(0);

  // Qué fotos ya se mostraron alguna vez. Las que nunca se miraron no se
  // montan, así que abrir el catálogo sigue bajando una sola imagen por
  // producto; las que ya se vieron quedan montadas e invisibles, y volver atrás
  // es instantáneo en vez de un cuadrado en blanco esperando la descarga.
  const [vistas, setVistas] = useState<ReadonlySet<number>>(() => new Set([0]));

  /** Va a una foto dando la vuelta: con dos fotos las dos flechas alternan. */
  function ir(destino: number): void {
    const normalizado = (destino + imagenes.length) % imagenes.length;
    setIndice(normalizado);
    setVistas((previas) => new Set(previas).add(normalizado));
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {imagenes.map((ruta, posicion) => {
        if (!vistas.has(posicion)) return null;
        const actual = posicion === indice;

        return (
          <ImagenPortada
            key={ruta}
            src={ruta}
            alt={`${alt} — foto ${posicion + 1} de ${imagenes.length}`}
            sizes={sizes}
            ajuste={ajuste}
            // `invisible` y no `hidden`: con `display: none` el navegador puede
            // soltar la imagen decodificada y el cambio vuelve a parpadear.
            className={cn("absolute inset-0", !actual && "invisible")}
          />
        );
      })}

      {/* Fondo blanco sólido en los controles, no translúcido sobre la foto:
          abajo puede haber un poncho claro o una vasija negra, y es lo único
          que garantiza que la flecha se vea en las dos. */}
      <BotonFlecha
        hacia="anterior"
        onClick={() => ir(indice - 1)}
        className="left-2"
      />
      <BotonFlecha
        hacia="siguiente"
        onClick={() => ir(indice + 1)}
        className="right-2"
      />

      {/* Los puntitos no son botones: a este tamaño el blanco de toque quedaría
          muy por debajo de los 24 px que hacen falta para un dedo, y agrandarlos
          se comería la foto. Dicen cuántas hay y en cuál estás; para moverse
          están las flechas, y el lector de pantalla lo saca del «foto 2 de 4».*/}
      <div
        aria-hidden="true"
        className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/85 px-2 py-1.5 shadow-sm"
      >
        {imagenes.map((ruta, posicion) => (
          <span
            key={ruta}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              posicion === indice ? "bg-slate-900" : "bg-slate-400",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function BotonFlecha({
  hacia,
  onClick,
  className,
}: {
  hacia: "anterior" | "siguiente";
  onClick: () => void;
  className?: string;
}) {
  const Icono =
    hacia === "anterior" ? IconoChevronIzquierda : IconoChevronDerecha;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        hacia === "anterior" ? "Ver la foto anterior" : "Ver la foto siguiente"
      }
      className={cn(
        "absolute top-1/2 flex size-8 -translate-y-1/2 items-center justify-center",
        "rounded-full bg-white/90 text-slate-700 shadow-sm transition-colors",
        "hover:bg-white hover:text-slate-900",
        "focus-visible:ring-2 focus-visible:ring-municipal-500 focus-visible:outline-none",
        className,
      )}
    >
      <Icono className="size-4" />
    </button>
  );
}
