import type { ComponenteIcono } from "@/components/ui/iconos";
import { ImagenPortada } from "@/components/ui/imagen";
import { PasadorDeFotos } from "@/components/ui/pasador-de-fotos";

/**
 * Las fotos de un producto, con flechas para pasar de una a otra.
 *
 * Hasta acá un producto podía tener cuatro fotos y **se veía sólo la primera**,
 * en el catálogo del feriante y en el stand público. Las otras tres estaban
 * subidas, ocupaban lugar en el bucket y no las miraba nadie: no había forma de
 * llegar a ellas desde ninguna pantalla.
 *
 * Con una sola foto se comporta exactamente como antes —sin controles, sin
 * puntitos— y con el mismo relleno institucional cuando no hay ninguna. Los
 * controles aparecen recién cuando hay algo adónde ir.
 *
 * **Por qué está partido en dos archivos.** Esto es un Server Component y la
 * parte interactiva vive en `PasadorDeFotos`, que es de cliente. La primera
 * versión era un único archivo con `"use client"` y fallaba en tiempo de
 * ejecución —no en `tsc` ni en `eslint`— con «Functions cannot be passed
 * directly to Client Components»: `icono` es un componente de React, o sea una
 * función, y una función no se puede serializar para cruzar al cliente. Funciona
 * con `ImagenPortada` porque ése es un componente de servidor y la función nunca
 * cruza ninguna frontera.
 *
 * La salida no fue cambiar el ícono por una cadena, sino notar que el ícono sólo
 * existe para el caso «no hay ninguna foto», y ése es justamente el caso en el
 * que no hace falta nada interactivo. Así que la decisión se toma acá, del lado
 * del servidor, y al cliente sólo baja lo que tiene flechas.
 */
export function CarruselDeFotos({
  imagenes,
  alt,
  icono,
  sizes,
  ajuste = "contain",
  className,
}: {
  /** Rutas en Storage, tal como están guardadas. La primera es la portada. */
  imagenes: string[];
  /** Nombre del producto: es la base del texto alternativo de cada foto. */
  alt: string;
  /** Ícono del relleno, sólo para cuando todavía no hay ninguna foto. */
  icono?: ComponenteIcono;
  sizes?: string;
  ajuste?: "cover" | "contain";
  /** La caja, ej. `aspect-square w-full`. */
  className?: string;
}) {
  if (imagenes.length <= 1) {
    return (
      <ImagenPortada
        src={imagenes[0] ?? null}
        alt={alt}
        icono={icono}
        sizes={sizes}
        ajuste={ajuste}
        className={className}
      />
    );
  }

  return (
    <PasadorDeFotos
      imagenes={imagenes}
      alt={alt}
      sizes={sizes}
      ajuste={ajuste}
      className={className}
    />
  );
}
