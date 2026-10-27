"use server";

import { esControlDeFlujoDeNext } from "@/lib/errores";
import {
  carpetaDelVendedor,
  type EstadoVariantes,
  type Variante,
} from "@/lib/fotos-producto";
import { ErrorDeIA, mejorarFotoConIA } from "@/lib/ia-imagenes";
import {
  aplicarInsigniaMunicipal,
  describirAjustes,
  encuadrarSinRetocar,
  normalizarSalidaIA,
  procesarFotoProducto,
} from "@/lib/imagenes";
import { RUBROS } from "@/lib/labels";
import { urlPublica } from "@/lib/media";
import { requerirVendedorAprobado } from "@/lib/session";
import { almacenamiento, validarImagen } from "@/lib/storage";

/**
 * Generación de las variantes de una foto de producto.
 *
 * El feriante sube una foto y, si pide la IA, elige entre dos versiones antes
 * de guardar: la suya acomodada y la editada. Las dos se suben a Storage acá; al
 * guardar el producto se conserva la elegida y se borra la otra (ver
 * `carpetaDelVendedor` para por qué eso es seguro).
 *
 * Que se suban ya —en lugar de rehacerlas al guardar— es por la de IA: cuesta
 * plata y once segundos, y regenerarla para guardarla sería pagarla dos veces.
 * La de `sharp` se sube también para que las dos se traten igual.
 *
 * Los tipos y las rutas están en `@/lib/fotos-producto`: acá sólo puede haber
 * funciones async.
 *
 * `maxDuration` NO puede declararse en este archivo, aunque sea el que tarda:
 * es `"use server"` y el compilador rechaza cualquier export que no sea una
 * función async («Only async functions are allowed to be exported in a
 * "use server" file»). Es configuración de segmento de ruta, así que vive en las
 * páginas desde las que se dispara esta acción —
 * `src/app/mi-stand/productos/nuevo/page.tsx` y
 * `src/app/mi-stand/productos/[id]/page.tsx`—, que es donde Vercel la lee para
 * dimensionar la función. Las dos la declaran en 60 segundos: con IA la llamada
 * mide ~11 s más el `sharp` y las subidas a Storage, y el límite por defecto de
 * la función corta antes.
 */

export async function generarVariantesDeFoto(
  _estado: EstadoVariantes,
  datos: FormData,
): Promise<EstadoVariantes> {
  try {
    const { vendedor } = await requerirVendedorAprobado();

    const archivo = datos.get("foto");
    if (!(archivo instanceof File) || archivo.size === 0) {
      return { ok: false, mensaje: "Elegí una foto." };
    }
    validarImagen(archivo);

    const entrada = Buffer.from(await archivo.arrayBuffer());
    const carpeta = carpetaDelVendedor(vendedor.id);
    const usarIA = datos.get("usarIA") === "on";

    const subir = (contenido: Buffer) =>
      almacenamiento.guardarBuffer(contenido, "productos", { carpeta });

    // --- La foto del feriante, acomodada (determinista, ~300 ms) -----------
    // Es el «antes» de la comparación y también lo que se publica cuando no se
    // pide la IA, así que se hace siempre.
    const procesada = await procesarFotoProducto(entrada);
    const conInsignia = await aplicarInsigniaMunicipal(procesada.contenido);
    const rutaProcesada = await subir(conInsignia.contenido);

    const variantes: Variante[] = [
      {
        clave: "automatica",
        titulo: "Tu foto",
        detalle: describirAjustes(procesada.ajustes).join(" · "),
        ruta: rutaProcesada,
        url: urlDe(rutaProcesada),
      },
    ];

    if (!usarIA) return { ok: true, variantes };

    // --- Con IA ------------------------------------------------------------
    // Si falla, se devuelve la determinista con el error al lado: el feriante
    // puede seguir sin depender de que OpenRouter responda.
    try {
      // Sin retocar: no se publica nunca, es sólo la entrada del modelo.
      const sinRetocar = await encuadrarSinRetocar(entrada);

      // Va la versión ya encuadrada y NO la foto cruda: el modelo devuelve la
      // proporción de lo que recibe, así que entrándole un cuadrado devuelve un
      // cuadrado y no hay nada que recortar después. Con la foto cruda vertical
      // devolvía 864x1184 y el cuadrado se comía 13,5 % arriba y abajo: en un
      // poncho colgado eso es la percha y los flecos.
      const editada = await mejorarFotoConIA(sinRetocar, "image/webp", {
        nombre: String(datos.get("nombre") ?? "").trim() || "Producto artesanal",
        categoria: RUBROS[vendedor.rubro],
        descripcion: String(datos.get("descripcion") ?? ""),
      });

      const conInsigniaIA = await aplicarInsigniaMunicipal(
        await normalizarSalidaIA(editada),
      );
      const rutaIA = await subir(conInsigniaIA.contenido);

      variantes.push({
        clave: "ia",
        titulo: "Mejorada con IA",
        // El aviso no es de trámite: si la foto no muestra claramente el
        // producto que dice el nombre, el modelo se guía por el texto y lo
        // inventa. Medido: una foto de la feria con nombre «poncho» devolvió una
        // manta que no estaba en la foto. Por eso el «después» nunca viene
        // marcado: elegirlo es una decisión del feriante, no el default.
        detalle: "Generada: revisá que sea tu producto",
        ruta: rutaIA,
        url: urlDe(rutaIA),
      });

      return { ok: true, variantes };
    } catch (error) {
      if (esControlDeFlujoDeNext(error)) throw error;
      return {
        ok: true,
        variantes,
        errorIA:
          error instanceof ErrorDeIA
            ? error.message
            : "No se pudo generar la versión con IA. Podés seguir con tu foto.",
      };
    }
  } catch (error) {
    if (esControlDeFlujoDeNext(error)) throw error;
    return {
      ok: false,
      mensaje:
        error instanceof Error ? error.message : "No se pudo procesar la foto.",
    };
  }
}

/** `urlPublica` puede devolver `null`; acá la ruta siempre existe. */
function urlDe(ruta: string): string {
  return urlPublica(ruta) ?? "";
}
