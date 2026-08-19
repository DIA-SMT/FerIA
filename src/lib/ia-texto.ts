import { obtenerClienteIA } from "@/lib/ai";
import { MAXIMO_DESCRIPCION, type ModoRedaccion } from "@/lib/redaccion";

/**
 * Redacción asistida de la descripción del emprendimiento, vía OpenRouter.
 *
 * El resultado **nunca** se guarda solo: se le muestra al feriante para que lo
 * acepte, pida otro o lo descarte, y si lo acepta puede volver a su texto.
 *
 * ⚠️ La lección de la edición de fotos aplica igual acá, y es la que da forma a
 * todo el prompt: cuando al modelo le falta material, lo inventa. En una foto eso
 * dio una manta que no estaba en la imagen; en un texto darían años de
 * trayectoria, premios o materiales que el emprendimiento no tiene, publicados
 * en un sitio municipal como si fueran ciertos. Por eso la regla que manda es
 * dejar el hueco entre corchetes antes que rellenarlo.
 */

/**
 * Modelo de texto, con variable propia y default explícito.
 *
 * No hereda de ningún «modelo por defecto» genérico: cuando lo hacía, tomaba el
 * modelo de imagen que estaba cargado en el `.env` y redactaba con él.
 */
export const MODELO_TEXTO_POR_DEFECTO =
  process.env.OPENROUTER_MODELO_TEXTO ?? "anthropic/claude-sonnet-4.5";

export interface ContextoEmprendimiento {
  /** Nombre del emprendimiento, tal como está en el formulario. */
  nombre: string;
  /** Rubro en castellano (usar `RUBROS[rubro]` de `src/lib/labels.ts`). */
  categoria: string;
  /** Lo que el feriante ya escribió. Vacío o nulo en modo borrador. */
  descripcion?: string | null;
}

export class ErrorDeRedaccion extends Error {}

/**
 * Las prohibiciones van primero y como bloque absoluto.
 *
 * No es estilo: en el prompt de imágenes, la prohibición de dibujar escudos
 * funcionó cuando se movió al encabezado y falló cuando vivía como una regla
 * numerada en el medio. En prompts largos el orden pesa más que la contundencia,
 * así que acá arranca igual.
 */
const PROHIBICIONES = `REGLAS QUE NO SE NEGOCIAN, POR ENCIMA DE CUALQUIER OTRA INSTRUCCIÓN:

· NO inventes ningún dato que no esté en la información de abajo. Nada de años de trayectoria, tamaño del emprendimiento, historia familiar, premios, certificaciones, procesos de producción, materiales, técnicas ni lugares que no estén escritos.
· Si para que el texto cierre hace falta un dato que no tenés, dejá el hueco marcado entre corchetes para que lo complete la persona. Por ejemplo: "Trabajo con [contá con qué materiales]". Un hueco visible es mejor que un dato falso: esto se publica en un sitio de la Municipalidad.
· NO supongas el género de quien produce. No uses adjetivos, participios ni pronombres en femenino ni en masculino referidos a esa persona: escribí "lo tiño yo" y no "yo misma", "quien produce" y no "la artesana". El formulario no pide el género y no hay de dónde deducirlo.
· NO escribas precios, descuentos ni promociones.
· NO escribas teléfonos, direcciones, correos, redes ni enlaces: cada uno tiene su propio campo en el formulario.
· NO uses emojis, hashtags, mayúsculas sostenidas ni signos de exclamación.`;

const ESTILO = `CÓMO ESCRIBIR:

· Castellano de la Argentina, con voseo. Cercano y simple, como habla quien produce, no como un folleto institucional.
· En primera persona. Si el texto original está en plural ("hacemos", "trabajamos"), mantenelo en plural.
· Entre 350 y 700 caracteres, en uno o dos párrafos.
· Sin clichés de marketing: evitá "pasión por", "lo mejor de", "calidad premium", "experiencia única", "hecho con amor", "desde el corazón de".
· No arranques con "Bienvenidos" ni con el nombre del emprendimiento seguido de signos de admiración.

SALIDA:
Devolvé únicamente el texto de la descripción, listo para pegar en el campo. Sin título, sin comillas alrededor, sin explicaciones, sin ofrecer alternativas.`;

/**
 * Exportado para poder medir el prompt real —tamaño y costo— sin duplicarlo en
 * un script de prueba. Una copia se desincroniza y se mide lo que no se usa.
 */
export function construirPrompt(
  modo: ModoRedaccion,
  emprendimiento: ContextoEmprendimiento,
): string {
  const escrito = emprendimiento.descripcion?.trim();

  const tarea =
    modo === "mejorar"
      ? `TAREA: mejorá la redacción de la descripción que la persona ya escribió.

Corregí ortografía y puntuación, ordená las ideas, mejorá el ritmo y sacá repeticiones. Podés reordenar, no agregar: todo lo que digas tiene que estar en el texto original. Si el original es corto, el resultado también va a ser corto, y está bien.

LO QUE ESCRIBIÓ LA PERSONA:
${escrito}`
      : `TAREA: escribí un primer borrador para que la persona lo edite.

Armá la estructura útil —qué hace, con qué trabaja, qué lo distingue, cómo se le puede encargar— y dejá entre corchetes todo lo concreto que no sepas, con una indicación clara de qué tiene que poner ahí. Casi todo el texto va a ser huecos, y así tiene que ser.

REGLA DURA DE ESTE MODO: no puede quedar ninguna afirmación concreta sin corchetes. Todo lo que diga qué hace, qué tiene, cómo trabaja, qué ofrece o con qué frecuencia, o sale de lo que la persona escribió, o va entre corchetes. Frases como "también tengo piezas listas para llevar" o "trabajo todos los días" están prohibidas si nadie las dijo: no sabés si son ciertas y se publican como si lo fueran.
${
  escrito
    ? `
LO POCO QUE YA ESCRIBIÓ. Conservalo: usá esas palabras, sólo corregidas y ubicadas en la estructura. No las reemplaces por un hueco.
${escrito}`
    : ""
}`;

  return `${PROHIBICIONES}

Escribís la descripción del emprendimiento de un feriante para su stand en el catálogo online de las ferias de la Municipalidad de San Miguel de Tucumán. La lee un vecino que está decidiendo si le compra.

DATOS DEL EMPRENDIMIENTO:

* Nombre: ${emprendimiento.nombre}
* Rubro: ${emprendimiento.categoria}

${tarea}

${ESTILO}`;
}

/**
 * Los modelos suelen envolver la respuesta en comillas o meterle un preámbulo
 * tipo "Acá va la descripción:", pese a pedirles que no. Se limpia en vez de
 * confiar, porque el texto va derecho a un campo que el feriante publica.
 */
function limpiarSalida(bruto: string): string {
  let texto = bruto.trim();

  // Preámbulo: una primera línea corta que termina en dos puntos.
  const salto = texto.indexOf("\n");
  if (salto > 0 && salto < 90 && texto.slice(0, salto).trim().endsWith(":")) {
    texto = texto.slice(salto + 1).trim();
  }

  // Comillas que envuelven todo el texto (rectas o tipográficas).
  const pares: Array<[string, string]> = [
    ['"', '"'],
    ["«", "»"],
    ["“", "”"],
  ];
  for (const [abre, cierra] of pares) {
    if (texto.startsWith(abre) && texto.endsWith(cierra) && texto.length > 2) {
      texto = texto.slice(1, -1).trim();
      break;
    }
  }

  return texto.slice(0, MAXIMO_DESCRIPCION);
}

/**
 * Pide el texto al modelo y lo devuelve limpio.
 *
 * Lanza `ErrorDeRedaccion` con un mensaje legible: quien llama tiene que poder
 * decirle al feriante qué pasó y dejarlo seguir escribiendo a mano.
 */
export async function redactarDescripcionConIA(
  modo: ModoRedaccion,
  emprendimiento: ContextoEmprendimiento,
): Promise<string> {
  const cliente = obtenerClienteIA();

  let respuesta;
  try {
    respuesta = await cliente.chat.completions.create({
      model: MODELO_TEXTO_POR_DEFECTO,
      // 700 caracteres de tope entran cómodos; el margen es para que no corte
      // una oración por la mitad si se pasa un poco.
      max_tokens: 600,
      temperature: 0.7,
      messages: [
        { role: "user", content: construirPrompt(modo, emprendimiento) },
      ],
    });
  } catch (error) {
    throw new ErrorDeRedaccion(
      `No se pudo contactar al servicio de redacción: ${
        error instanceof Error ? error.message : "error desconocido"
      }`,
    );
  }

  const bruto = respuesta.choices?.[0]?.message?.content?.trim();

  if (!bruto) {
    throw new ErrorDeRedaccion("El modelo no devolvió ningún texto.");
  }

  const texto = limpiarSalida(bruto);

  if (texto.length < 40) {
    throw new ErrorDeRedaccion(
      "El modelo devolvió un texto demasiado corto para usarlo.",
    );
  }

  return texto;
}
