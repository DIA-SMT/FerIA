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
 * El feriante sube una foto y elige entre tres versiones antes de guardar. Las
 * tres se suben a Storage acá: al guardar el producto se conserva la elegida y
 * se borran las otras (ver `carpetaDelVendedor` para por qué eso es seguro).
 *
 * Que las tres se suban ya —en lugar de rehacerlas al guardar— es por la de IA:
 * cuesta plata y once segundos, y regenerarla para guardarla sería pagarla dos
 * veces. Las de `sharp` se suben también para que las tres se traten igual.
 *
 * Los tipos y las rutas están en `@/lib/fotos-producto`: acá sólo puede haber
 * funciones async.
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

    // --- Sin retocar y automática (deterministas, ~300 ms cada una) ---------
    const [sinRetocar, procesada] = await Promise.all([
      encuadrarSinRetocar(entrada),
      procesarFotoProducto(entrada),
    ]);

    const [conInsigniaOriginal, conInsigniaProcesada] = await Promise.all([
      aplicarInsigniaMunicipal(sinRetocar),
      aplicarInsigniaMunicipal(procesada.contenido),
    ]);

    const [rutaOriginal, rutaProcesada] = await Promise.all([
      subir(conInsigniaOriginal.contenido),
      subir(conInsigniaProcesada.contenido),
    ]);

    const variantes: Variante[] = [
      {
        clave: "original",
        titulo: "Tu foto",
        detalle: "Sólo encuadrada, sin retoques",
        ruta: rutaOriginal,
        url: urlDe(rutaOriginal),
      },
      {
        clave: "automatica",
        titulo: "Mejorada",
        detalle: describirAjustes(procesada.ajustes).join(" · "),
        ruta: rutaProcesada,
        url: urlDe(rutaProcesada),
      },
    ];

    if (!usarIA) return { ok: true, variantes };

    // --- Con IA ------------------------------------------------------------
    // Si falla, se devuelven las dos deterministas con el error al lado: el
    // feriante puede seguir sin depender de que OpenRouter responda.
    try {
      const editada = await mejorarFotoConIA(entrada, archivo.type, {
        nombre: String(datos.get("nombre") ?? "").trim() || "Producto artesanal",
        categoria: RUBROS[vendedor.rubro],
        descripcion: String(datos.get("descripcion") ?? ""),
      });

      const conInsignia = await aplicarInsigniaMunicipal(
        await normalizarSalidaIA(editada),
      );
      const rutaIA = await subir(conInsignia.contenido);

      variantes.push({
        clave: "ia",
        titulo: "Editada con IA",
        // El aviso no es de trámite: si la foto no muestra claramente el
        // producto que dice el nombre, el modelo se guía por el texto y lo
        // inventa. Medido: una foto de la feria con nombre «poncho» devolvió una
        // manta que no estaba en la foto. Por eso el radio marcado por defecto
        // es «Mejorada» y no esta.
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
            : "No se pudo generar la versión con IA. Podés seguir con las otras dos.",
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
