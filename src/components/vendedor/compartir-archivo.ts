/**
 * Compartir una imagen que arma el servidor: en el celular abre el menú de
 * compartir del teléfono (WhatsApp, Instagram…); en la compu, donde no hay a
 * dónde compartir un archivo, la descarga.
 *
 * Devuelve lo que hay que decirle a la persona, o `null` si no hace falta
 * decir nada (la compartió, o cerró el menú sin elegir).
 */
export async function compartirImagen(
  url: string,
  nombreDelArchivo: string,
  texto: string,
): Promise<string | null> {
  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error("sin imagen");
    const archivo = new File([await respuesta.blob()], nombreDelArchivo, {
      type: "image/png",
    });
    if (navigator.canShare?.({ files: [archivo] })) {
      await navigator.share({ files: [archivo], text: texto });
      return null;
    }
    const enlaceTemporal = document.createElement("a");
    enlaceTemporal.href = URL.createObjectURL(archivo);
    enlaceTemporal.download = nombreDelArchivo;
    enlaceTemporal.click();
    URL.revokeObjectURL(enlaceTemporal.href);
    return "Se descargó la imagen. Desde el celular, este botón la manda directo a WhatsApp o Instagram.";
  } catch (error) {
    // Cerrar el menú de compartir sin elegir nada no es un error.
    if (error instanceof DOMException && error.name === "AbortError") {
      return null;
    }
    return "No se pudo armar la imagen. Probá de nuevo en un momento.";
  }
}

/** «Dulces de Tita» → «catalogo-dulces-de-tita.png». */
export function nombreDeArchivo(
  prefijo: string,
  emprendimiento: string,
): string {
  const base = emprendimiento
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefijo}-${base}.png`;
}
