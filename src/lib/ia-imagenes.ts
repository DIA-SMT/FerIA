import { obtenerClienteIA } from "@/lib/ai";

/**
 * Edición de fotos de producto con un modelo de imagen, vía OpenRouter.
 *
 * Separado de `src/lib/imagenes.ts` a propósito: ese módulo es puro `sharp`,
 * determinista y sin red. Este sale a internet, cuesta plata y puede fallar.
 *
 * ⚠️ Un modelo generativo **redibuja** la imagen. En las pruebas conservó
 * exactamente la etiqueta de un frasco —texto, tilde y todo— pero también
 * agregó un brillo especular y una sombra que no estaban. Por eso el resultado
 * siempre se le muestra al feriante para que elija, nunca se aplica solo.
 */

/** Nano Banana. Configurable porque la familia se renueva seguido. */
export const MODELO_IMAGEN_POR_DEFECTO =
  process.env.OPENROUTER_MODELO_IMAGEN ?? "google/gemini-2.5-flash-image";

/** Datos del producto que se interpolan en el prompt. */
export interface ContextoProducto {
  /** Nombre del producto, tal como lo cargó el feriante. */
  nombre: string;
  /** Rubro en castellano (usar `RUBROS[rubro]` de `src/lib/labels.ts`). */
  categoria: string;
  /** Descripción del producto. Opcional. */
  descripcion?: string | null;
}

/**
 * El prompt es único para todos los pedidos, a propósito: así el catálogo entero
 * mantiene una estética coherente en lugar de que cada foto se vea distinta.
 *
 * Tres cosas de este texto salieron de probar con fotos reales, y conviene no
 * deshacerlas sin volver a medir:
 *
 * 1. **El bloque de prohibiciones va PRIMERO, antes de todo lo demás.** Cuando
 *    la prohibición de escudos vivía como una regla numerada en el medio, el
 *    modelo generó igual una marca de agua con forma de blasón y letras
 *    ilegibles en una esquina — un sello de apariencia institucional, inventado,
 *    en el catálogo oficial. Moverla al encabezado como bloque absoluto lo
 *    eliminó en las dos corridas de control. En prompts largos el orden pesa más
 *    que la contundencia.
 * 2. **La regla 2 nombra el color explícitamente.** Sin esa aclaración, un
 *    poncho gris frío volvió en crema cálido. Para quien compra un textil el
 *    color es parte del producto.
 * 3. **No se piden acentos de color municipales.** Cuando se pedían, el modelo
 *    pintaba brochazos grandes en las esquinas —justo donde la regla 10 las
 *    quiere libres para la insignia— y lo hacía de forma inconsistente entre
 *    corridas, que rompe la coherencia que busca tener un prompt único. La
 *    identidad municipal la aporta el marco del sitio y la insignia que se
 *    agrega por código.
 *
 * Las cláusulas 2, 3 y 4 son las que sostienen la fidelidad del producto: en las
 * pruebas conservaron la etiqueta de un frasco carácter por carácter, incluidos
 * la tilde de "Tucumán" y el punto medio. Si se toca el prompt, hay que volver a
 * probar con una foto que tenga texto legible.
 */
function construirPrompt(producto: ContextoProducto): string {
  const descripcion = producto.descripcion?.trim();

  return `PROHIBICIONES ABSOLUTAS, POR ENCIMA DE CUALQUIER OTRA INSTRUCCIÓN:

· NO dibujes escudos, sellos, emblemas, blasones, insignias ni marcas de agua de ningún tipo, en ninguna esquina ni en ningún lugar de la imagen.
· NO dibujes logos, isotipos, firmas ni símbolos institucionales.
· NO escribas absolutamente ningún texto, letra, número, palabra ni carácter que no esté ya presente en la fotografía original.
· Las cuatro esquinas de la imagen deben quedar completamente vacías: sólo fondo, sin ningún elemento gráfico.

Editá y mejorá profesionalmente la fotografía de producto proporcionada para publicarla en el catálogo online de ferias municipales.

DATOS DEL PRODUCTO:

* Nombre: ${producto.nombre}
* Categoría: ${producto.categoria}
* Descripción opcional: ${descripcion || "(sin descripción)"}

OBJETIVO VISUAL:
Crear una fotografía comercial cuadrada, aesthetic, moderna, cálida y coherente con un marketplace municipal de feriantes y emprendedores locales. La imagen debe sentirse artesanal, cercana, cuidada y profesional, sin parecer una publicidad institucional rígida.

REGLAS PRIORITARIAS:

1. El producto original debe ser el protagonista absoluto y ocupar aproximadamente entre el 75 % y el 85 % de la composición.
2. Conservá fielmente todas sus características reales: forma, cantidad, colores, materiales, proporciones, texturas, estampados, etiquetas, envase, terminaciones y detalles distintivos. En particular, conservá EXACTAMENTE la temperatura del color —no pases un gris o un blanco frío a un tono cálido ni al revés— y la disposición de los estampados: no agregues, quites ni reordenes franjas, rayas ni motivos.
3. No rediseñes el producto. No cambies su marca, contenido, cantidad, tamaño relativo, sabor, ingredientes, modelo, color ni presentación.
4. No inventes características que no estén visibles. No agregues ingredientes, accesorios, certificaciones, textos, precios, promociones, beneficios ni elementos que puedan confundir al comprador.
5. Mejorá de forma natural la nitidez, iluminación, exposición, balance de blancos, contraste, profundidad, perspectiva y definición. Reducí ruido, desenfoque accidental, sombras duras y reflejos molestos, sin producir una apariencia artificial o excesivamente retocada.
6. Si la fotografía original tiene un fondo desordenado, oscuro o poco atractivo, reemplazalo por un escenario limpio y minimalista, con iluminación suave de estudio combinada con luz natural.
7. Adaptá sutilmente el escenario a la categoría detectada. Utilizá únicamente uno o dos detalles contextuales secundarios, simples y ligeramente desenfocados. Estos elementos deben ayudar a ambientar la imagen sin competir con el producto ni introducir información engañosa.
8. Usá como base tonos blancos cálidos, crema, gris muy claro, madera clara o superficies neutras. No agregues acentos de color saturados ni formas pintadas: el fondo se mantiene neutro y sobrio en toda la composición.
9. No generes el logo municipal, escudos, marcas de agua ni símbolos institucionales. El logo oficial será añadido posteriormente mediante código.
10. Mantené el producto centrado o levemente desplazado según resulte más atractivo. Dejá suficiente espacio limpio alrededor y mantené las cuatro esquinas visualmente despejadas para permitir que el sistema coloque posteriormente una pequeña insignia municipal en la esquina menos ocupada.
11. Aplicá una sombra de contacto suave y realista para que el producto no parezca flotando. Usá profundidad de campo delicada, detalles nítidos sobre el producto y fondo suavemente desenfocado.
12. Evitá fondos saturados, colores fuertes dominantes, decoraciones excesivas, aspecto plástico, filtros agresivos, estilo futurista, apariencia genérica de banco de imágenes o estética de folleto gubernamental.
13. No recortes ninguna parte importante del producto. Mantené un margen de seguridad visual mínimo del 8 % alrededor del objeto principal.

SALIDA:
Generá una única imagen final en formato cuadrado 1:1, sin texto añadido, sin bordes, sin marcos, sin logo y sin marcas de agua visuales. La imagen debe estar lista para formar parte de un catálogo digital coherente, atractivo y profesional.`;
}

export class ErrorDeIA extends Error {}

/**
 * Manda la foto al modelo y devuelve la imagen editada.
 *
 * ⚠️ `entrada` tiene que venir **ya encuadrada en cuadrado** (ver
 * `encuadrarSinRetocar`). El modelo devuelve la proporción de lo que recibe, no
 * el 1:1 que le pide el prompt, así que mandarle la foto cruda obliga a recortar
 * después y con una foto vertical eso corta el producto por arriba y por abajo.
 * Medido: 1200x1200 a la entrada devuelve 1024x1024.
 *
 * Lanza `ErrorDeIA` con un mensaje legible: quien llama tiene que poder
 * mostrarle al feriante qué pasó y ofrecerle seguir con su foto original.
 */
export async function mejorarFotoConIA(
  entrada: Buffer,
  tipoMime: string,
  producto: ContextoProducto,
): Promise<Buffer> {
  const cliente = obtenerClienteIA();
  const base64 = entrada.toString("base64");

  let respuesta;
  try {
    respuesta = await cliente.chat.completions.create({
      model: MODELO_IMAGEN_POR_DEFECTO,
      // OpenRouter necesita que se declare que se espera una imagen de vuelta;
      // sin esto responde sólo texto describiendo lo que haría.
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: construirPrompt(producto) },
            {
              type: "image_url",
              image_url: { url: `data:${tipoMime};base64,${base64}` },
            },
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

  // La imagen vuelve como data URL en `message.images`, que no está en los tipos
  // del SDK de OpenAI porque es una extensión de OpenRouter.
  const mensaje = (
    respuesta as unknown as {
      choices?: Array<{
        message?: {
          images?: Array<{ image_url?: { url?: string } }>;
          content?: string | null;
        };
      }>;
    }
  ).choices?.[0]?.message;

  const url = mensaje?.images?.[0]?.image_url?.url;

  if (!url) {
    // Pasa cuando el modelo decide contestar con texto en lugar de una imagen
    // (por ejemplo si interpreta la foto como algo que no debe editar).
    const texto = mensaje?.content?.slice(0, 200);
    throw new ErrorDeIA(
      texto
        ? `El modelo respondió con texto en lugar de una imagen: "${texto}"`
        : "El modelo no devolvió ninguna imagen.",
    );
  }

  const datos = url.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(datos, "base64");

  if (buffer.length === 0) {
    throw new ErrorDeIA("El modelo devolvió una imagen vacía.");
  }

  return buffer;
}
