import { prisma } from "@/lib/db";

/**
 * Buscar un feriante como lo nombra la gente.
 *
 * En la Dirección nadie dice «el emprendimiento con slug dona-rosita»: dicen
 * «Doña Rosita», «la de los tejidos de Rosa» o escriben «rosita» sin tilde y
 * con un error de tipeo. Esto lo resuelve sin depender de la base: trae los
 * nombres de todas las fichas —son unas mil, y son cuatro columnas cortas— y
 * los compara normalizados. Postgres podría hacerlo con `unaccent` y trigramas,
 * pero esas extensiones no están instaladas, y a este volumen no hace falta.
 *
 * La usan el buscador de «Feriantes» y Migue en el panel, así los dos
 * encuentran lo mismo con las mismas palabras.
 */

/** Sin tildes, en minúsculas y sin signos: «Doña Rosita!» → «dona rosita». */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/**
 * Palabras que no distinguen a nadie: tratamientos y artículos. «Doña Rosita»
 * tiene que encontrar a «Rosita Dulces», y «la de los tejidos», a «Tejidos
 * del Norte».
 */
const SIN_PESO = new Set([
  "don",
  "dona",
  "sr",
  "sra",
  "srta",
  "senor",
  "senora",
  "la",
  "el",
  "los",
  "las",
  "de",
  "del",
  "y",
  "e",
]);

function palabras(texto: string): string[] {
  const todas = normalizar(texto).split(" ").filter(Boolean);
  const conPeso = todas.filter((palabra) => !SIN_PESO.has(palabra));
  // Si la consulta es sólo eso («Don»), se busca igual.
  return conPeso.length > 0 ? conPeso : todas;
}

/** Distancia de edición con corte: sólo importa saber si es 0, 1 o más. */
function distancia(a: string, b: string, tope: number): number {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, indice) => indice);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    let minimo = i;
    for (let j = 1; j <= b.length; j++) {
      const valor = Math.min(
        previa[j]! + 1,
        actual[j - 1]! + 1,
        previa[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      actual.push(valor);
      minimo = Math.min(minimo, valor);
    }
    if (minimo > tope) return tope + 1;
    previa = actual;
  }
  return previa[b.length]!;
}

/** Lo que se compara de cada ficha. */
export interface NombresDeFicha {
  emprendimiento: string;
  responsable?: string | null;
  slug?: string | null;
}

/**
 * Qué tan bien coincide una ficha con lo que se escribió. 0 es que no
 * coincide; cuanto más alto, mejor.
 *
 *   100  el nombre entero, tal cual («doña rosita» → «Doña Rosita»)
 *    80  el nombre empieza con lo escrito (en palabras enteras)
 *    60  lo escrito aparece entero dentro del nombre (en palabras enteras)
 *  20+   cada palabra aparece en algún nombre: entera suma 3, como comienzo de
 *        palabra 2 (sólo si tiene 5 letras o más: «rosa» no puede traer a
 *        «Rosales», «Rosalía» y «Rosario»), y con un error de tipeo 1 (desde 4
 *        letras y contra palabras de 5 o más: «viea» encuentra «vieja», pero
 *        «rosa» no encuentra «casa»). Si alguna palabra no aparece en ningún
 *        lado, no coincide.
 */
export function puntuar(consulta: string, ficha: NombresDeFicha): number {
  const entera = normalizar(consulta);
  if (!entera) return 0;

  const campos = [ficha.emprendimiento, ficha.responsable, ficha.slug]
    .filter((campo): campo is string => Boolean(campo))
    .map(normalizar);

  const sinTratamientos = palabras(consulta).join(" ");
  for (const variante of [entera, sinTratamientos]) {
    if (campos.some((campo) => campo === variante)) return 100;
  }
  // Por palabras enteras: «rosa» no es el comienzo de «rosales carla».
  for (const variante of [entera, sinTratamientos]) {
    if (campos.some((campo) => `${campo} `.startsWith(`${variante} `)))
      return 80;
  }
  for (const variante of [entera, sinTratamientos]) {
    if (campos.some((campo) => ` ${campo} `.includes(` ${variante} `)))
      return 60;
  }

  const delaFicha = campos.flatMap((campo) => campo.split(" "));
  let puntos = 20;
  for (const palabra of palabras(consulta)) {
    if (delaFicha.includes(palabra)) {
      puntos += 3;
    } else if (
      palabra.length >= 5 &&
      delaFicha.some((otra) => otra.startsWith(palabra))
    ) {
      puntos += 2;
    } else if (
      palabra.length >= 4 &&
      delaFicha.some(
        (otra) => otra.length >= 5 && distancia(palabra, otra, 1) <= 1,
      )
    ) {
      puntos += 1;
    } else {
      return 0;
    }
  }
  return puntos;
}

/**
 * Los ids de las fichas que coinciden, de la mejor a la peor.
 *
 * El nombre del titular sale de su cuenta si la tiene, y si no, del padrón:
 * igual que en la lista de feriantes (`titularDe`).
 */
export async function buscarFeriantes(
  texto: string,
  limite = 8,
): Promise<string[]> {
  if (normalizar(texto).length < 2) return [];

  const fichas = await prisma.vendedor.findMany({
    select: {
      id: true,
      emprendimiento: true,
      nombreResponsable: true,
      slug: true,
      usuario: { select: { nombre: true } },
    },
  });

  return fichas
    .map((ficha) => {
      const puntos = Math.max(
        puntuar(texto, {
          emprendimiento: ficha.emprendimiento,
          responsable: ficha.usuario?.nombre ?? ficha.nombreResponsable,
          slug: ficha.slug,
        }),
        // El nombre del padrón también vale aunque la cuenta diga otro: es el
        // que conoce la Dirección de antes.
        ficha.usuario && ficha.nombreResponsable
          ? puntuar(texto, {
              emprendimiento: ficha.emprendimiento,
              responsable: ficha.nombreResponsable,
            })
          : 0,
      );
      return { id: ficha.id, nombre: ficha.emprendimiento, puntos };
    })
    .filter((ficha) => ficha.puntos > 0)
    .sort(
      (a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, "es"),
    )
    .filter((ficha, _indice, todas) => alcanza(ficha.puntos, todas[0]!.puntos))
    .slice(0, limite)
    .map((ficha) => ficha.id);
}

/**
 * Si hay coincidencias buenas, las flojas sobran.
 *
 * Con un nombre que aparece entero (60 o más) se quedan todas las que también
 * lo tienen entero. Si no, se quedan las que están a un punto de la mejor: eso
 * deja pasar una palabra que sólo es comienzo de otra («maria» en «mariana»),
 * pero no un error de tipeo, que vale dos menos. Así «Noelia Pérez» no trae a
 * «Jerez Jessica Noelia» cuando hay una Noelia Pérez de verdad.
 */
export function alcanza(puntos: number, mejor: number): boolean {
  return mejor >= 60 ? puntos >= 60 : puntos >= mejor - 1;
}
