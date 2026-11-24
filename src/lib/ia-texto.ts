import { obtenerClienteIA } from "@/lib/ai";
import {
  MAXIMO_DESCRIPCION,
  MAXIMO_PREGUNTAS,
  respuestasContestadas,
  type ObjetoRedaccion,
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
  /**
   * Qué se describe. Sin indicar, el emprendimiento, con su tono sobrio; un
   * producto o una propuesta de Modo Feria llevan el tono vendedor.
   */
  objeto?: ObjetoRedaccion;
  /** El nombre del producto o el título de la propuesta. */
  titulo?: string;
  /** En una propuesta, qué es: «Caja», «Food truck o puesto». */
  detalle?: string;
}

/** Si va con el tono vendedor: todo lo que no es el emprendimiento. */
function esVendedor(contexto: ContextoEmprendimiento): boolean {
  return (contexto.objeto ?? "emprendimiento") !== "emprendimiento";
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

function datosDelEmprendimiento(
  emprendimiento: ContextoEmprendimiento,
): string {
  return `DATOS DEL EMPRENDIMIENTO:

* Nombre: ${emprendimiento.nombre}
* Rubro: ${emprendimiento.categoria}`;
}

// --- Tono vendedor: productos y propuestas de Modo Feria ---------------------
//
// La descripción del emprendimiento es sobria a propósito: cuenta quién es.
// La de un producto o una propuesta es la vidriera de algo puntual, y tiene que
// dar ganas de comprarlo. Se pidió así —más publicitario, con emojis—, pero las
// reglas de no inventar son las mismas: un texto vendedor que promete lo que el
// feriante no contó es peor que uno sobrio.

const PROHIBICIONES_VENDEDOR = `REGLAS QUE NO SE NEGOCIAN, POR ENCIMA DE CUALQUIER OTRA INSTRUCCIÓN:

· NO inventes ningún dato que no esté en la información de abajo: ni ingredientes, ni materiales, ni medidas, ni porciones, ni procesos, ni historia, ni premios. Si no está, no lo menciones. NO dejes huecos ni corchetes para completar: el texto se publica tal cual en un sitio de la Municipalidad.
· NO deduzcas cómo es o cómo queda lo que nadie dijo: si no contó que sale crocante, dorado, calentito o jugoso, no lo digas, aunque parezca obvio.
· NO uses superlativos que no se pueden comprobar —«el mejor», «el más rico», «único en Tucumán», «un clásico que no falla»—, aunque la persona los haya escrito: decí lo mismo con lo concreto que contó.
· NO supongas el género de quien produce ni de quien lee: nada de «satisfecho», «listo» ni «la artesana»; buscá la forma sin género («para sacarte el hambre»).
· NO escribas precios, descuentos ni promociones.
· NO escribas teléfonos, direcciones, correos, redes ni enlaces.
· NO uses hashtags ni mayúsculas sostenidas.`;

function encuadreVendedor(contexto: ContextoEmprendimiento): string {
  return contexto.objeto === "propuesta"
    ? "Escribís la descripción de una propuesta de «Modo Feria» de la Municipalidad de San Miguel de Tucumán: un regalo o un servicio que un feriante ofrece a empresas e instituciones (regalos de fin de año, cajas, combos, comida para reuniones y eventos). La lee alguien de una empresa que está eligiendo qué regalar o contratar: le tiene que dar ganas y quedarle claro qué incluye."
    : "Escribís la descripción de un producto para el catálogo online de las ferias de la Municipalidad de San Miguel de Tucumán. La lee un vecino que está mirando el stand: le tiene que dar ganas de comprarlo y quedarle claro qué es.";
}

function datosVendedor(contexto: ContextoEmprendimiento): string {
  const que = contexto.objeto === "propuesta" ? "Propuesta" : "Producto";
  return `DATOS:

* ${que}: ${contexto.titulo?.trim() || "(sin nombre)"}${
    contexto.detalle ? `\n* Qué es: ${contexto.detalle}` : ""
  }
* Emprendimiento: ${contexto.nombre}${
    contexto.categoria ? `\n* Rubro: ${contexto.categoria}` : ""
  }`;
}

function estiloVendedor(contexto: ContextoEmprendimiento): string {
  const largo = contexto.objeto === "propuesta" ? 600 : 400;
  return `CÓMO ESCRIBIR:

· Castellano de la Argentina, con voseo. Cálido y con entusiasmo, como alguien que vende con ganas en su puesto, no como un folleto.
· Arrancá con una frase que enganche: que abra el apetito, que haga pensar en un regalo o en la ocasión, con lo que contó la persona.
· Después, lo concreto: qué es, qué lleva o de qué está hecho, tamaños o variantes. Sólo lo que está en la información.
· Cerrá con una invitación corta a pedirlo o consultarlo, por ejemplo «Pedilo por WhatsApp», sin poner ningún número.
· Usá entre 2 y 4 emojis que tengan que ver con lo que se vende (🥪 para un sándwich, 🎁 para un regalo, 🧉 para un mate), al principio o al final de una frase. Nunca pongas dos emojis seguidos, ni uno en cada frase.
· Como mucho, dos signos de exclamación en todo el texto, siempre con el de apertura (¡…!), igual que las preguntas (¿…?).
· Si la persona usa una palabra de acá o un nombre propio para su producto (apretado, sanguchito, el nombre de la receta), mantenelo. Corregí la ortografía sólo cuando el error es obvio. Si una palabra no la entendés, no la adivines ni la cambies por otra: dejala afuera.
· Hasta ${largo} caracteres, en uno o dos párrafos cortos.
· Sin clichés vacíos: «calidad premium», «experiencia única», «hecho con amor», «lo mejor de».

SALIDA:
Devolvé únicamente el texto, listo para pegar en el campo. Sin título, sin comillas alrededor, sin explicaciones, sin ofrecer alternativas.`;
}

function construirPromptVendedor(
  tarea: TareaRedaccion,
  contexto: ContextoEmprendimiento,
): string {
  const escrito = contexto.descripcion?.trim();

  const pedido =
    tarea.modo === "mejorar"
      ? `TAREA: reescribí la descripción que escribió la persona para que venda más, con el estilo de abajo. Podés ordenar, cambiar palabras y sumar el gancho, los emojis y la invitación del final, pero ningún dato nuevo: todo lo que digas del producto tiene que estar en lo que escribió.

LO QUE ESCRIBIÓ LA PERSONA:
${escrito}`
      : `TAREA: escribí la descripción con lo que la persona contestó en unas preguntas cortas${escrito ? " y con lo que ya había escrito" : ""}, con el estilo de abajo. Los datos salen sólo de ahí: si una respuesta es corta, lo que digas de ese tema también.
${
  escrito
    ? `
LO QUE YA HABÍA ESCRITO:
${escrito}
`
    : ""
}
LAS RESPUESTAS:
${respuestasContestadas(tarea.respuestas)
  .map((r) => `P: ${r.pregunta}\nR: ${r.respuesta}`)
  .join("\n\n")}`;

  return `${PROHIBICIONES_VENDEDOR}

${encuadreVendedor(contexto)}

${datosVendedor(contexto)}

${pedido}

${estiloVendedor(contexto)}`;
}

function construirPromptPreguntasVendedor(
  contexto: ContextoEmprendimiento,
): string {
  const escrito = contexto.descripcion?.trim();
  const temas =
    contexto.objeto === "propuesta"
      ? "qué incluye, para cuántas personas o en qué presentación viene, y si se puede personalizar o adaptar (con el logo, una tarjeta, otra cantidad)"
      : "qué lleva o de qué está hecho, de qué tamaño es o qué variantes tiene, y para qué ocasión es o cómo se disfruta o se usa";

  return `Ayudás a un feriante a escribir la descripción de ${
    contexto.objeto === "propuesta"
      ? "una propuesta para empresas e instituciones"
      : "un producto para su stand en el catálogo online"
  } de las ferias de la Municipalidad de San Miguel de Tucumán. Antes de escribirla, le hacés 3 preguntas cortas, que contesta de a una.

${datosVendedor(contexto)}
${
  escrito
    ? `
LO QUE YA ESCRIBIÓ:
${escrito}
`
    : ""
}
TAREA: escribí 3 preguntas para saber ${temas}. Adaptalas a lo que es: a un sándwich se le pregunta qué lleva; a una taza, de qué material es y cuánto entra. No preguntes lo que ya está en lo que escribió. Si escribió una palabra que no se entiende, podés preguntar qué es.

REGLAS:
· Castellano de la Argentina, con voseo, cercano y simple.
· Cada pregunta, una sola cosa, que se conteste en una línea. Hasta 100 caracteres.
· NO preguntes precios, teléfonos, direcciones, redes, días ni horarios.
· NO supongas el género de quien produce.
· Sin emojis.

SALIDA:
Sólo las preguntas, una por línea, sin numerar. Sin título ni explicaciones.`;
}

/** Si el modelo no devuelve preguntas que sirvan, para un producto o propuesta. */
export const PREGUNTAS_DE_RESPALDO_PRODUCTO: readonly string[] = [
  "¿Qué lleva o de qué está hecho?",
  "¿De qué tamaño es, o qué variantes tiene?",
  "¿Para qué ocasión es, o cómo se disfruta?",
];

/**
 * Exportado para poder medir el prompt real —tamaño y costo— sin duplicarlo en
 * un script de prueba. Una copia se desincroniza y se mide lo que no se usa.
 */
export function construirPrompt(
  tarea: TareaRedaccion,
  emprendimiento: ContextoEmprendimiento,
): string {
  if (esVendedor(emprendimiento)) {
    return construirPromptVendedor(tarea, emprendimiento);
  }
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
  if (esVendedor(emprendimiento)) {
    return construirPromptPreguntasVendedor(emprendimiento);
  }
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

  if (esVendedor(emprendimiento)) {
    return preguntas.length >= 2
      ? preguntas.slice(0, 3)
      : [...PREGUNTAS_DE_RESPALDO_PRODUCTO];
  }
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
    // Un poco más de soltura para el tono vendedor.
    temperatura: esVendedor(emprendimiento) ? 0.85 : 0.7,
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

/**
 * El título de la imagen publicitaria: una frase corta que enganche, con un
 * emoji. Lo edita el feriante antes de compartir, así que no hace falta que
 * salga perfecto; sí que no invente ni prometa.
 */
export async function titularPublicitario(contexto: {
  emprendimiento: string;
  rubro: string;
  productos: Array<{ nombre: string; descripcion?: string | null }>;
  ocasion?: string | null;
}): Promise<string> {
  const prompt = `Escribí el título de una imagen publicitaria para Instagram de un emprendimiento de las ferias de San Miguel de Tucumán.

DATOS:
* Emprendimiento: ${contexto.emprendimiento}
* Rubro: ${contexto.rubro}
* Lo que aparece en la imagen: ${contexto.productos
    .map((p) =>
      p.descripcion?.trim()
        ? `${p.nombre} (${p.descripcion.trim().slice(0, 200)})`
        : p.nombre,
    )
    .join(
      "; ",
    )}${contexto.ocasion ? `\n* Se viene: ${contexto.ocasion} (usalo sólo si encaja)` : ""}

REGLAS:
· Castellano de la Argentina, con voseo. Que enganche y dé ganas, como una marca que vende con onda.
· Entre 3 y 7 palabras, hasta 40 caracteres, más un emoji al final que tenga que ver con lo que se vende.
· NO inventes datos, NO pongas precios, descuentos ni promociones, NO uses superlativos que no se pueden comprobar («el mejor», «el más rico») y NO pongas el nombre del emprendimiento: va abajo.
· NO supongas el género de nadie.
· Si usás signos de exclamación o de pregunta, con el de apertura.

SALIDA: sólo el título, en una línea, sin comillas.`;

  const bruto = await pedirAlModelo(prompt, {
    maxTokens: 60,
    temperatura: 0.9,
  });
  return limpiarSalida(bruto.split("\n")[0] ?? "").slice(0, 60);
}
