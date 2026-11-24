import sharp from "sharp";

import { obtenerClienteIA } from "@/lib/ai";
import { ErrorDeIA, MODELO_IMAGEN_POR_DEFECTO } from "@/lib/ia-imagenes";

/*
  La escena de la imagen publicitaria: el modelo de imagen pone las fotos
  reales de los productos en una composición de campaña, para Instagram.

  Lo que NO hace el modelo es escribir: el título, el nombre, el WhatsApp y el
  Instagram los pone el código encima (`imagenPublicitaria` en
  imagen-catalogo.tsx). Un modelo de imagen escribe letras deformes y cambia
  números, y un WhatsApp con un dígito equivocado es peor que ninguno. Por eso
  la prohibición de texto va primero, como en `ia-imagenes.ts`, donde se
  aprendió que en un prompt largo el orden pesa más que la contundencia.
*/

/**
 * La escena es siempre 4:5. En 9:16 el modelo no llena el cuadro: arma una
 * foto apaisada y rellena arriba y abajo con franjas borroneadas. Para una
 * historia, el diseño vertical lo arma el código alrededor de esta misma
 * escena, y así cambiar de formato no cuesta otra imagen.
 */
const PROPORCION = "4:5";

export interface ContextoPublicidad {
  /** Los nombres de los productos, en el orden de las fotos. */
  productos: string[];
  /** Rubro en castellano. */
  rubro: string;
  /** Una fecha comercial cercana, si la hay: «Navidad». */
  ocasion?: string | null;
}

function construirPrompt(contexto: ContextoPublicidad): string {
  const varios = contexto.productos.length > 1;
  return `PROHIBICIONES ABSOLUTAS, POR ENCIMA DE CUALQUIER OTRA INSTRUCCIÓN:

· NO escribas ningún texto, letra, número, palabra ni carácter en la imagen.
· NO dibujes logos, escudos, sellos, insignias, marcas de agua ni símbolos de ningún tipo. Si las fotos tienen una pequeña insignia o marca en una esquina, ignorala: no la copies.
· NO muestres personas, manos ni caras.

Creá una imagen publicitaria para Instagram de un emprendimiento de las ferias de San Miguel de Tucumán (Argentina), a partir de ${varios ? "las fotos de producto" : "la foto de producto"} que te paso.

${varios ? "PRODUCTOS" : "PRODUCTO"} (rubro ${contexto.rubro}): ${contexto.productos.join("; ")}.

REGLAS:
1. ${varios ? "Los productos de las fotos son los protagonistas y tienen" : "El producto de la foto es el protagonista y tiene"} que verse IGUAL a la foto: misma forma, cantidad, colores, materiales, ingredientes, envase y presentación. No lo rediseñes, no le agregues ni le saques nada, no cambies su tamaño relativo. Si un producto tiene varias piezas (dos mates, tres alfajores, un juego de tazas), mostralas todas, enteras y dentro del cuadro.
2. Ponelo en una escena comercial y atractiva, como la foto de campaña de una marca: iluminación cálida de estudio, colores vivos pero naturales, profundidad de campo, y uno o dos elementos de ambientación acordes al rubro${contexto.ocasion ? ` y a ${contexto.ocasion}` : ""}, que no puedan confundirse con parte del producto.${varios ? "\n3. Armá una composición donde se vean todos los productos, sin que ninguno tape a otro." : ""}
${varios ? "4" : "3"}. Dejá libre, sin elementos importantes, el cuarto superior de la imagen y una franja abajo: ahí va texto que se agrega después. Esas zonas son parte de la misma escena (la pared, el fondo desenfocado, la mesa): la escena llena todo el cuadro de arriba a abajo, sin franjas, bordes, marcos ni partes borroneadas para rellenar.
${varios ? "5" : "4"}. Que se vea profesional y deseable, no un folleto ni un banco de imágenes.

SALIDA: una sola imagen, sin texto, sin bordes y sin marcos.`;
}

/**
 * Pide la escena. Recibe las fotos tal como están guardadas y devuelve la
 * imagen generada. Lanza `ErrorDeIA` con un mensaje legible.
 */
export async function generarEscenaPublicitaria(
  fotos: Buffer[],
  contexto: ContextoPublicidad,
): Promise<Buffer> {
  const cliente = obtenerClienteIA("imagen");

  // Más chicas que las originales: alcanza para que el modelo las respete y
  // la consulta pesa la mitad.
  const imagenes = await Promise.all(
    fotos.map(async (foto) => {
      const jpeg = await sharp(foto)
        .rotate()
        .resize({ width: 900, height: 900, fit: "inside" })
        .jpeg({ quality: 85 })
        .toBuffer();
      return {
        type: "image_url" as const,
        image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
      };
    }),
  );

  let respuesta;
  try {
    respuesta = await cliente.chat.completions.create({
      model: MODELO_IMAGEN_POR_DEFECTO,
      modalities: ["image", "text"],
      image_config: { aspect_ratio: PROPORCION },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: construirPrompt(contexto) },
            ...imagenes,
          ],
        },
      ],
    } as never);
  } catch (error) {
    throw new ErrorDeIA(
      `No se pudo contactar al servicio de imágenes: ${
        error instanceof Error ? error.message : "error desconocido"
      }`,
    );
  }

  const mensaje = (
    respuesta as unknown as {
      choices?: Array<{
        message?: { images?: Array<{ image_url?: { url?: string } }> };
      }>;
    }
  ).choices?.[0]?.message;
  const url = mensaje?.images?.[0]?.image_url?.url;
  if (!url) throw new ErrorDeIA("El modelo no devolvió ninguna imagen.");

  const buffer = Buffer.from(
    url.replace(/^data:image\/\w+;base64,/, ""),
    "base64",
  );
  if (buffer.length === 0) {
    throw new ErrorDeIA("El modelo devolvió una imagen vacía.");
  }
  return buffer;
}
