/**
 * Lectura y traducción del padrón de Mi Feria Digital.
 *
 * Mi Feria Digital (miferiadigital.smt.gob.ar) es la otra plataforma de ferias
 * del municipio: un catálogo en React sobre Firestore, con unos 867
 * emprendimientos reales verificados por la Dirección. Este módulo entiende la
 * forma de esos datos y la traduce a la nuestra. No toca la base: eso lo hace
 * `importar-feria-digital.ts`.
 *
 * Está separado a propósito. El mapeo de rubros es la parte que va a cambiar
 * —cada vez que aparezca un rubro nuevo en el padrón hay que agregarlo acá— y
 * conviene poder leerlo y corregirlo sin leer el script de importación.
 *
 * La forma de los documentos está sacada del bundle público de su sitio
 * (`emprendedorService`), que normaliza cada documento así:
 *
 *   nombre_emprendimiento, nombre_responsable, nombre, apellido,
 *   nombre_completo, telefono, whatsapp, email, instagram, facebook, tiktok,
 *   youtube, website, descripcion, logo_url, imagenes[], feria, rubros[],
 *   productos[], activo, estado, dni, domicilio, cpostal, userId, createdAt
 */

import { Rubro } from "@prisma/client";

/** Documento del padrón, ya aplanado y sin los tipos de Firestore. */
export interface FichaPadron {
  id: string;
  [campo: string]: unknown;
}

// ---------------------------------------------------------------------------
// Desarmado del export
// ---------------------------------------------------------------------------

/**
 * Un valor de la API REST de Firestore viene envuelto en su tipo:
 * `{ stringValue: "Cuero Tuc" }`, `{ arrayValue: { values: [...] } }`.
 *
 * Soportamos esa forma además de la plana porque todavía no sabemos cómo nos
 * van a pasar el export: un volcado del Admin SDK sale plano, uno de la API
 * REST sale envuelto, y pedir que lo conviertan ellos es una ida y vuelta de
 * días por algo que son veinte líneas.
 */
function desenvolver(valor: unknown): unknown {
  if (valor === null || typeof valor !== "object") return valor;

  const v = valor as Record<string, unknown>;

  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);

  if ("arrayValue" in v) {
    const arreglo = v.arrayValue as { values?: unknown[] } | null;
    return (arreglo?.values ?? []).map(desenvolver);
  }

  if ("mapValue" in v) {
    const mapa = v.mapValue as { fields?: Record<string, unknown> } | null;
    return desenvolverCampos(mapa?.fields ?? {});
  }

  return valor;
}

function desenvolverCampos(
  campos: Record<string, unknown>,
): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const [nombre, valor] of Object.entries(campos)) {
    salida[nombre] = desenvolver(valor);
  }
  return salida;
}

const ERROR_FORMATO =
  "El archivo no es ni un arreglo de fichas ni un objeto con `emprendedores` o `documents`.";

/**
 * Saca la lista de fichas de cualquiera de las formas en que puede llegar el
 * export: un arreglo pelado, `{ emprendedores: [...] }`, la respuesta de la
 * API REST de Firestore (`{ documents: [{ name, fields }] }`) o un objeto
 * indexado por id.
 */
export function leerPadron(crudo: unknown): FichaPadron[] {
  if (Array.isArray(crudo)) {
    return crudo.map((fila, indice) => comoFicha(fila, indice));
  }

  if (crudo === null || typeof crudo !== "object") {
    throw new Error(ERROR_FORMATO);
  }

  const objeto = crudo as Record<string, unknown>;

  if (Array.isArray(objeto.documents)) {
    return objeto.documents.map((documento, indice) => {
      const doc = documento as {
        name?: string;
        fields?: Record<string, unknown>;
      };
      // El id es el último segmento de `name`:
      // projects/…/databases/(default)/documents/emprendedores/10216233
      const id = doc.name?.split("/").pop() ?? "";
      const campos = desenvolverCampos(doc.fields ?? {});
      return comoFicha({ ...campos, id }, indice);
    });
  }

  for (const nombre of ["emprendedores", "data", "items"]) {
    const valor = objeto[nombre];
    if (Array.isArray(valor)) {
      return valor.map((fila, indice) => comoFicha(fila, indice));
    }
  }

  // Un export indexado: { "10216233": {...}, "10791761": {...} }
  const entradas = Object.entries(objeto);
  const pareceMapaDeFichas =
    entradas.length > 0 &&
    entradas.every(([, valor]) => valor !== null && typeof valor === "object");

  if (pareceMapaDeFichas) {
    return entradas.map(([id, valor], indice) =>
      comoFicha({ ...(valor as Record<string, unknown>), id }, indice),
    );
  }

  throw new Error(ERROR_FORMATO);
}

function comoFicha(fila: unknown, indice: number): FichaPadron {
  if (fila === null || typeof fila !== "object") {
    throw new Error(`La fila ${indice} del export no es un objeto.`);
  }
  const objeto = fila as Record<string, unknown>;
  const id = texto(objeto.id) ?? texto(objeto.ident) ?? "";
  return { ...objeto, id };
}

// ---------------------------------------------------------------------------
// Traducción de campos
// ---------------------------------------------------------------------------

/** Devuelve el valor como texto limpio, o `null` si no hay nada utilizable. */
export function texto(valor: unknown): string | null {
  if (typeof valor === "number") return String(valor);
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio === "" ? null : limpio;
}

/** Lista de textos, tolerando que venga un solo string o elementos objeto. */
export function listaDeTextos(valor: unknown): string[] {
  if (typeof valor === "string") {
    const uno = texto(valor);
    return uno ? [uno] : [];
  }
  if (!Array.isArray(valor)) return [];

  const salida: string[] = [];
  for (const elemento of valor) {
    if (elemento !== null && typeof elemento === "object") {
      const objeto = elemento as Record<string, unknown>;
      const nombre = texto(objeto.nombre) ?? texto(objeto.name);
      if (nombre) salida.push(nombre);
      continue;
    }
    const uno = texto(elemento);
    if (uno) salida.push(uno);
  }
  return salida;
}

/** Mayúsculas, sin tildes y con los espacios colapsados: la clave de búsqueda. */
export function clave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Rubros del padrón → nuestro enum `Rubro`.
 *
 * Son dos vocabularios distintos y la traducción pierde información: ellos
 * distinguen «artesanía en madera» de «artesanía en cerámica» y nosotros
 * tenemos un solo ARTESANIAS. Es aceptable porque acá el rubro es un filtro de
 * la vidriera, no una categoría fiscal.
 *
 * Las que no son obvias están marcadas. El importador imprime la cuenta de
 * cada traducción y la lista de las que cayeron en OTROS, justamente para que
 * la Dirección revise estas decisiones en vez de que queden enterradas acá.
 */
const RUBROS_EXACTOS: Record<string, Rubro> = {
  ARTESANIAS: Rubro.ARTESANIAS,
  ARTESANIA: Rubro.ARTESANIAS,
  GASTRONOMIA: Rubro.GASTRONOMIA,
  PANIFICADOS: Rubro.GASTRONOMIA,
  "PRODUCTOS REGIONALES": Rubro.PRODUCTOS_REGIONALES,
  REGIONALES: Rubro.PRODUCTOS_REGIONALES,
  INDUMENTARIA: Rubro.INDUMENTARIA,
  TEXTILES: Rubro.INDUMENTARIA,
  TEJIDOS: Rubro.INDUMENTARIA,
  MARROQUINERIA: Rubro.MARROQUINERIA,
  CUERO: Rubro.MARROQUINERIA,
  JOYERIA: Rubro.JOYERIA_Y_BIJOUTERIE,
  BIJOUTERIE: Rubro.JOYERIA_Y_BIJOUTERIE,
  "JOYERIA ARTESANAL": Rubro.JOYERIA_Y_BIJOUTERIE,
  ACCESORIOS: Rubro.JOYERIA_Y_BIJOUTERIE,
  DECORACION: Rubro.DECORACION,
  "VELAS Y AROMAS": Rubro.DECORACION,
  // Sahumerios, difusores y velas perfumadas: está más cerca de ambientación
  // que de cosmética. Decisión nuestra, a confirmar con la Dirección.
  "AROMAS Y ESENCIAS": Rubro.DECORACION,
  "COSMETICOS Y MAQUILLAJE": Rubro.COSMETICA_NATURAL,
  "COSMETICA NATURAL": Rubro.COSMETICA_NATURAL,
  COSMETICA: Rubro.COSMETICA_NATURAL,
  PERFUMERIA: Rubro.COSMETICA_NATURAL,
  LIBROS: Rubro.LIBROS_Y_ARTE,
  ARTE: Rubro.LIBROS_Y_ARTE,
  "LIBROS Y ARTE": Rubro.LIBROS_Y_ARTE,
  PINTURA: Rubro.LIBROS_Y_ARTE,
  PLANTAS: Rubro.HUERTA_Y_VIVERO,
  VIVERO: Rubro.HUERTA_Y_VIVERO,
  HUERTA: Rubro.HUERTA_Y_VIVERO,
  JARDINERIA: Rubro.HUERTA_Y_VIVERO,
  JUGUETES: Rubro.JUGUETES,
  "JUGUETES DIDACTICOS": Rubro.JUGUETES,
};

/**
 * Reglas por palabra, para lo que no está en la tabla exacta.
 *
 * El padrón tiene cientos de fichas con rubros escritos a mano durante años:
 * la tabla exacta no va a cubrirlos a todos. El orden importa —gana la primera
 * que coincide— y por eso lo específico va antes que lo general.
 */
const RUBROS_POR_PALABRA: Array<[RegExp, Rubro]> = [
  [/MARROQUINERIA|\bCUERO\b/, Rubro.MARROQUINERIA],
  [/ARTESANIA|ARTESANAL/, Rubro.ARTESANIAS],
  [/GASTRONOM|COMIDA|PASTELERIA|PANADERIA|REPOSTERIA/, Rubro.GASTRONOMIA],
  [/REGIONAL/, Rubro.PRODUCTOS_REGIONALES],
  [/INDUMENTARIA|\bROPA\b|TEXTIL|TEJIDO/, Rubro.INDUMENTARIA],
  [/JOYERIA|BIJOU|ORFEBRERIA/, Rubro.JOYERIA_Y_BIJOUTERIE],
  [/COSMETIC|MAQUILLAJE|PERFUM/, Rubro.COSMETICA_NATURAL],
  [/DECORACION|\bDECO\b|\bVELAS?\b|AROMA/, Rubro.DECORACION],
  [/LIBRO|\bARTE\b|PINTURA|ILUSTRACION/, Rubro.LIBROS_Y_ARTE],
  [/PLANTA|VIVERO|HUERTA|JARDIN/, Rubro.HUERTA_Y_VIVERO],
  [/JUGUETE|INFANTIL/, Rubro.JUGUETES],
];

export interface RubroTraducido {
  rubro: Rubro;
  /** El texto original, para poder reportar qué se tradujo y cómo. */
  origen: string | null;
  /** `false` cuando no se pudo traducir y cayó en OTROS. */
  reconocido: boolean;
}

export function traducirRubro(valor: unknown): RubroTraducido {
  const candidatos = listaDeTextos(valor);
  const primero = candidatos[0] ?? null;

  for (const candidato of candidatos) {
    const k = clave(candidato);

    const exacto = RUBROS_EXACTOS[k];
    if (exacto) return { rubro: exacto, origen: candidato, reconocido: true };

    for (const [patron, rubro] of RUBROS_POR_PALABRA) {
      if (patron.test(k)) return { rubro, origen: candidato, reconocido: true };
    }
  }

  return { rubro: Rubro.OTROS, origen: primero, reconocido: false };
}

/**
 * Slugs de feria del padrón, tal como los canoniza su propio sitio.
 *
 * Se guardan como vinieron, en `Vendedor.feriaOrigen`: acá la participación se
 * modela por edición a través de `Stand`, y el padrón no trae ni edición ni
 * número de puesto, así que no hay relación que armar. Es el dato que necesita
 * la Dirección para saber a quién convocar a cada feria.
 */
export const FERIAS_PADRON = [
  "gourmet",
  "artesanos",
  "emprendedores",
  "gastronomico",
  "v-centenario",
  "manantial-sur",
  "creadores-digitales",
  "plaza-sur",
  "plaza-congresales",
] as const;

const ALIAS_FERIA: Record<string, string> = {
  CENTENARIO: "v-centenario",
  "V CENTENARIO": "v-centenario",
  MANANTIAL: "manantial-sur",
  "MANANTIAL SUR": "manantial-sur",
  GASTRONOMICOS: "gastronomico",
  "PASEO GASTRONOMICO": "gastronomico",
  "FERIA GOURMET": "gourmet",
  "FERIA ARTESANOS": "artesanos",
  "FERIA DE ARTESANOS": "artesanos",
  "FERIA EMPRENDEDORES": "emprendedores",
  DIGITAL: "creadores-digitales",
  DIGITALES: "creadores-digitales",
  "FERIA DIGITAL": "creadores-digitales",
  CREADORES: "creadores-digitales",
  "CREADORES DIGITALES": "creadores-digitales",
  "EMPRENDEDORES DIGITALES": "creadores-digitales",
  "PLAZA SUR": "plaza-sur",
  "PLAZA CONGRESALES": "plaza-congresales",
};

export function traducirFeria(valor: unknown): string | null {
  const bruto = texto(valor);
  if (!bruto) return null;

  const comoSlug = bruto.trim().toLowerCase().replace(/\s+/g, "-");
  if ((FERIAS_PADRON as readonly string[]).includes(comoSlug)) return comoSlug;

  const alias = ALIAS_FERIA[clave(bruto)];
  if (alias) return alias;

  // Desconocida: se guarda igual, normalizada. Es información del padrón y
  // perderla sería peor que guardarla sin traducir.
  return comoSlug;
}
