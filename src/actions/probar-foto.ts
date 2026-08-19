"use server";

import type { Rubro } from "@prisma/client";

import { esControlDeFlujoDeNext } from "@/lib/errores";
import { ErrorDeIA, mejorarFotoConIA } from "@/lib/ia-imagenes";
import {
  aplicarInsigniaMunicipal,
  describirAjustes,
  normalizarSalidaIA,
  procesarFotoProducto,
} from "@/lib/imagenes";
import { RUBROS } from "@/lib/labels";
import { requerirVendedorAprobado } from "@/lib/session";
import { validarImagen } from "@/lib/storage";

/**
 * Server Action del banco de pruebas de fotos (`/mi-stand/productos/probar-foto`).
 *
 * Sólo existe para evaluar el pipeline con fotos reales antes de decidir la
 * interfaz definitiva. **No guarda nada**: devuelve las variantes como data URL
 * para mirarlas y descartarlas. Cuando se defina la UI real, la versión
 * elegida se subirá a Storage y las otras se descartarán.
 */

export interface ResultadoPrueba {
  ok: boolean;
  mensaje?: string;
  /** Foto pasada por el pipeline determinista de `sharp`. */
  procesada?: { dataUrl: string; peso: number; ms: number; ajustes: string[] };
  /** Foto editada por el modelo de imagen, si se pidió, ya con la insignia. */
  conIA?: {
    dataUrl: string;
    peso: number;
    ms: number;
    /** Dónde cayó la insignia, según qué esquina resultó más despejada. */
    esquina: string;
  };
  /** Mensaje de error propio de la IA, para poder seguir con las otras dos. */
  errorIA?: string;
}

const aDataUrl = (buffer: Buffer) =>
  `data:image/webp;base64,${buffer.toString("base64")}`;

export async function probarFoto(
  _estado: ResultadoPrueba,
  datos: FormData,
): Promise<ResultadoPrueba> {
  try {
    const { vendedor } = await requerirVendedorAprobado();

    const archivo = datos.get("foto");
    if (!(archivo instanceof File) || archivo.size === 0) {
      return { ok: false, mensaje: "Elegí una foto para probar." };
    }
    validarImagen(archivo);

    const entrada = Buffer.from(await archivo.arrayBuffer());
    const usarIA = datos.get("usarIA") === "on";

    // Los datos que se interpolan en el prompt. En el catálogo real el nombre y
    // la descripción salen del formulario del producto y la categoría del rubro
    // del feriante; acá se pueden escribir para probar combinaciones.
    const rubroElegido = String(datos.get("categoria") ?? "");
    const categoria =
      rubroElegido in RUBROS
        ? RUBROS[rubroElegido as Rubro]
        : RUBROS[vendedor.rubro];

    const contexto = {
      nombre: String(datos.get("nombre") ?? "").trim() || "Producto artesanal",
      categoria,
      descripcion: String(datos.get("descripcion") ?? ""),
    };

    // --- Pipeline determinista --------------------------------------------
    const t0 = Date.now();
    const propia = await procesarFotoProducto(entrada);
    const msPropia = Date.now() - t0;

    const resultado: ResultadoPrueba = {
      ok: true,
      procesada: {
        dataUrl: aDataUrl(propia.contenido),
        peso: propia.contenido.length,
        ms: msPropia,
        ajustes: describirAjustes(propia.ajustes),
      },
    };

    if (!usarIA) return resultado;

    // --- Modelo de imagen -------------------------------------------------
    // Si falla, no se cae toda la prueba: se devuelve el error junto con la
    // versión de sharp, que ya está lista.
    try {
      const t1 = Date.now();
      const editada = await mejorarFotoConIA(entrada, archivo.type, contexto);

      // El modelo devuelve 1152x896 aunque el prompt pida 1:1, así que hay que
      // llevarlo al cuadrado del catálogo. Va por `normalizarSalidaIA`, que
      // recorta en lugar de rellenar: rellenar deja franjas blancas que parten
      // la escena ambientada.
      const normalizada = await normalizarSalidaIA(editada);

      // La insignia la pone el código, no el modelo: es la regla 9 del prompt.
      // Un logo dibujado por IA sale deformado — de hecho en una prueba generó
      // un blasón falso con letras ilegibles, que es justo lo que hay que evitar.
      const conInsignia = await aplicarInsigniaMunicipal(normalizada);

      resultado.conIA = {
        dataUrl: aDataUrl(conInsignia.contenido),
        peso: conInsignia.contenido.length,
        ms: Date.now() - t1,
        esquina: conInsignia.esquina,
      };
    } catch (error) {
      if (esControlDeFlujoDeNext(error)) throw error;
      resultado.errorIA =
        error instanceof ErrorDeIA
          ? error.message
          : "Falló la mejora con IA. Probá de nuevo o seguí con tu foto.";
    }

    return resultado;
  } catch (error) {
    if (esControlDeFlujoDeNext(error)) throw error;
    return {
      ok: false,
      mensaje:
        error instanceof Error ? error.message : "No se pudo procesar la foto.",
    };
  }
}
