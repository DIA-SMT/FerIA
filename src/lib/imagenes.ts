import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * Mejora de las fotos de producto del catálogo.
 *
 * El objetivo es que un feriante con la cámara del celular y luz de cocina
 * consiga una foto presentable, sin que la plataforma invente nada: todo lo que
 * pasa acá es determinista y conserva los píxeles del producto.
 *
 * Por qué no usamos un modelo de IA:
 *
 * · Un modelo generativo **redibuja** la imagen. Cambiaría la trama de un
 *   tejido, correría un color y —lo más grave— inventaría el texto de una
 *   etiqueta. Publicar en el sitio municipal un producto que no es el que el
 *   vecino va a recibir es el mismo problema que nos hizo sacar los precios.
 * · Un modelo local de segmentación no entra en el deploy: `onnxruntime-node`
 *   pesa 258 MB desempaquetada y el tope de una función serverless de Vercel es
 *   250 MB, sin contar Next.js, Prisma ni los pesos del modelo.
 *
 * Lo que sí hacemos, con `sharp` (Apache-2.0, ya presente por Next.js):
 * corregir orientación, encuadrar cuadrado, levantar la exposición sólo si hace
 * falta, y —cuando el fondo es parejo— blanquearlo desde los bordes.
 */

/** Lado del cuadrado de salida. La tarjeta pública usa `aspect-square`. */
const LADO = 1200;

/** Calidad WebP. 82 mantiene detalle de textura sin inflar el bucket. */
const CALIDAD = 82;

export interface FotoProcesada {
  /** La imagen lista para subir. */
  contenido: Buffer;
  /** Qué se le hizo, para poder contárselo al feriante. */
  ajustes: {
    /** Se corrigió la rotación que traía el EXIF del celular. */
    rotacion: boolean;
    /** Se levantó exposición/contraste porque la foto estaba oscura o plana. */
    exposicion: boolean;
    /** Se blanqueó el fondo (sólo si era parejo). */
    fondoBlanco: boolean;
  };
}

/**
 * Distancia de color entre dos píxeles, en el cubo RGB.
 * Sin corrección perceptual a propósito: acá alcanza y es predecible.
 */
function distancia(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Cuánto hay que levantar la exposición, como ganancia multiplicativa.
 * Devuelve `1` si la foto ya está bien y no hay que tocarla.
 *
 * Se usa una ganancia igual para los tres canales, a propósito. `normalise()`
 * de sharp estira cada canal por separado, lo que corre el tono: en las pruebas
 * convirtió una taza terracota en roja oscura y aplastó la sombra a negro
 * sólido. Una ganancia común aclara sin tocar el color.
 */
async function gananciaDeExposicion(imagen: sharp.Sharp): Promise<number> {
  const { channels } = await imagen.clone().stats();

  const medias = channels.slice(0, 3).map((c) => c.mean);
  const media = medias.reduce((a, b) => a + b, 0) / medias.length;
  const maximo = Math.max(...channels.slice(0, 3).map((c) => c.max));

  // Ya está bien expuesta.
  if (media >= 115) return 1;

  // Oscura, pero con altas luces: es una escena que **es** oscura (una feria de
  // noche, un puesto con lámparas), no una foto mal expuesta. Aclararla la
  // arruina — en las pruebas convirtió la taza en un manchón amarillo pálido.
  // El máximo alto es la firma de un brillo especular; ahí no tocamos nada.
  if (maximo > 205) return 1;

  // Subexpuesta de verdad: nada brillante y media baja. Aclarado moderado, con
  // techo de 1,6x. Deliberadamente conservador: preferimos una foto un poco
  // oscura antes que una quemada, porque el feriante puede elegir el original.
  return Math.min(1.6, 135 / Math.max(media, 1));
}

/**
 * Blanquea el fondo cuando es parejo, avanzando desde los bordes hacia adentro.
 *
 * Es una inundación por color, no una segmentación: si el producto está sobre
 * una mesa o una tela lisa funciona; si el fondo es un patio con plantas, no
 * encuentra región pareja y **no toca nada**. Falla dejando la foto como
 * estaba, nunca comiéndose el producto — que es el modo de falla que importa.
 *
 * Devuelve `null` si no se pudo hacer con confianza.
 */
async function blanquearFondo(imagen: sharp.Sharp): Promise<Buffer | null> {
  const { data, info } = await imagen
    .clone()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const canales = info.channels;
  const ancho = info.width;
  const alto = info.height;
  const total = ancho * alto;

  // Color del fondo: la mediana de los cuatro bordes. La mediana y no el
  // promedio para que un objeto que toca un borde no corra la referencia.
  const muestras: Array<[number, number, number]> = [];
  const paso = Math.max(1, Math.floor(ancho / 60));

  for (let x = 0; x < ancho; x += paso) {
    for (const y of [0, alto - 1]) {
      const i = (y * ancho + x) * canales;
      muestras.push([data[i]!, data[i + 1]!, data[i + 2]!]);
    }
  }
  for (let y = 0; y < alto; y += paso) {
    for (const x of [0, ancho - 1]) {
      const i = (y * ancho + x) * canales;
      muestras.push([data[i]!, data[i + 1]!, data[i + 2]!]);
    }
  }

  const mediana = (valores: number[]) =>
    valores.sort((a, b) => a - b)[Math.floor(valores.length / 2)]!;

  const fondo: [number, number, number] = [
    mediana(muestras.map((m) => m[0])),
    mediana(muestras.map((m) => m[1])),
    mediana(muestras.map((m) => m[2])),
  ];

  // ¿Es parejo? Si más de un quinto de los bordes se aleja del color de
  // referencia, el fondo no es liso y no seguimos.
  const TOLERANCIA = 42;
  const dispersos = muestras.filter(
    (m) => distancia(m[0], m[1], m[2], fondo[0], fondo[1], fondo[2]) > TOLERANCIA,
  ).length;

  if (dispersos / muestras.length > 0.2) return null;

  // Inundación desde los bordes (BFS sobre 4-vecinos). Sólo se blanquea lo
  // conectado al borde: una zona del mismo color rodeada por el producto —el
  // hueco del asa de una taza, por ejemplo— queda intacta.
  const visitado = new Uint8Array(total);
  const cola = new Int32Array(total);
  let cabeza = 0;
  let cola_ = 0;

  const encolarSiCorresponde = (idx: number) => {
    if (visitado[idx]) return;
    const i = idx * canales;
    if (
      distancia(data[i]!, data[i + 1]!, data[i + 2]!, fondo[0], fondo[1], fondo[2]) >
      TOLERANCIA
    ) {
      return;
    }
    visitado[idx] = 1;
    cola[cola_++] = idx;
  };

  for (let x = 0; x < ancho; x++) {
    encolarSiCorresponde(x);
    encolarSiCorresponde((alto - 1) * ancho + x);
  }
  for (let y = 0; y < alto; y++) {
    encolarSiCorresponde(y * ancho);
    encolarSiCorresponde(y * ancho + ancho - 1);
  }

  while (cabeza < cola_) {
    const idx = cola[cabeza++]!;
    const x = idx % ancho;
    const y = (idx - x) / ancho;

    if (x > 0) encolarSiCorresponde(idx - 1);
    if (x < ancho - 1) encolarSiCorresponde(idx + 1);
    if (y > 0) encolarSiCorresponde(idx - ancho);
    if (y < alto - 1) encolarSiCorresponde(idx + ancho);
  }

  // Si el fondo detectado se comió casi todo, algo salió mal: abortamos.
  // Y si cubrió muy poco, no vale la pena tocar la foto.
  let pintados = 0;
  for (let i = 0; i < total; i++) if (visitado[i]) pintados++;

  const proporcion = pintados / total;
  if (proporcion > 0.85 || proporcion < 0.05) return null;

  const salida = Buffer.from(data);
  for (let idx = 0; idx < total; idx++) {
    if (!visitado[idx]) continue;
    const i = idx * canales;
    salida[i] = 255;
    salida[i + 1] = 255;
    salida[i + 2] = 255;
  }

  // Los píxeles que quedaron justo en el límite de la tolerancia forman un
  // anillo de color intermedio alrededor del producto: el halo que se veía en
  // la primera prueba. Se difuminan mezclándolos hacia el blanco según cuánto
  // se parezcan al fondo, en lugar de blanquearlos de golpe — así el borde del
  // producto no se come, sólo se limpia.
  const HALO = TOLERANCIA * 1.9;

  for (let idx = 0; idx < total; idx++) {
    if (visitado[idx]) continue;

    const x = idx % ancho;
    const y = (idx - x) / ancho;

    const pegadoAlFondo =
      (x > 0 && visitado[idx - 1]) ||
      (x < ancho - 1 && visitado[idx + 1]) ||
      (y > 0 && visitado[idx - ancho]) ||
      (y < alto - 1 && visitado[idx + ancho]);

    if (!pegadoAlFondo) continue;

    const i = idx * canales;
    const d = distancia(
      data[i]!,
      data[i + 1]!,
      data[i + 2]!,
      fondo[0],
      fondo[1],
      fondo[2],
    );
    if (d > HALO) continue;

    // `mezcla` = 1 cuando el píxel es idéntico al fondo, 0 cuando ya está lejos.
    const mezcla = 1 - d / HALO;
    for (let c = 0; c < 3; c++) {
      const valor = data[i + c]!;
      salida[i + c] = Math.round(valor + (255 - valor) * mezcla);
    }
  }

  return sharp(salida, { raw: { width: ancho, height: alto, channels: canales } })
    .webp({ quality: CALIDAD })
    .toBuffer();
}

/**
 * Procesa una foto de producto: la deja cuadrada, bien expuesta y —si se puede—
 * con el fondo blanco.
 *
 * No lanza si algo del pipeline no aplica: devuelve la foto con los ajustes que
 * sí se pudieron hacer, e informa cuáles fueron.
 */
export async function procesarFotoProducto(
  entrada: Buffer,
): Promise<FotoProcesada> {
  const original = sharp(entrada, { failOn: "none" });
  const meta = await original.metadata();

  // `rotate()` sin argumentos aplica la orientación del EXIF. Sin esto, las
  // fotos verticales de celular entran acostadas.
  const rotacion = Boolean(meta.orientation && meta.orientation !== 1);

  // El orden importa y no es intercambiable: el fondo se detecta muestreando
  // los bordes, así que hay que blanquearlo ANTES de encuadrar en cuadrado. Si
  // se rellena primero, los bordes que se muestrean son el propio relleno
  // blanco y la detección nunca encuentra la mesa.
  let cadena = original
    .rotate()
    .flatten({ background: { r: 255, g: 255, b: 255 } });

  const ganancia = await gananciaDeExposicion(cadena);
  const exposicion = ganancia > 1;
  if (exposicion) {
    // `linear(ganancia, 0)` multiplica los tres canales por igual: aclara sin
    // correr el tono. Sin retoque de saturación: sumado al aclarado empujaba
    // los terracota a naranja.
    cadena = cadena.linear(ganancia, 0);
  }

  // Un poco de nitidez: compensa la falta de foco de un celular.
  cadena = cadena.sharpen({ sigma: 0.8 });

  const conFondo = await blanquearFondo(cadena);
  const fondoBlanco = conFondo !== null;

  // Recién ahora el encuadre cuadrado. La foto entera entra (`contain`), no se
  // recorta nada del producto, y el relleno blanco se continúa sin costura con
  // el fondo si se llegó a blanquear.
  const contenido = await sharp(conFondo ?? (await cadena.toBuffer()))
    .resize(LADO, LADO, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255 },
    })
    .webp({ quality: CALIDAD })
    .toBuffer();

  return { contenido, ajustes: { rotacion, exposicion, fondoBlanco } };
}

/**
 * Normaliza la imagen que devuelve el modelo de IA al cuadrado del catálogo.
 *
 * El modelo **no respeta el 1:1** aunque el prompt lo pida: devuelve la
 * proporción de la entrada (896 de alto por 1152 con un frasco horizontal, 864
 * por 1184 con un poncho vertical). Hay que llevarlo al cuadrado acá.
 *
 * Recorta al centro (`cover`). Se probaron antes tres formas de **rellenar** hasta
 * el cuadrado en lugar de recortar, y las tres salieron peor:
 *
 * · **Color muestreado del borde**: barras perfectamente visibles. El fondo que
 *   compone el modelo es un *degradé*, así que promediar los bordes da un tono
 *   medio que no coincide con ninguno de los extremos.
 * · **Fondo propio desenfocado, borde duro**: costura visible, un escalón de tono
 *   donde termina el lienzo y empieza la foto.
 * · **Fondo propio desenfocado, borde difuminado**: peor todavía — parece una
 *   foto enmarcada con esquinas redondeadas flotando sobre otra imagen.
 *
 * El motivo por el que se evitaba recortar era la regla del prompt que prohíbe
 * recortar, pero esa regla dice "ninguna parte importante **del producto**", y el
 * recorte no toca el producto: se lleva lo que el propio modelo agregó de adorno
 * en los costados. Además el prompt le exige dejar un 8 % de margen alrededor del
 * producto, que es justo lo que hace el recorte seguro.
 *
 * Las otras dos diferencias con `procesarFotoProducto` también son deliberadas:
 * no blanquea el fondo (la escena es intencional, inundarla se la comería) y no
 * toca la exposición (ya viene iluminada como estudio).
 */
export async function normalizarSalidaIA(entrada: Buffer): Promise<Buffer> {
  return sharp(entrada, { failOn: "none" })
    .resize(LADO, LADO, { fit: "cover", position: "centre" })
    .webp({ quality: CALIDAD })
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Insignia municipal
// ---------------------------------------------------------------------------

/** Lado de la insignia, como fracción del lado de la imagen. */
const INSIGNIA_LADO = 0.1;

/** Margen entre la insignia y el borde, como fracción del lado. */
const INSIGNIA_MARGEN = 0.035;

/** Región que se mide para decidir qué esquina está más despejada. */
const INSIGNIA_SONDEO = 0.22;

export type EsquinaInsignia =
  | "arriba-izquierda"
  | "arriba-derecha"
  | "abajo-izquierda"
  | "abajo-derecha";

/**
 * El logo se lee del disco una sola vez por proceso.
 *
 * `public/` no está garantizado en el sistema de archivos de una función
 * serverless, así que `next.config.ts` lo declara en `outputFileTracingIncludes`
 * para que viaje con el bundle.
 */
let logoCache: Promise<Buffer> | null = null;

function leerLogo(): Promise<Buffer> {
  logoCache ??= readFile(path.join(process.cwd(), "public", "logo.png"));
  return logoCache;
}

/**
 * Compone la insignia municipal en la esquina más despejada.
 *
 * "Más despejada" se decide midiendo: se sondea un cuadrado en cada esquina y se
 * queda con la de menor desvío estándar de luminancia. Un fondo liso tiene
 * desvío bajo; una esquina con un ovillo, un borde de sombra o una veta de
 * madera lo tiene alto. Así la insignia nunca cae encima de algo, sin necesidad
 * de que el modelo respete la instrucción de dejar las esquinas libres —que en
 * las pruebas cumplió sólo la mitad de las veces.
 */
export async function aplicarInsigniaMunicipal(
  cuadrada: Buffer,
): Promise<{ contenido: Buffer; esquina: EsquinaInsignia }> {
  const imagen = sharp(cuadrada, { failOn: "none" });
  const meta = await imagen.metadata();
  const lado = Math.min(meta.width ?? LADO, meta.height ?? LADO);

  const sondeo = Math.round(lado * INSIGNIA_SONDEO);

  const esquinas: Array<{ nombre: EsquinaInsignia; left: number; top: number }> = [
    { nombre: "arriba-izquierda", left: 0, top: 0 },
    { nombre: "arriba-derecha", left: lado - sondeo, top: 0 },
    { nombre: "abajo-izquierda", left: 0, top: lado - sondeo },
    { nombre: "abajo-derecha", left: lado - sondeo, top: lado - sondeo },
  ];

  const medidas = await Promise.all(
    esquinas.map(async (esquina) => {
      // El recorte se materializa a buffer ANTES de medirlo. `stats()` de sharp
      // opera sobre la imagen de entrada e ignora las operaciones del pipeline,
      // así que medir sobre `.extract().stats()` devuelve las estadísticas de la
      // imagen entera: las cuatro esquinas daban el mismo número y la elección
      // era siempre la primera.
      const recorte = await imagen
        .clone()
        .extract({
          left: esquina.left,
          top: esquina.top,
          width: sondeo,
          height: sondeo,
        })
        .toBuffer();

      const { channels } = await sharp(recorte).stats();

      // Promedio del desvío de los tres canales: cuánto "pasa" en esa esquina.
      const desvios = channels.slice(0, 3).map((c) => c.stdev);
      return {
        esquina,
        ruido: desvios.reduce((a, b) => a + b, 0) / desvios.length,
      };
    }),
  );

  const elegida = medidas.reduce((mejor, actual) =>
    actual.ruido < mejor.ruido ? actual : mejor,
  );

  const tamanio = Math.round(lado * INSIGNIA_LADO);
  const margen = Math.round(lado * INSIGNIA_MARGEN);

  const logo = await sharp(await leerLogo())
    .resize(tamanio, tamanio, { fit: "inside" })
    .toBuffer();

  const esAbajo = elegida.esquina.nombre.startsWith("abajo");
  const esDerecha = elegida.esquina.nombre.endsWith("derecha");

  const contenido = await imagen
    .composite([
      {
        input: logo,
        left: esDerecha ? lado - tamanio - margen : margen,
        top: esAbajo ? lado - tamanio - margen : margen,
      },
    ])
    .webp({ quality: CALIDAD })
    .toBuffer();

  return { contenido, esquina: elegida.esquina.nombre };
}

/** Texto para contarle al feriante qué se le hizo a la foto. */
export function describirAjustes(ajustes: FotoProcesada["ajustes"]): string[] {
  const partes: string[] = ["Encuadrada en cuadrado sobre fondo blanco"];
  if (ajustes.rotacion) partes.push("orientación corregida");
  if (ajustes.exposicion) partes.push("iluminación levantada");
  if (ajustes.fondoBlanco) partes.push("fondo blanqueado");
  return partes;
}
