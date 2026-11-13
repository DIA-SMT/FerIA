import { obtenerClienteIA } from "@/lib/ai";
import {
  MAXIMO_DESCRIPCION,
  MAXIMO_PREGUNTAS,
  respuestasContestadas,
  type RespuestaEntrevista,
} from "@/lib/redaccion";

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
 * en un sitio municipal como si fueran ciertos.
 *
 * Por eso, cuando hay poco escrito, primero se le pregunta a la persona
 * (`generarPreguntasConIA`) y el texto se arma sólo con lo que contestó. Antes
 * se le dejaba un borrador con huecos entre corchetes, que no inventaba pero le
 * dejaba a ella el trabajo de ir reemplazándolos.
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
  /** Lo que el feriante ya escribió. Puede estar vacío. */
  descripcion?: string | null;
}

/** Qué se le pide al modelo: pulir lo escrito o escribir con las respuestas. */
export type TareaRedaccion =
  | { modo: "mejorar" }
  | { modo: "entrevista"; respuestas: RespuestaEntrevista[] };

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
· Si un dato no está, no lo menciones: el texto habla sólo de lo que la persona contó. NO dejes huecos, corchetes ni indicaciones para completar: el texto se publica tal cual en un sitio de la Municipalidad.
· NO supongas el género de quien produce. No uses adjetivos, participios ni pronombres en femenino ni en masculino referidos a esa persona: escribí "lo tiño yo" y no "yo misma", "quien produce" y no "la artesana". El formulario no pide el género y no hay de dónde deducirlo.
· NO escribas precios, descuentos ni promociones.
· NO escribas teléfonos, direcciones, correos, redes ni enlaces: cada uno tiene su propio campo en el formulario.
· NO uses emojis, hashtags, mayúsculas sostenidas ni signos de exclamación.`;

const ESTILO = `CÓMO ESCRIBIR:

· Castellano de la Argentina, con voseo. Cercano y simple, como habla quien produce, no como un folleto institucional.
· En primera persona. Si la persona habla en plural ("hacemos", "trabajamos"), mantenelo en plural.
· Hasta 700 caracteres, en uno o dos párrafos. Si hay poco material, el texto es corto, y está bien: no lo estires con relleno.
· Sin clichés de marketing: evitá "pasión por", "lo mejor de", "calidad premium", "experiencia única", "hecho con amor", "desde el corazón de".
· No arranques con "Bienvenidos" ni con el nombre del emprendimiento seguido de signos de admiración.

SALIDA:
Devolvé únicamente el texto de la descripción, listo para pegar en el campo. Sin título, sin comillas alrededor, sin explicaciones, sin ofrecer alternativas.`;

const ENCUADRE =
  "Escribís la descripción del emprendimiento de un feriante para su stand en el catálogo online de las ferias de la Municipalidad de San Miguel de Tucumán. La lee un vecino que está decidiendo si le compra.";

function datosDelEmprendimiento(emprendimiento: ContextoEmprendimiento): string {
  return `DATOS DEL EMPRENDIMIENTO:

* Nombre: ${emprendimiento.nombre}
* Rubro: ${emprendimiento.categoria}`;
}

/**
 * Exportado para poder medir el prompt real —tamaño y costo— sin duplicarlo en
 * un script de prueba. Una copia se desincroniza y se mide lo que no se usa.
 */
export function construirPrompt(
  tarea: TareaRedaccion,
  emprendimiento: ContextoEmprendimiento,
): string {
  const escrito = emprendimiento.descripcion?.trim();

  const pedido =
    tarea.modo === "mejorar"
      ? `TAREA: mejorá la redacción de la descripción que la persona ya escribió.

Corregí ortografía y puntuación, ordená las ideas, mejorá el ritmo y sacá repeticiones. Podés reordenar, no agregar: todo lo que digas tiene que estar en el texto original. Si el original es corto, el resultado también va a ser corto, y está bien.

LO QUE ESCRIBIÓ LA PERSONA:
${escrito}`
      : `TAREA: escribí la descripción con lo que la persona contestó en una entrevista corta.

Usá sólo lo que dicen las respuestas${escrito ? " y lo que ya había escrito" : ""}. Ordenalo, corregí la ortografía y redactalo bien, pero no agregues nada: si una respuesta es corta, lo que digas de ese tema también. Las preguntas están para que entiendas a qué responde cada cosa, no para cubrirlas todas.

No deduzcas ni completes: si contó que lleva la comida lista, no digas dónde la cocina; si nombró un material, no digas de dónde lo saca. Tampoco sumes muletillas o remates que la persona no dijo para darle color: cada frase tiene que poder señalar de qué respuesta sale.
${
  escrito
    ? `
LO QUE YA HABÍA ESCRITO. Conservalo: usá esas palabras, corregidas y ubicadas en el texto.
${escrito}
`
    : ""
}
LA ENTREVISTA:
${respuestasContestadas(tarea.respuestas)
  .map((r) => `P: ${r.pregunta}\nR: ${r.respuesta}`)
  .join("\n\n")}`;

  return `${PROHIBICIONES}

${ENCUADRE}

${datosDelEmprendimiento(emprendimiento)}

${pedido}

${ESTILO}`;
}

/**
 * Las preguntas de la entrevista.
 *
 * Las adapta el modelo al rubro y a lo que ya está escrito, porque a una
 * cocina hay que preguntarle por platos e ingredientes y a un taller de cuero
 * por materiales y técnicas. Una lista fija serviría para todos y no le
 * hablaría a ninguno.
 */
export function construirPromptPreguntas(
  emprendimiento: ContextoEmprendimiento,
): string {
  const escrito = emprendimiento.descripcion?.trim();

  return `Ayudás a un feriante a escribir la descripción de su emprendimiento para su stand en el catálogo online de las ferias de la Municipalidad de San Miguel de Tucumán. En vez de escribirla vos, primero le hacés unas preguntas cortas, que contesta de a una. Con sus respuestas se arma después el texto.

${datosDelEmprendimiento(emprendimiento)}
${
  escrito
    ? `
LO QUE YA ESCRIBIÓ:
${escrito}
`
    : ""
}
TAREA: escribí 4 o 5 preguntas para conseguir lo que hace falta en una buena descripción: qué hace o vende, con qué trabaja (materiales, ingredientes, técnicas), qué lo distingue, si toma encargos o trabaja a pedido, y lo que sea propio de su rubro. Adaptalas al rubro y al nombre. No preguntes lo que ya está en lo que escribió.

REGLAS:
· Castellano de la Argentina, con voseo, cercano y simple.
· Cada pregunta, una sola cosa, que se conteste en una o dos líneas. Hasta 120 caracteres.
· NO preguntes precios, teléfonos, direcciones, redes, días ni horarios: cada uno tiene su propio campo en el formulario.
· NO supongas el género de quien produce: nada de adjetivos, participios ni pronombres en femenino o masculino referidos a esa persona.
· Sin emojis.

SALIDA:
Sólo las preguntas, una por línea, sin numerar. Sin título ni explicaciones.`;
}

/**
 * Si el modelo no devuelve preguntas que sirvan, la entrevista sigue con estas.
 * Son genéricas, pero preguntan lo mismo que una buena descripción cuenta.
 */
export const PREGUNTAS_DE_RESPALDO: readonly string[] = [
  "¿Qué hacés o vendés? Contalo como se lo contarías a alguien en la feria.",
  "¿Con qué materiales o ingredientes trabajás?",
  "¿Qué tienen de especial tus productos?",
  "¿Tomás encargos o hacés cosas a pedido?",
];

/**
 * Saca las preguntas de lo que devolvió el modelo: una por línea, aunque a
 * veces las numere o les ponga viñetas pese a pedirle que no.
 */
export function extraerPreguntas(bruto: string): string[] {
  const preguntas = bruto
    .split("\n")
    .map((linea) =>
      linea
        .trim()
        .replace(/^(\d+\s*[.)\-:]\s*|[-*·•]\s+)/, "")
        .replace(/^\*\*(.*)\*\*$/, "$1")
        .trim(),
    )
    .filter(
      (linea) =>
        linea.includes("?") && linea.length >= 8 && linea.length <= 200,
    );

  return [...new Set(preguntas)].slice(0, MAXIMO_PREGUNTAS);
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

/** Una llamada al modelo de texto, con el error ya en palabras del feriante. */
async function pedirAlModelo(
  prompt: string,
  opciones: { maxTokens: number; temperatura: number },
): Promise<string> {
  const cliente = obtenerClienteIA();

  let respuesta;
  try {
    respuesta = await cliente.chat.completions.create({
      model: MODELO_TEXTO_POR_DEFECTO,
      max_tokens: opciones.maxTokens,
      temperature: opciones.temperatura,
      messages: [{ role: "user", content: prompt }],
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

  return bruto;
}

/**
 * Pide las preguntas de la entrevista.
 *
 * Si el servicio no contesta, lanza: no tiene sentido hacer pasar a la persona
 * por cinco preguntas para que al final tampoco se pueda escribir el texto. Si
 * contesta pero las preguntas no sirven, sigue con las de respaldo.
 */
export async function generarPreguntasConIA(
  emprendimiento: ContextoEmprendimiento,
): Promise<string[]> {
  const bruto = await pedirAlModelo(construirPromptPreguntas(emprendimiento), {
    maxTokens: 400,
    temperatura: 0.5,
  });

  const preguntas = extraerPreguntas(bruto);

  return preguntas.length >= 3 ? preguntas : [...PREGUNTAS_DE_RESPALDO];
}

/**
 * Pide el texto al modelo y lo devuelve limpio.
 *
 * Lanza `ErrorDeRedaccion` con un mensaje legible: quien llama tiene que poder
 * decirle al feriante qué pasó y dejarlo seguir escribiendo a mano.
 */
export async function redactarDescripcionConIA(
  tarea: TareaRedaccion,
  emprendimiento: ContextoEmprendimiento,
): Promise<string> {
  const bruto = await pedirAlModelo(construirPrompt(tarea, emprendimiento), {
    // 700 caracteres de tope entran cómodos; el margen es para que no corte
    // una oración por la mitad si se pasa un poco.
    maxTokens: 600,
    temperatura: 0.7,
  });

  const texto = limpiarSalida(bruto);

  // Con respuestas de una palabra el texto sale corto, y eso es correcto: se
  // negó a inventar. Lo que se corta acá es lo que no llega a ser una frase.
  if (texto.length < 25) {
    throw new ErrorDeRedaccion(
      tarea.modo === "entrevista"
        ? "Con esas respuestas no alcanzó para armar un texto. Contá un poco más en alguna y probá de nuevo."
        : "El modelo devolvió un texto demasiado corto para usarlo.",
    );
  }

  return texto;
}
