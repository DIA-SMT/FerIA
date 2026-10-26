/**
 * Importa el padrón de Mi Feria Digital a nuestra base.
 *
 *   npm run db:importar -- padron.json              # simulacro, no escribe
 *   npm run db:importar -- padron.json --aplicar    # escribe
 *
 * Qué hace y qué no:
 *
 * · Trae las fichas de emprendimiento: nombre, responsable, rubro, contacto,
 *   redes y la feria de la que vienen. Queda en `origen = FERIA_DIGITAL` con
 *   el id de Firestore en `idExterno`, así correrlo de nuevo actualiza en vez
 *   de duplicar.
 *
 * · **No trae imágenes.** Los logos de ellos son URLs de su Firebase Storage y
 *   nuestras columnas guardan rutas de nuestro bucket de Supabase. Migrarlas
 *   es bajar y volver a subir ~900 archivos: es otro trabajo. El reporte dice
 *   cuántas fichas tienen logo para que se sepa qué queda pendiente.
 *
 * · **No las publica.** Entran en PENDIENTE. Publicar 867 fichas con nombre,
 *   teléfono y correo de personas reales en un dominio nuevo es una decisión
 *   de la Dirección y de Legales, no de un script: hace falta el aviso del
 *   art. 6 de la Ley 25.326 y que los términos digan de dónde salieron esos
 *   datos. Con `--aprobar` entran aprobadas, si esa decisión ya está tomada.
 *
 * · **No pisa lo que editó una persona.** Si alguien ya reclamó su ficha
 *   (`usuarioId` no nulo), sus datos son más nuevos que los del padrón y la
 *   importación la saltea.
 *
 * Es autocontenido salvo por dos módulos de `src/` que no importan nada a su
 * vez —`slug` y `whatsapp`—, así que `tsx` los resuelve por ruta relativa sin
 * necesitar los alias de TypeScript. Se importan en vez de copiarse porque la
 * validación de WhatsApp costó demasiado como para tener dos versiones: es la
 * que decide si el botón de contacto del stand le escribe a la persona
 * correcta o a cualquiera.
 */

import { readFileSync, writeFileSync } from "node:fs";

import { EstadoVendedor, OrigenVendedor, PrismaClient } from "@prisma/client";
import type { Rubro } from "@prisma/client";

import { generarSlug } from "../src/lib/slug";
import { normalizarWhatsapp } from "../src/lib/whatsapp";

import {
  leerPadron,
  listaDeTextos,
  texto,
  traducirFeria,
  traducirRubro,
  type FichaPadron,
} from "./feria-digital";

const prisma = new PrismaClient();

const ORIGEN = OrigenVendedor.FERIA_DIGITAL;

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

interface Opciones {
  archivo: string;
  aplicar: boolean;
  aprobar: boolean;
  conProductos: boolean;
}

function leerOpciones(): Opciones {
  const args = process.argv.slice(2);
  const archivo = args.find((arg) => !arg.startsWith("--"));

  if (!archivo) {
    console.error(
      "\n✗ Falta el archivo del padrón.\n\n" +
        "  npm run db:importar -- padron.json              simulacro\n" +
        "  npm run db:importar -- padron.json --aplicar    escribe\n\n" +
        "  Opciones:\n" +
        "    --aplicar         escribe en la base (por defecto sólo simula)\n" +
        "    --aprobar         las fichas entran APROBADO en vez de PENDIENTE\n" +
        "    --con-productos   crea los productos del padrón, ocultos\n",
    );
    process.exit(1);
  }

  return {
    archivo,
    aplicar: args.includes("--aplicar"),
    aprobar: args.includes("--aprobar"),
    conProductos: args.includes("--con-productos"),
  };
}

/**
 * Importar en producción es el objetivo, así que esto no aborta: avisa y pide
 * que lo digan en voz alta. Lo que no puede pasar es que alguien apunte a
 * producción sin darse cuenta y le meta 867 filas.
 */
function confirmarSiEsProduccion(aplicar: boolean): void {
  const refProd = process.env.PROYECTO_SUPABASE_PROD;
  const url = process.env.DATABASE_URL ?? "";

  if (!aplicar || !refProd || !url.includes(refProd)) return;

  if (process.env.PERMITIR_IMPORTAR_EN_PROD === "si") {
    console.warn(
      `\n⚠ Importando CONTRA PRODUCCIÓN (${refProd}).\n` +
        "  Antes de seguir: que esté hecho el pg_dump y rotada la service role key.\n",
    );
    return;
  }

  console.error(
    `\n✗ DATABASE_URL apunta a producción (${refProd}) y pediste --aplicar.\n\n` +
      "  Son datos personales de cientos de personas y la base todavía no tiene\n" +
      "  respaldo probado. Si ya está hecho, corré de nuevo con\n" +
      "  PERMITIR_IMPORTAR_EN_PROD=si.\n",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Traducción de una ficha
// ---------------------------------------------------------------------------

interface FichaLista {
  idExterno: string;
  emprendimiento: string;
  nombreResponsable: string | null;
  rubro: Rubro;
  rubroOrigen: string | null;
  rubroReconocido: boolean;
  whatsapp: string;
  telefono: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  sitioWeb: string | null;
  descripcion: string | null;
  dni: string | null;
  direccion: string | null;
  feriaOrigen: string | null;
  productos: string[];
  tieneLogo: boolean;
}

interface Omitida {
  idExterno: string;
  emprendimiento: string | null;
  motivo: string;
  dato: string | null;
}

function nombreResponsableDe(ficha: FichaPadron): string | null {
  const directo =
    texto(ficha.nombre_responsable) ?? texto(ficha.nombre_completo);
  if (directo) return directo;

  const nombre = texto(ficha.nombre);
  const apellido = texto(ficha.apellido);
  if (apellido && nombre) return `${apellido} ${nombre}`;
  return nombre ?? apellido;
}

function traducir(ficha: FichaPadron): FichaLista | Omitida {
  const emprendimiento =
    texto(ficha.nombre_emprendimiento) ?? texto(ficha.emprendimiento);

  if (!ficha.id) {
    return {
      idExterno: "",
      emprendimiento,
      motivo: "sin id en el export",
      dato: null,
    };
  }

  if (!emprendimiento) {
    return {
      idExterno: ficha.id,
      emprendimiento: null,
      motivo: "sin nombre de emprendimiento",
      dato: null,
    };
  }

  // El whatsapp es obligatorio porque es el botón de contacto del stand: una
  // ficha sin forma de contactar a la persona no sirve en la vidriera. Se
  // prueba también el teléfono fijo cargado, que en el padrón muchas veces es
  // en realidad el celular.
  const crudoWhatsapp = texto(ficha.whatsapp) ?? texto(ficha.telefono);
  const whatsapp = crudoWhatsapp ? normalizarWhatsapp(crudoWhatsapp) : null;

  if (!whatsapp) {
    return {
      idExterno: ficha.id,
      emprendimiento,
      motivo: crudoWhatsapp ? "whatsapp no válido" : "sin teléfono ni whatsapp",
      dato: crudoWhatsapp,
    };
  }

  const rubro = traducirRubro(ficha.rubros ?? ficha.rubro);

  return {
    idExterno: ficha.id,
    emprendimiento,
    nombreResponsable: nombreResponsableDe(ficha),
    rubro: rubro.rubro,
    rubroOrigen: rubro.origen,
    rubroReconocido: rubro.reconocido,
    whatsapp,
    telefono: texto(ficha.telefono),
    email: texto(ficha.email),
    instagram: texto(ficha.instagram),
    facebook: texto(ficha.facebook),
    sitioWeb: texto(ficha.website),
    descripcion: texto(ficha.descripcion),
    dni: texto(ficha.dni),
    direccion: texto(ficha.domicilio),
    feriaOrigen: traducirFeria(ficha.feria),
    productos: listaDeTextos(ficha.productos),
    tieneLogo: texto(ficha.logo_url) !== null,
  };
}

function esOmitida(valor: FichaLista | Omitida): valor is Omitida {
  return "motivo" in valor;
}

// ---------------------------------------------------------------------------
// Importación
// ---------------------------------------------------------------------------

interface Resultado {
  creadas: number;
  actualizadas: number;
  preservadas: number;
  productosCreados: number;
}

interface FilaExistente {
  slug: string;
  idExterno: string | null;
  origen: OrigenVendedor;
  usuarioId: string | null;
}

async function leerExistentes(aplicar: boolean): Promise<FilaExistente[]> {
  try {
    return await prisma.vendedor.findMany({
      select: { slug: true, idExterno: true, origen: true, usuarioId: true },
    });
  } catch (error) {
    if (aplicar) throw error;

    // Los mensajes de Prisma arrancan con saltos de línea y el bloque de
    // código de la consulta; la línea que explica qué pasó está más abajo.
    const detalle =
      error instanceof Error
        ? (error.message
            .split("\n")
            .map((linea) => linea.trim())
            .filter((linea) => linea !== "")
            .pop() ?? "sin detalle")
        : "sin detalle";

    console.warn(
      `\n⚠ No se pudo leer la base: ${detalle}\n` +
        "  El simulacro sigue igual, pero sin poder distinguir las fichas que\n" +
        "  ya estaban: las cuenta todas como nuevas.\n",
    );
    return [];
  }
}

async function importar(
  listas: FichaLista[],
  opciones: Opciones,
): Promise<Resultado> {
  const estado = opciones.aprobar
    ? EstadoVendedor.APROBADO
    : EstadoVendedor.PENDIENTE;

  // Los slugs existentes se cargan de una: resolver la unicidad con una
  // consulta por ficha serían 867 viajes a São Paulo.
  //
  // El simulacro tolera no tener base. Es a propósito: así la Dirección puede
  // correrlo sobre un export para ver qué entraría y qué se cae, desde una
  // máquina sin credenciales y antes de que la migración esté aplicada. Sin
  // base no se puede saber qué ficha ya existe, así que cuenta todo como
  // nueva y lo avisa. Con `--aplicar` el error se propaga: ahí sí hace falta.
  const existentes = await leerExistentes(opciones.aplicar);

  const slugsTomados = new Set(existentes.map((fila) => fila.slug));
  const yaImportadas = new Map(
    existentes
      .filter((fila) => fila.origen === ORIGEN && fila.idExterno !== null)
      .map((fila) => [fila.idExterno as string, fila]),
  );

  const resultado: Resultado = {
    creadas: 0,
    actualizadas: 0,
    preservadas: 0,
    productosCreados: 0,
  };

  for (const ficha of listas) {
    const previa = yaImportadas.get(ficha.idExterno);

    // Ya la reclamó una persona: lo que cargó ella gana sobre el padrón.
    if (previa?.usuarioId) {
      resultado.preservadas++;
      continue;
    }

    const datos = {
      emprendimiento: ficha.emprendimiento,
      nombreResponsable: ficha.nombreResponsable,
      rubro: ficha.rubro,
      descripcion: ficha.descripcion,
      whatsapp: ficha.whatsapp,
      telefono: ficha.telefono,
      email: ficha.email,
      instagram: ficha.instagram,
      facebook: ficha.facebook,
      sitioWeb: ficha.sitioWeb,
      dni: ficha.dni,
      direccion: ficha.direccion,
      feriaOrigen: ficha.feriaOrigen,
    };

    if (previa) {
      resultado.actualizadas++;
      if (opciones.aplicar) {
        await prisma.vendedor.update({
          where: {
            origen_idExterno: { origen: ORIGEN, idExterno: ficha.idExterno },
          },
          // El slug no se toca: ya puede estar publicado y compartido.
          data: datos,
        });
      }
      continue;
    }

    const slug = slugLibre(ficha.emprendimiento, slugsTomados);
    slugsTomados.add(slug);
    resultado.creadas++;

    if (opciones.aplicar) {
      await prisma.vendedor.create({
        data: {
          ...datos,
          slug,
          estado,
          origen: ORIGEN,
          idExterno: ficha.idExterno,
          productos:
            opciones.conProductos && ficha.productos.length > 0
              ? {
                  // Ocultos: lo que el padrón llama «productos» son palabras de
                  // rubro ("Aceites", "Fragancias"), sin precio ni foto. Sirven
                  // como punto de partida para que el feriante edite en vez de
                  // arrancar de una pantalla vacía, no para publicarlas así.
                  create: ficha.productos.map((nombre) => ({
                    nombre,
                    disponible: false,
                  })),
                }
              : undefined,
        },
      });
    }

    if (opciones.conProductos) {
      resultado.productosCreados += ficha.productos.length;
    }
  }

  return resultado;
}

function slugLibre(emprendimiento: string, tomados: Set<string>): string {
  const base = generarSlug(emprendimiento) || "sin-nombre";
  if (!tomados.has(base)) return base;

  for (let sufijo = 2; sufijo < 1000; sufijo++) {
    const candidato = `${base}-${sufijo}`;
    if (!tomados.has(candidato)) return candidato;
  }

  throw new Error(`No se pudo generar un slug libre para "${emprendimiento}".`);
}

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------

function contar(valores: Array<string | null>): Array<[string, number]> {
  const cuenta = new Map<string, number>();
  for (const valor of valores) {
    const clave = valor ?? "(sin dato)";
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
}

function imprimirTabla(titulo: string, filas: Array<[string, number]>): void {
  console.log(`\n${titulo}`);
  if (filas.length === 0) {
    console.log("  (nada)");
    return;
  }
  const ancho = Math.max(...filas.map(([etiqueta]) => etiqueta.length));
  for (const [etiqueta, cuenta] of filas) {
    console.log(`  ${etiqueta.padEnd(ancho)}  ${String(cuenta).padStart(4)}`);
  }
}

async function main(): Promise<void> {
  const opciones = leerOpciones();
  confirmarSiEsProduccion(opciones.aplicar);

  const crudo: unknown = JSON.parse(readFileSync(opciones.archivo, "utf8"));
  const fichas = leerPadron(crudo);

  console.log(`\nPadrón leído: ${fichas.length} fichas en ${opciones.archivo}`);

  const traducidas = fichas.map(traducir);
  const listas = traducidas.filter(
    (ficha): ficha is FichaLista => !esOmitida(ficha),
  );
  const omitidas = traducidas.filter(esOmitida);

  // Un mismo emprendimiento puede estar repetido en el padrón; el id de
  // Firestore es lo único que garantiza unicidad, así que se deduplica por ahí
  // antes de escribir y no después, cuando ya chocó el índice.
  const porId = new Map<string, FichaLista>();
  let duplicadas = 0;
  for (const ficha of listas) {
    if (porId.has(ficha.idExterno)) duplicadas++;
    porId.set(ficha.idExterno, ficha);
  }
  const unicas = [...porId.values()];

  imprimirTabla(
    "Rubros traducidos",
    contar(unicas.map((ficha) => ficha.rubro)),
  );
  imprimirTabla(
    "Ferias de origen",
    contar(unicas.map((ficha) => ficha.feriaOrigen)),
  );

  const sinReconocer = unicas.filter((ficha) => !ficha.rubroReconocido);
  imprimirTabla(
    `Rubros que cayeron en OTROS (${sinReconocer.length})`,
    contar(sinReconocer.map((ficha) => ficha.rubroOrigen)),
  );

  imprimirTabla("Fichas omitidas", contar(omitidas.map((o) => o.motivo)));

  const resultado = await importar(unicas, opciones);
  const conLogo = unicas.filter((ficha) => ficha.tieneLogo).length;

  console.log(
    [
      "",
      opciones.aplicar ? "Aplicado:" : "Simulacro (no se escribió nada):",
      `  fichas nuevas         ${resultado.creadas}`,
      `  fichas actualizadas   ${resultado.actualizadas}`,
      `  reclamadas, intactas  ${resultado.preservadas}`,
      `  omitidas              ${omitidas.length}`,
      `  duplicadas en origen  ${duplicadas}`,
      opciones.conProductos
        ? `  productos ocultos     ${resultado.productosCreados}`
        : "  productos             no se importaron (--con-productos)",
      "",
      `  estado de las nuevas  ${opciones.aprobar ? "APROBADO" : "PENDIENTE (no se publican)"}`,
      `  con logo en el origen ${conLogo} — las imágenes no se migran, ver el encabezado`,
      "",
    ].join("\n"),
  );

  const rutaReporte = `${opciones.archivo}.reporte.json`;
  writeFileSync(
    rutaReporte,
    JSON.stringify(
      {
        archivo: opciones.archivo,
        aplicado: opciones.aplicar,
        totales: {
          leidas: fichas.length,
          importables: unicas.length,
          omitidas: omitidas.length,
          duplicadas,
          ...resultado,
        },
        omitidas,
        rubrosSinReconocer: contar(
          sinReconocer.map((ficha) => ficha.rubroOrigen),
        ),
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Reporte detallado: ${rutaReporte}\n`);

  if (!opciones.aplicar) {
    console.log("Para escribir de verdad, repetí el comando con --aplicar.\n");
  }
}

main()
  .catch((error: unknown) => {
    console.error("\n✗ La importación falló:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
