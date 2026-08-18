/**
 * Imágenes abstractas para los datos de ejemplo.
 *
 * El seed no puede usar fotos reales: no hay derechos de uso que podamos
 * garantizar para un sitio municipal. En lugar de dejar todo con el placeholder
 * del degradé —que hace ver la grilla del market más plana de lo que sería en
 * producción— generamos acá imágenes geométricas, sin nada representacional y
 * por lo tanto sin problema de licencia.
 *
 * Cada rubro tiene su motivo y su combinación de colores, siempre dentro de la
 * paleta institucional de `src/app/globals.css`. Dos feriantes del mismo rubro
 * se ven emparentados pero no idénticos: las variaciones (rotación, desfasaje,
 * escala) salen de un hash del slug.
 *
 * Determinista a propósito: no usa `Math.random()`, así dos corridas del seed
 * producen las mismas imágenes y los diffs visuales son reproducibles.
 */

import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Paleta — los mismos valores que los tokens de Tailwind en globals.css
// ---------------------------------------------------------------------------

const AZUL_700 = "#0345a5";
const AZUL_500 = "#0567f2";
const AZUL_400 = "#4c97f8";
const CELESTE_400 = "#33adff";
const CELESTE_200 = "#bae4fd";
const CELESTE_700 = "#0361a6";
const ACENTO_400 = "#f5d90a";
const ACENTO_200 = "#fef08a";
const PIZARRA_800 = "#1e293b";

/** Combinación de fondo (degradé) + color del motivo. */
interface Combinacion {
  desde: string;
  hasta: string;
  motivo: string;
  /** Segundo color del motivo, para los acentos puntuales. */
  realce?: string;
}

// ---------------------------------------------------------------------------
// Azar reproducible
// ---------------------------------------------------------------------------

/** Hash FNV-1a de 32 bits: convierte el slug en la semilla del generador. */
function semillaDe(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: PRNG chico y determinista. Devuelve valores en [0, 1). */
function generador(semilla: number): () => number {
  let estado = semilla || 1;
  return () => {
    estado |= 0;
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número real en [min, max). */
function entre(rnd: () => number, min: number, max: number): number {
  return min + rnd() * (max - min);
}

/** Redondea a 2 decimales: los SVG quedan mucho más chicos. */
function r2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// ---------------------------------------------------------------------------
// Motivos geométricos
// ---------------------------------------------------------------------------

interface Lienzo {
  ancho: number;
  alto: number;
  rnd: () => number;
  combinacion: Combinacion;
}

type Motivo = (lienzo: Lienzo) => string;

/** Trama de telar: bandas cruzadas de distinto grosor. */
const telar: Motivo = ({ ancho, alto, rnd, combinacion }) => {
  const paso = ancho / entre(rnd, 7, 11);
  const piezas: string[] = [];

  for (let x = 0; x < ancho; x += paso) {
    const grosor = r2(paso * entre(rnd, 0.18, 0.42));
    piezas.push(
      `<rect x="${r2(x)}" y="0" width="${grosor}" height="${alto}" fill="${combinacion.motivo}" opacity="${r2(entre(rnd, 0.1, 0.3))}"/>`,
    );
  }
  for (let y = 0; y < alto; y += paso) {
    const grosor = r2(paso * entre(rnd, 0.18, 0.42));
    piezas.push(
      `<rect x="0" y="${r2(y)}" width="${ancho}" height="${grosor}" fill="${combinacion.motivo}" opacity="${r2(entre(rnd, 0.08, 0.24))}"/>`,
    );
  }
  return piezas.join("");
};

/** Círculos concéntricos desde un punto descentrado. */
const concentrico: Motivo = ({ ancho, alto, rnd, combinacion }) => {
  const cx = r2(entre(rnd, ancho * 0.25, ancho * 0.75));
  const cy = r2(entre(rnd, alto * 0.25, alto * 0.75));
  const maximo = Math.hypot(ancho, alto) * 0.62;
  const cantidad = Math.round(entre(rnd, 6, 10));
  const piezas: string[] = [];

  for (let i = cantidad; i >= 1; i--) {
    const radio = r2((maximo / cantidad) * i);
    const grosor = r2(entre(rnd, ancho * 0.006, ancho * 0.02));
    piezas.push(
      `<circle cx="${cx}" cy="${cy}" r="${radio}" fill="none" stroke="${i % 3 === 0 && combinacion.realce ? combinacion.realce : combinacion.motivo}" stroke-width="${grosor}" opacity="${r2(entre(rnd, 0.12, 0.34))}"/>`,
    );
  }
  return piezas.join("");
};

/** Franjas diagonales paralelas. */
const diagonales: Motivo = ({ ancho, alto, rnd, combinacion }) => {
  const angulo = rnd() > 0.5 ? 32 : -32;
  const paso = ancho / entre(rnd, 8, 14);
  const largo = Math.hypot(ancho, alto) * 1.4;
  const piezas: string[] = [];

  for (let i = -largo; i < largo; i += paso) {
    const grosor = r2(paso * entre(rnd, 0.2, 0.5));
    piezas.push(
      `<rect x="${r2(i)}" y="${r2(-largo / 2)}" width="${grosor}" height="${r2(largo)}" fill="${combinacion.motivo}" opacity="${r2(entre(rnd, 0.1, 0.28))}"/>`,
    );
  }
  return `<g transform="rotate(${angulo} ${r2(ancho / 2)} ${r2(alto / 2)})">${piezas.join("")}</g>`;
};

/** Puntadas: líneas discontinuas, como una costura. */
const puntadas: Motivo = ({ ancho, alto, rnd, combinacion }) => {
  const cantidad = Math.round(entre(rnd, 5, 9));
  const piezas: string[] = [];

  for (let i = 0; i < cantidad; i++) {
    const y = r2((alto / (cantidad + 1)) * (i + 1));
    const guion = r2(entre(rnd, ancho * 0.02, ancho * 0.05));
    const hueco = r2(guion * entre(rnd, 0.6, 1.2));
    const grosor = r2(entre(rnd, ancho * 0.004, ancho * 0.011));
    piezas.push(
      `<line x1="0" y1="${y}" x2="${ancho}" y2="${y}" stroke="${combinacion.motivo}" stroke-width="${grosor}" stroke-dasharray="${guion} ${hueco}" opacity="${r2(entre(rnd, 0.16, 0.36))}"/>`,
    );
  }
  return piezas.join("");
};

/** Rombos chicos dispersos, con algunos en el color de realce. */
const rombos: Motivo = ({ ancho, alto, rnd, combinacion }) => {
  const cantidad = Math.round(entre(rnd, 14, 24));
  const piezas: string[] = [];

  for (let i = 0; i < cantidad; i++) {
    const lado = r2(entre(rnd, ancho * 0.02, ancho * 0.07));
    const cx = r2(entre(rnd, 0, ancho));
    const cy = r2(entre(rnd, 0, alto));
    const color =
      combinacion.realce && rnd() > 0.72 ? combinacion.realce : combinacion.motivo;
    piezas.push(
      `<rect x="${r2(cx - lado / 2)}" y="${r2(cy - lado / 2)}" width="${lado}" height="${lado}" fill="${color}" opacity="${r2(entre(rnd, 0.14, 0.42))}" transform="rotate(45 ${cx} ${cy})"/>`,
    );
  }
  return piezas.join("");
};

/** Arcos grandes superpuestos. */
const arcos: Motivo = ({ ancho, alto, rnd, combinacion }) => {
  const cantidad = Math.round(entre(rnd, 4, 7));
  const piezas: string[] = [];

  for (let i = 0; i < cantidad; i++) {
    const radio = r2(entre(rnd, ancho * 0.22, ancho * 0.6));
    const cx = r2(entre(rnd, 0, ancho));
    const cy = r2(entre(rnd, alto * 0.4, alto * 1.1));
    const grosor = r2(entre(rnd, ancho * 0.01, ancho * 0.035));
    piezas.push(
      `<path d="M ${r2(cx - radio)} ${cy} A ${radio} ${radio} 0 0 1 ${r2(cx + radio)} ${cy}" fill="none" stroke="${combinacion.motivo}" stroke-width="${grosor}" opacity="${r2(entre(rnd, 0.14, 0.34))}"/>`,
    );
  }
  return piezas.join("");
};

/** Ondas suaves apiladas. */
const ondas: Motivo = ({ ancho, alto, rnd, combinacion }) => {
  const cantidad = Math.round(entre(rnd, 4, 7));
  const piezas: string[] = [];

  for (let i = 0; i < cantidad; i++) {
    const base = r2((alto / (cantidad + 1)) * (i + 1));
    const amplitud = r2(entre(rnd, alto * 0.04, alto * 0.12));
    const grosor = r2(entre(rnd, ancho * 0.006, ancho * 0.018));
    const c1 = r2(ancho * 0.3);
    const c2 = r2(ancho * 0.7);
    piezas.push(
      `<path d="M 0 ${base} C ${c1} ${r2(base - amplitud)} ${c2} ${r2(base + amplitud)} ${ancho} ${base}" fill="none" stroke="${combinacion.motivo}" stroke-width="${grosor}" opacity="${r2(entre(rnd, 0.16, 0.36))}"/>`,
    );
  }
  return piezas.join("");
};

/** Rectángulos apilados de distinto ancho, como lomos en un estante. */
const apilados: Motivo = ({ ancho, alto, rnd, combinacion }) => {
  const piezas: string[] = [];
  let x = 0;

  while (x < ancho) {
    const anchoPieza = r2(entre(rnd, ancho * 0.03, ancho * 0.09));
    const altoPieza = r2(entre(rnd, alto * 0.35, alto * 0.9));
    const color =
      combinacion.realce && rnd() > 0.78 ? combinacion.realce : combinacion.motivo;
    piezas.push(
      `<rect x="${r2(x)}" y="${r2(alto - altoPieza)}" width="${anchoPieza}" height="${altoPieza}" fill="${color}" opacity="${r2(entre(rnd, 0.12, 0.34))}"/>`,
    );
    x += anchoPieza + entre(rnd, ancho * 0.004, ancho * 0.016);
  }
  return piezas.join("");
};

/** Siluetas triangulares escalonadas, al modo de los cerros. */
const cerros: Motivo = ({ ancho, alto, rnd, combinacion }) => {
  const capas = Math.round(entre(rnd, 3, 5));
  const piezas: string[] = [];

  for (let capa = 0; capa < capas; capa++) {
    const baseY = r2(alto - (alto * 0.1 * capa) / 1.5);
    const puntos: string[] = [`0,${baseY}`];
    const picos = Math.round(entre(rnd, 3, 6));

    for (let i = 0; i <= picos; i++) {
      const x = r2((ancho / picos) * i);
      const y = r2(baseY - entre(rnd, alto * 0.12, alto * 0.42));
      puntos.push(`${x},${y}`);
    }
    puntos.push(`${ancho},${baseY}`, `${ancho},${alto}`, `0,${alto}`);
    piezas.push(
      `<polygon points="${puntos.join(" ")}" fill="${combinacion.motivo}" opacity="${r2(entre(rnd, 0.12, 0.26))}"/>`,
    );
  }
  return piezas.join("");
};

/** Formas de hoja: dos arcos enfrentados. */
const hojas: Motivo = ({ ancho, alto, rnd, combinacion }) => {
  const cantidad = Math.round(entre(rnd, 6, 11));
  const piezas: string[] = [];

  for (let i = 0; i < cantidad; i++) {
    const largo = r2(entre(rnd, ancho * 0.08, ancho * 0.22));
    const x = r2(entre(rnd, 0, ancho));
    const y = r2(entre(rnd, 0, alto));
    const giro = r2(entre(rnd, 0, 360));
    const curva = r2(largo * 0.55);
    piezas.push(
      `<path d="M ${x} ${y} Q ${r2(x + curva)} ${r2(y - curva)} ${r2(x + largo)} ${y} Q ${r2(x + curva)} ${r2(y + curva)} ${x} ${y} Z" fill="${combinacion.motivo}" opacity="${r2(entre(rnd, 0.14, 0.34))}" transform="rotate(${giro} ${x} ${y})"/>`,
    );
  }
  return piezas.join("");
};

/** Círculos y cuadrados sueltos, de aire lúdico. */
const ludico: Motivo = ({ ancho, alto, rnd, combinacion }) => {
  const cantidad = Math.round(entre(rnd, 10, 18));
  const piezas: string[] = [];

  for (let i = 0; i < cantidad; i++) {
    const tamanio = r2(entre(rnd, ancho * 0.03, ancho * 0.1));
    const x = r2(entre(rnd, 0, ancho - tamanio));
    const y = r2(entre(rnd, 0, alto - tamanio));
    const color =
      combinacion.realce && rnd() > 0.6 ? combinacion.realce : combinacion.motivo;
    const opacidad = r2(entre(rnd, 0.16, 0.42));

    piezas.push(
      rnd() > 0.5
        ? `<circle cx="${r2(x + tamanio / 2)}" cy="${r2(y + tamanio / 2)}" r="${r2(tamanio / 2)}" fill="${color}" opacity="${opacidad}"/>`
        : `<rect x="${x}" y="${y}" width="${tamanio}" height="${tamanio}" rx="${r2(tamanio * 0.2)}" fill="${color}" opacity="${opacidad}"/>`,
    );
  }
  return piezas.join("");
};

/** Grilla de puntos, la más neutra: es la de `OTROS`. */
const trama: Motivo = ({ ancho, alto, rnd, combinacion }) => {
  const paso = ancho / entre(rnd, 12, 18);
  const radio = r2(paso * entre(rnd, 0.1, 0.2));
  const piezas: string[] = [];

  for (let x = paso / 2; x < ancho; x += paso) {
    for (let y = paso / 2; y < alto; y += paso) {
      piezas.push(
        `<circle cx="${r2(x)}" cy="${r2(y)}" r="${radio}" fill="${combinacion.motivo}" opacity="0.22"/>`,
      );
    }
  }
  return piezas.join("");
};

// ---------------------------------------------------------------------------
// Qué motivo y qué colores le toca a cada rubro
// ---------------------------------------------------------------------------

interface Estilo {
  motivo: Motivo;
  combinacion: Combinacion;
}

/**
 * Un rubro por motivo, para que se distingan de un vistazo en la grilla del
 * directorio. Los degradés alternan entre el azul y el celeste institucional;
 * el amarillo aparece sólo como realce puntual, como manda la identidad visual.
 */
const ESTILO_POR_RUBRO: Record<string, Estilo> = {
  ARTESANIAS: {
    motivo: telar,
    combinacion: { desde: AZUL_700, hasta: AZUL_500, motivo: CELESTE_200 },
  },
  GASTRONOMIA: {
    motivo: concentrico,
    combinacion: {
      desde: AZUL_500,
      hasta: CELESTE_400,
      motivo: "#ffffff",
      realce: ACENTO_400,
    },
  },
  INDUMENTARIA: {
    motivo: diagonales,
    combinacion: { desde: CELESTE_700, hasta: CELESTE_400, motivo: "#ffffff" },
  },
  MARROQUINERIA: {
    motivo: puntadas,
    combinacion: { desde: AZUL_700, hasta: CELESTE_700, motivo: ACENTO_200 },
  },
  JOYERIA_Y_BIJOUTERIE: {
    motivo: rombos,
    combinacion: {
      desde: AZUL_500,
      hasta: AZUL_700,
      motivo: "#ffffff",
      realce: ACENTO_400,
    },
  },
  DECORACION: {
    motivo: arcos,
    combinacion: { desde: CELESTE_400, hasta: AZUL_500, motivo: "#ffffff" },
  },
  COSMETICA_NATURAL: {
    motivo: ondas,
    combinacion: { desde: CELESTE_400, hasta: CELESTE_200, motivo: CELESTE_700 },
  },
  LIBROS_Y_ARTE: {
    motivo: apilados,
    combinacion: {
      desde: AZUL_700,
      hasta: AZUL_400,
      motivo: "#ffffff",
      realce: ACENTO_400,
    },
  },
  PRODUCTOS_REGIONALES: {
    motivo: cerros,
    combinacion: { desde: CELESTE_400, hasta: AZUL_700, motivo: PIZARRA_800 },
  },
  HUERTA_Y_VIVERO: {
    motivo: hojas,
    combinacion: { desde: CELESTE_700, hasta: CELESTE_400, motivo: CELESTE_200 },
  },
  JUGUETES: {
    motivo: ludico,
    combinacion: {
      desde: AZUL_500,
      hasta: CELESTE_400,
      motivo: "#ffffff",
      realce: ACENTO_400,
    },
  },
  OTROS: {
    motivo: trama,
    combinacion: { desde: AZUL_700, hasta: AZUL_500, motivo: "#ffffff" },
  },
};

/** Las categorías de feria reusan los motivos, con degradés más profundos. */
const ESTILO_POR_CATEGORIA: Record<string, Estilo> = {
  ARTESANIAS: {
    motivo: telar,
    combinacion: { desde: AZUL_700, hasta: CELESTE_700, motivo: CELESTE_200 },
  },
  EMPRENDEDORES: {
    motivo: diagonales,
    combinacion: {
      desde: AZUL_500,
      hasta: CELESTE_400,
      motivo: "#ffffff",
      realce: ACENTO_400,
    },
  },
  GASTRONOMIA: {
    motivo: concentrico,
    combinacion: {
      desde: CELESTE_700,
      hasta: AZUL_500,
      motivo: "#ffffff",
      realce: ACENTO_400,
    },
  },
  PRODUCTOS_REGIONALES: {
    motivo: cerros,
    combinacion: { desde: CELESTE_400, hasta: AZUL_700, motivo: PIZARRA_800 },
  },
  LIBROS_Y_ARTE: {
    motivo: apilados,
    combinacion: {
      desde: AZUL_700,
      hasta: AZUL_400,
      motivo: "#ffffff",
      realce: ACENTO_400,
    },
  },
  MIXTA: {
    motivo: ludico,
    combinacion: {
      desde: AZUL_700,
      hasta: CELESTE_400,
      motivo: "#ffffff",
      realce: ACENTO_400,
    },
  },
};

// ---------------------------------------------------------------------------
// Armado del SVG y conversión a WebP
// ---------------------------------------------------------------------------

/** Envuelve el motivo en el degradé de fondo y un velo oscuro en el borde. */
function armarSvg(
  estilo: Estilo,
  ancho: number,
  alto: number,
  clave: string,
): string {
  const rnd = generador(semillaDe(clave));
  const { combinacion } = estilo;

  // El ángulo del degradé varía por imagen: evita que la grilla se vea repetida.
  const giro = Math.round(entre(rnd, 0, 90));
  const cuerpo = estilo.motivo({ ancho, alto, rnd, combinacion });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">`,
    `<defs>`,
    `<linearGradient id="fondo" gradientTransform="rotate(${giro} 0.5 0.5)">`,
    `<stop offset="0" stop-color="${combinacion.desde}"/>`,
    `<stop offset="1" stop-color="${combinacion.hasta}"/>`,
    `</linearGradient>`,
    // Viñeta suave: da profundidad y ayuda a que el texto blanco de las
    // tarjetas se lea cuando la imagen se usa de fondo.
    `<radialGradient id="vineta" cx="0.5" cy="0.45" r="0.75">`,
    `<stop offset="0.55" stop-color="#000000" stop-opacity="0"/>`,
    `<stop offset="1" stop-color="#000000" stop-opacity="0.28"/>`,
    `</radialGradient>`,
    `</defs>`,
    `<rect width="${ancho}" height="${alto}" fill="url(#fondo)"/>`,
    cuerpo,
    `<rect width="${ancho}" height="${alto}" fill="url(#vineta)"/>`,
    `</svg>`,
  ].join("");
}

/**
 * Marca circular para el logo. Se ve a 32 px en las tablas del panel, así que
 * tiene que ser mucho más simple que una portada: fondo pleno y dos formas.
 */
function armarSvgLogo(estilo: Estilo, lado: number, clave: string): string {
  const rnd = generador(semillaDe(`logo:${clave}`));
  const { combinacion } = estilo;
  const c = lado / 2;
  const giro = Math.round(entre(rnd, 0, 360));
  const radio = r2(lado * entre(rnd, 0.2, 0.3));
  const desfase = r2(lado * entre(rnd, 0.08, 0.16));
  const realce = combinacion.realce ?? combinacion.motivo;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">`,
    `<defs><linearGradient id="g" gradientTransform="rotate(${giro} 0.5 0.5)">`,
    `<stop offset="0" stop-color="${combinacion.desde}"/>`,
    `<stop offset="1" stop-color="${combinacion.hasta}"/>`,
    `</linearGradient></defs>`,
    `<rect width="${lado}" height="${lado}" fill="url(#g)"/>`,
    `<circle cx="${r2(c - desfase)}" cy="${r2(c - desfase)}" r="${radio}" fill="${combinacion.motivo}" opacity="0.9"/>`,
    `<circle cx="${r2(c + desfase)}" cy="${r2(c + desfase)}" r="${r2(radio * 0.7)}" fill="${realce}" opacity="0.85"/>`,
    `</svg>`,
  ].join("");
}

/** Rasteriza el SVG a WebP. Calidad 82: buen detalle sin inflar el bucket. */
async function aWebp(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).webp({ quality: 82, effort: 4 }).toBuffer();
}

// ---------------------------------------------------------------------------
// Subida a Supabase Storage
// ---------------------------------------------------------------------------

/** Medidas usadas en la interfaz (ver los `sizes` de cada componente). */
const MEDIDAS = {
  /** Portada de feriante y de feria: 16/9, se usa a todo el ancho en la vidriera. */
  portada: { ancho: 1600, alto: 900 },
  /** Foto de producto: cuadrada, la tarjeta pública usa `aspect-square`. */
  producto: { ancho: 1200, alto: 1200 },
  /** Logo: cuadrado y chico, se muestra desde 32 px. */
  logo: { ancho: 400, alto: 400 },
} as const;

/**
 * Sube un buffer y devuelve la ruta con el bucket adelante
 * (`"vendedores/abc.webp"`), que es el formato que guarda la base.
 *
 * El nombre del objeto se deriva de la clave en lugar de ser aleatorio: si se
 * vuelve a correr el seed, sobreescribe en lugar de dejar huérfanos acumulados.
 */
async function subir(
  supabase: SupabaseClient,
  bucket: string,
  clave: string,
  contenido: Buffer,
): Promise<string> {
  const objeto = `${clave}.webp`;

  const { error } = await supabase.storage.from(bucket).upload(objeto, contenido, {
    contentType: "image/webp",
    cacheControl: "3600",
    upsert: true,
  });

  if (error) {
    throw new Error(
      `No se pudo subir ${bucket}/${objeto}: ${error.message}. Verificá que el bucket exista.`,
    );
  }

  return `${bucket}/${objeto}`;
}

/** Normaliza el slug para usarlo como nombre de objeto en Storage. */
function nombreSeguro(clave: string): string {
  // U+0300-U+036F es el bloque de marcas diacríticas que deja NFD al
  // separar los acentos. Escapado, para que la clase sea legible en el editor.
  return clave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function estiloDeRubro(rubro: string): Estilo {
  return ESTILO_POR_RUBRO[rubro] ?? ESTILO_POR_RUBRO.OTROS!;
}

function estiloDeCategoria(categoria: string): Estilo {
  return ESTILO_POR_CATEGORIA[categoria] ?? ESTILO_POR_RUBRO.OTROS!;
}

/** Portada de una feria, según su categoría. */
export async function generarImagenFeria(
  supabase: SupabaseClient,
  slug: string,
  categoria: string,
): Promise<string> {
  const { ancho, alto } = MEDIDAS.portada;
  const svg = armarSvg(estiloDeCategoria(categoria), ancho, alto, `feria:${slug}`);
  return subir(supabase, "ferias", nombreSeguro(slug), await aWebp(svg));
}

/** Portada y logo de un feriante, según su rubro. */
export async function generarImagenesVendedor(
  supabase: SupabaseClient,
  slug: string,
  rubro: string,
): Promise<{ imagenPortada: string; logo: string }> {
  const estilo = estiloDeRubro(rubro);
  const base = nombreSeguro(slug);

  const svgPortada = armarSvg(
    estilo,
    MEDIDAS.portada.ancho,
    MEDIDAS.portada.alto,
    `vendedor:${slug}`,
  );
  const svgLogo = armarSvgLogo(estilo, MEDIDAS.logo.ancho, slug);

  const [imagenPortada, logo] = await Promise.all([
    subir(supabase, "vendedores", `${base}-portada`, await aWebp(svgPortada)),
    subir(supabase, "vendedores", `${base}-logo`, await aWebp(svgLogo)),
  ]);

  return { imagenPortada, logo };
}

/** Foto de un producto. Hereda el rubro del feriante para que el set sea coherente. */
export async function generarImagenProducto(
  supabase: SupabaseClient,
  slugVendedor: string,
  indice: number,
  rubro: string,
): Promise<string> {
  const { ancho, alto } = MEDIDAS.producto;
  const clave = `${slugVendedor}-${indice}`;
  const svg = armarSvg(estiloDeRubro(rubro), ancho, alto, `producto:${clave}`);
  return subir(supabase, "productos", nombreSeguro(clave), await aWebp(svg));
}
