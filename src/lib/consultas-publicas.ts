import type { Prisma, Rubro } from "@prisma/client";

import { normalizar, puntuar } from "@/lib/busqueda-feriantes";
import { deLaFeria, edicionesVigentes } from "@/lib/consultas";
import { propuestasPublicadas } from "@/lib/consultas-sello-propio";
import { prisma } from "@/lib/db";
import { formatearRangoFechas, hoyEnZona } from "@/lib/format";
import { RUBROS } from "@/lib/labels";
import {
  MODALIDADES_SELLO_PROPIO,
  TIPOS_SELLO_PROPIO,
  tipoDeModalidad,
  type TipoSelloPropio,
} from "@/lib/sello-propio";

/*
  Lo que Migue consulta en el sitio público, en vez de recibir el padrón
  entero en cada pregunta.

  Hasta el 24/11/2026 el prompt llevaba una línea por cada feriante aprobado:
  990 fichas, casi todas sin descripción ni productos: unos 32.000 tokens por
  pregunta (medido con Gemini Flash), aunque la pregunta fuera «¿cuándo es la
  feria de artesanos?». Ahora el prompt lleva las ferias y cuántos feriantes hay por
  rubro, y Migue busca cuando la pregunta lo necesita.

  Todo es público y nada trae contacto: ni WhatsApp, ni teléfono, ni correo,
  ni redes. Para eso está el botón de cada página de stand.
*/

const MOSTRADOS = 8;

function recortar(texto: string | null | undefined, tope: number): string {
  if (!texto) return "";
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length <= tope ? limpio : `${limpio.slice(0, tope - 1)}…`;
}

export const RUBROS_PARA_BUSCAR = Object.keys(RUBROS) as Rubro[];

/**
 * Lo que no dice qué se busca: «busco», «hay», «venden», artículos. Se sacan
 * antes de comparar con los productos y las descripciones.
 */
const RELLENO = new Set([
  "la",
  "el",
  "los",
  "las",
  "lo",
  "un",
  "una",
  "unos",
  "unas",
  "de",
  "del",
  "al",
  "y",
  "e",
  "o",
  "en",
  "con",
  "sin",
  "por",
  "para",
  "que",
  "quien",
  "donde",
  "algo",
  "alguien",
  "hay",
  "busco",
  "buscar",
  "quiero",
  "necesito",
  "consigo",
  "conseguir",
  "comprar",
  "vende",
  "venden",
  "vendan",
  "feria",
  "ferias",
  "puesto",
  "stand",
  "don",
  "dona",
]);

/**
 * La palabra sin el plural, que es lo que más separa lo que escribe la gente
 * de lo que cargó el feriante: «alfajores» tiene que encontrar «Casa del
 * Alfajor», y «velas», «Vela de soja».
 */
export function raiz(palabra: string): string {
  if (palabra.length > 5 && /[^aeiou]es$/.test(palabra)) {
    return palabra.slice(0, -2);
  }
  if (palabra.length > 3 && palabra.endsWith("s")) return palabra.slice(0, -1);
  return palabra;
}

/** Lo que se compara de cada feriante en el buscador público. */
export interface FichaPublica {
  emprendimiento: string;
  slug: string;
  descripcion?: string | null;
  productos: Array<{ nombre: string; descripcion?: string | null }>;
}

/** Si alguna palabra del texto empieza con la raíz (las cortas, enteras). */
function aparece(raizBuscada: string, palabras: string[]): boolean {
  return raizBuscada.length >= 4
    ? palabras.some((palabra) => palabra.startsWith(raizBuscada))
    : palabras.some(
        (palabra) =>
          palabra === raizBuscada ||
          palabra === `${raizBuscada}s` ||
          palabra === `${raizBuscada}es`,
      );
}

const enPalabras = (texto: string | null | undefined) =>
  texto ? normalizar(texto).split(" ").filter(Boolean) : [];

/**
 * Qué tan bien coincide un feriante con lo que se escribió; 0 es que no.
 *
 * El nombre se compara con la misma búsqueda tolerante del panel
 * (`puntuar`), pero sólo contra el nombre del emprendimiento y el slug:
 * nunca contra el nombre de quien lo lleva, que el sitio público no muestra.
 * Escrito todo junto («viejaescuela») también vale.
 *
 * Además, cada palabra suma según dónde aparece: en el nombre 4, en un
 * producto 3, en una descripción 2; y si no aparece, sus cinco primeras
 * letras —sólo en palabras largas— suman 1, para que «aromáticas» traiga a
 * «Aroma y Calma» cuando no hay nada mejor.
 */
export function relevancia(consulta: string, ficha: FichaPublica): number {
  const porNombre = puntuar(consulta, {
    emprendimiento: ficha.emprendimiento,
    slug: ficha.slug,
  });

  const palabras = normalizar(consulta)
    .split(" ")
    .filter((palabra) => palabra.length >= 3 && !RELLENO.has(palabra));
  const junto = palabras.join("");
  const nombreJunto = normalizar(ficha.emprendimiento).replace(/ /g, "");
  const todoJunto = junto.length >= 6 && nombreJunto.includes(junto) ? 60 : 0;

  const nombre = [
    ...enPalabras(ficha.emprendimiento),
    ...enPalabras(ficha.slug),
  ];
  const productos = ficha.productos.flatMap((producto) =>
    enPalabras(producto.nombre),
  );
  const descripciones = [
    ...enPalabras(ficha.descripcion),
    ...ficha.productos.flatMap((producto) => enPalabras(producto.descripcion)),
  ];
  const todas = [...nombre, ...productos, ...descripciones];

  let contenido = 0;
  for (const palabra of palabras) {
    const buscada = raiz(palabra);
    if (aparece(buscada, nombre)) contenido += 4;
    else if (aparece(buscada, productos)) contenido += 3;
    else if (aparece(buscada, descripciones)) contenido += 2;
    else if (palabra.length >= 7 && aparece(palabra.slice(0, 5), todas))
      contenido += 1;
  }

  return Math.max(porNombre, todoJunto, contenido * 15);
}

/**
 * Feriantes por nombre, por lo que venden, por rubro o por feria. Los
 * criterios se suman: «alfajores en la feria de emprendedores».
 */
export async function buscarFeriantesPublicos(criterios: {
  texto?: string;
  rubro?: Rubro;
  feria?: string;
}) {
  const texto = criterios.texto?.trim() ?? "";
  if (!texto && !criterios.rubro && !criterios.feria) {
    return {
      error:
        "Decí qué buscar: un nombre, algo que vendan, un rubro o una feria.",
    };
  }

  const condiciones: Prisma.VendedorWhereInput[] = [{ estado: "APROBADO" }];
  if (criterios.rubro) condiciones.push({ rubro: criterios.rubro });
  if (criterios.feria) {
    condiciones.push(deLaFeria({ slug: criterios.feria, activa: true }));
  }

  // Son unas mil fichas cortas: se puntúan acá, como el buscador del panel,
  // porque la base no tiene `unaccent` ni trigramas.
  const candidatos = await prisma.vendedor.findMany({
    where: { AND: condiciones },
    orderBy: { emprendimiento: "asc" },
    select: {
      id: true,
      emprendimiento: true,
      slug: true,
      descripcion: true,
      productos: {
        where: { publicado: true, disponible: true },
        select: { nombre: true, descripcion: true },
      },
    },
  });

  let elegidos = candidatos.map((ficha) => ({ id: ficha.id, puntos: 1 }));
  let soloParecidos = false;
  if (texto) {
    const puntuados = candidatos
      .map((ficha) => ({ id: ficha.id, puntos: relevancia(texto, ficha) }))
      .filter((ficha) => ficha.puntos > 0)
      .sort((uno, otro) => otro.puntos - uno.puntos);
    // Si hay coincidencias buenas, las flojas sobran: «velas aromáticas» con
    // feriantes que venden velas no trae a todos los que tienen «aroma».
    const mejor = puntuados[0]?.puntos ?? 0;
    elegidos = puntuados.filter(
      (ficha) => ficha.puntos >= Math.min(30, mejor / 2),
    );
    // Y si sólo hay flojas, que lo sepa: sin esto, ante «velas aromáticas»
    // presentaba a los de «Aroma…» como si vendieran velas.
    soloParecidos = mejor > 0 && mejor < 30;
  }

  const hoy = hoyEnZona();
  const ids = elegidos.slice(0, MOSTRADOS).map((ficha) => ficha.id);
  const detalle = await prisma.vendedor.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      emprendimiento: true,
      slug: true,
      rubro: true,
      descripcion: true,
      productos: {
        where: { publicado: true, disponible: true },
        orderBy: [{ destacado: "desc" }, { nombre: "asc" }],
        take: 5,
        select: { nombre: true },
      },
      postulaciones: {
        where: { estado: "ACEPTADA", feria: { activa: true } },
        select: { feria: { select: { nombre: true } } },
      },
      stands: {
        where: { edicion: edicionesVigentes(hoy) },
        select: {
          edicion: { select: { feria: { select: { nombre: true } } } },
        },
      },
    },
  });
  const porId = new Map(detalle.map((vendedor) => [vendedor.id, vendedor]));
  const mostrados = ids
    .map((id) => porId.get(id))
    .filter((vendedor) => vendedor !== undefined);

  const filtros = new URLSearchParams();
  if (texto) filtros.set("q", texto);
  if (criterios.rubro) filtros.set("rubro", criterios.rubro);
  if (criterios.feria) filtros.set("feria", criterios.feria);

  return {
    total: elegidos.length,
    ...(soloParecidos
      ? {
          aviso:
            "Ninguno dice eso en su nombre, en sus productos ni en su descripción: sólo tienen nombres parecidos. Decilo así, como algo que quizás tengan y conviene consultarles.",
        }
      : {}),
    feriantes: mostrados.map((vendedor) => ({
      emprendimiento: vendedor.emprendimiento,
      pagina: `/stands/${vendedor.slug}`,
      rubro: RUBROS[vendedor.rubro],
      ferias: [
        ...new Set([
          ...vendedor.postulaciones.map((p) => p.feria.nombre),
          ...vendedor.stands.map((s) => s.edicion.feria.nombre),
        ]),
      ],
      descripcion: recortar(vendedor.descripcion, 160) || undefined,
      productos: vendedor.productos.map((producto) => producto.nombre),
    })),
    ...(elegidos.length > mostrados.length
      ? {
          nota: `Coinciden ${elegidos.length}; acá van ${mostrados.length}, de la mejor coincidencia a la peor. Todos, en el catálogo filtrado: /stands?${filtros.toString()}`,
        }
      : {}),
  };
}

/** Todo lo público de un feriante, por su slug. Sin datos de contacto. */
export async function verFeriantePublico(slug: string) {
  const hoy = hoyEnZona();
  const vendedor = await prisma.vendedor.findFirst({
    where: { slug, estado: "APROBADO" },
    select: {
      emprendimiento: true,
      slug: true,
      rubro: true,
      descripcion: true,
      productos: {
        where: { publicado: true },
        orderBy: [{ destacado: "desc" }, { nombre: "asc" }],
        take: 30,
        select: { nombre: true, descripcion: true, disponible: true },
      },
      postulaciones: {
        where: { estado: "ACEPTADA", feria: { activa: true } },
        select: { feria: { select: { nombre: true, slug: true } } },
      },
      stands: {
        where: { edicion: edicionesVigentes(hoy) },
        select: {
          numero: true,
          edicion: {
            select: {
              fechaInicio: true,
              fechaFin: true,
              feria: { select: { nombre: true } },
            },
          },
        },
      },
      propuestasSelloPropio: {
        where: { publicada: true },
        select: { titulo: true, modalidad: true },
      },
    },
  });
  if (!vendedor) return { error: "No hay ningún feriante con ese slug." };

  return {
    emprendimiento: vendedor.emprendimiento,
    pagina: `/stands/${vendedor.slug}`,
    rubro: RUBROS[vendedor.rubro],
    descripcion: recortar(vendedor.descripcion, 600) || "Sin descripción.",
    habilitadoEn: vendedor.postulaciones.map((p) => ({
      feria: p.feria.nombre,
      pagina: `/ferias/${p.feria.slug}`,
    })),
    proximosStands: vendedor.stands.map((stand) => ({
      feria: stand.edicion.feria.nombre,
      cuando: formatearRangoFechas(
        stand.edicion.fechaInicio,
        stand.edicion.fechaFin,
      ),
      stand: stand.numero,
    })),
    productos:
      vendedor.productos.length > 0
        ? vendedor.productos.map((producto) => ({
            nombre: producto.nombre,
            descripcion: recortar(producto.descripcion, 200) || undefined,
            ...(producto.disponible ? {} : { sinStock: true }),
          }))
        : "Todavía no cargó productos.",
    modoFeria: vendedor.propuestasSelloPropio.map((propuesta) => ({
      titulo: propuesta.titulo,
      que: MODALIDADES_SELLO_PROPIO[propuesta.modalidad],
      pagina: TIPOS_SELLO_PROPIO[tipoDeModalidad(propuesta.modalidad)].href,
    })),
    contacto: "Con el botón de WhatsApp de su página.",
  };
}

/** Las propuestas publicadas de Modo Feria, de un tipo o de los dos. */
export async function modoFeriaPublico(tipo?: TipoSelloPropio) {
  const tipos: TipoSelloPropio[] = tipo ? [tipo] : ["REGALO", "SERVICIO"];
  const porTipo = await Promise.all(tipos.map((t) => propuestasPublicadas(t)));

  return tipos.map((t, indice) =>
    porTipo[indice]!.length === 0
      ? // Sin la página: que no mande a nadie a una página vacía.
        {
          tipo: TIPOS_SELLO_PROPIO[t].titulo,
          aviso: "Todavía no hay propuestas publicadas de este tipo.",
        }
      : {
          tipo: TIPOS_SELLO_PROPIO[t].titulo,
          pagina: TIPOS_SELLO_PROPIO[t].href,
          propuestas: porTipo[indice]!.slice(0, 12).map((propuesta) => ({
            titulo: propuesta.titulo,
            que: MODALIDADES_SELLO_PROPIO[propuesta.modalidad],
            feriante: propuesta.vendedor.emprendimiento,
            paginaDelFeriante: `/stands/${propuesta.vendedor.slug}`,
            descripcion: recortar(propuesta.descripcion, 200),
            // El precio orientativo está en la tarjeta. Acá no va: la regla de
            // Migue es que los precios se consultan al feriante, y una excepción
            // en los datos lo confunde con los de los productos.
          })),
        },
  );
}

/** Cuántos feriantes hay, en total y por rubro: va en el prompt, es corto. */
export async function feriantesPorRubro(): Promise<string> {
  const grupos = await prisma.vendedor.groupBy({
    by: ["rubro"],
    where: { estado: "APROBADO" },
    _count: true,
  });
  const total = grupos.reduce((suma, grupo) => suma + grupo._count, 0);
  const detalle = grupos
    .sort((uno, otro) => otro._count - uno._count)
    .map((grupo) => `${RUBROS[grupo.rubro]}: ${grupo._count}`)
    .join("; ");
  return `${total} feriantes en el catálogo. Por rubro: ${detalle}.`;
}
