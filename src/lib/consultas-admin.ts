import type { Prisma, Rubro } from "@prisma/client";

import { buscarFeriantes, normalizar, puntuar } from "@/lib/busqueda-feriantes";
import { prisma } from "@/lib/db";
import { SOLICITUD_PENDIENTE } from "@/lib/feriantes";
import {
  ZONA,
  diasDeDiferencia,
  formatearFecha,
  hoyEnZona,
} from "@/lib/format";
import { resumenHorario } from "@/lib/horarios";
import {
  CATEGORIAS_FERIA,
  ESTADOS_EDICION,
  ESTADOS_POSTULACION,
  ESTADOS_VENDEDOR,
  RUBROS,
} from "@/lib/labels";
import { tipoDelCambio } from "@/lib/revision";
import {
  TIPOS_DE_CAMBIO,
  esTipoDeCambio,
  type TipoDeCambio,
} from "@/lib/tipos-de-cambio";

/**
 * Las consultas que Migue puede hacer en el panel de administración.
 *
 * Tres reglas, y las tres son a propósito:
 *
 * · **Sólo leen.** Ninguna escribe, aprueba ni cambia nada. Si algún día Migue
 *   hace acciones, van por otro lado y con confirmación de un botón.
 * · **Sin datos de contacto ni documentos.** Lo que devuelven lo lee un modelo
 *   de un proveedor externo, así que salen el nombre del emprendimiento y el
 *   de quien lo lleva —hace falta para encontrar a «Doña Rosita»— y nada más:
 *   ni DNI, ni teléfono, ni correo, ni domicilio. Para eso está el enlace a la
 *   ficha, que se abre en el panel.
 * · **Los números los cuenta la base.** El modelo no suma ni estima: recibe el
 *   total hecho, y lo repite.
 *
 * Cada una devuelve un objeto chico y plano, con fechas ya escritas y enlaces
 * del panel, listo para pasárselo al modelo como JSON.
 */

const ficha = (id: string) => `/admin/feriantes/${id}`;

function fecha(valor: Date | null | undefined): string | null {
  return valor ? formatearFecha(valor) : null;
}

/** El día de Tucumán en que pasó algo, a medianoche UTC como `hoyEnZona`. */
function diaEnZona(valor: Date): Date {
  const [anio, mes, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(valor)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(anio!, mes! - 1, dia!));
}

/**
 * Días de calendario: algo de ayer a la tarde lleva 1 día, no 0. Contar horas
 * y redondear decía «hace 0 días» de un cambio que llegó ayer.
 */
function diasDesde(valor: Date, hoy: Date): number {
  return Math.max(0, diasDeDiferencia(diaEnZona(valor), hoy));
}

/** El titular, como en la lista de feriantes: la cuenta manda sobre el padrón. */
function responsable(vendedor: {
  nombreResponsable: string | null;
  usuario: { nombre: string } | null;
}): string | null {
  return vendedor.usuario?.nombre ?? vendedor.nombreResponsable ?? null;
}

// ---------------------------------------------------------------------------
// Ferias y rubros por nombre
// ---------------------------------------------------------------------------

interface FeriaResuelta {
  id: string;
  nombre: string;
  slug: string;
}

/**
 * La feria que se nombró, o las candidatas si hay más de una que coincide
 * igual de bien. «Gourmet» encuentra a la Feria Gourmet; «parque» puede ser
 * dos, y entonces Migue pregunta cuál.
 */
async function resolverFeria(
  texto: string,
): Promise<{ feria: FeriaResuelta } | { candidatas: string[] } | null> {
  const ferias = await prisma.feria.findMany({
    select: { id: true, nombre: true, slug: true },
  });
  const puntuadas = ferias
    .map((feria) => ({
      feria,
      puntos: puntuar(texto.replace(/\bferias?\b/gi, ""), {
        emprendimiento: feria.nombre.replace(/\bferias?\b/gi, ""),
        slug: feria.slug,
      }),
    }))
    .filter((opcion) => opcion.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos);

  if (puntuadas.length === 0) return null;
  const mejores = puntuadas.filter(
    (opcion) => opcion.puntos === puntuadas[0]!.puntos,
  );
  if (mejores.length > 1) {
    return { candidatas: mejores.map((opcion) => opcion.feria.nombre) };
  }
  return { feria: puntuadas[0]!.feria };
}

function resolverRubro(texto: string | undefined): Rubro | null {
  if (!texto) return null;
  const buscado = normalizar(texto);
  const entradas = Object.entries(RUBROS) as Array<[Rubro, string]>;
  const exacto = entradas.find(
    ([, etiqueta]) => normalizar(etiqueta) === buscado,
  );
  if (exacto) return exacto[0];
  const parcial = entradas.find(([valor, etiqueta]) => {
    const nombre = normalizar(etiqueta);
    return (
      nombre.includes(buscado) ||
      buscado.includes(nombre) ||
      normalizar(valor.replace(/_/g, " ")).includes(buscado)
    );
  });
  return parcial ? parcial[0] : null;
}

function resolverTipoDeCambio(texto: string | undefined): TipoDeCambio | null {
  if (!texto) return null;
  if (esTipoDeCambio(texto)) return texto;
  const buscado = normalizar(texto);
  const entradas = Object.entries(TIPOS_DE_CAMBIO) as Array<
    [TipoDeCambio, string]
  >;
  return (
    entradas.find(([, etiqueta]) =>
      normalizar(etiqueta).includes(buscado),
    )?.[0] ?? null
  );
}

const noEncontrada = (texto: string) => ({
  error: `No hay ninguna feria que se llame parecido a «${texto}».`,
});

const ambigua = (candidatas: string[]) => ({
  error: "Hay más de una feria que coincide. Preguntá cuál.",
  candidatas,
});

// ---------------------------------------------------------------------------
// Feriantes
// ---------------------------------------------------------------------------

/** Quién coincide con un nombre: del emprendimiento o de quien lo lleva. */
export async function buscarFeriantesAdmin(texto: string) {
  const ids = await buscarFeriantes(texto, 8);
  if (ids.length === 0) {
    return {
      coincidencias: [],
      nota: `No hay ningún feriante que coincida con «${texto}».`,
    };
  }

  const fichas = await prisma.vendedor.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      emprendimiento: true,
      nombreResponsable: true,
      rubro: true,
      estado: true,
      origen: true,
      usuario: { select: { nombre: true } },
      postulaciones: {
        where: { estado: "ACEPTADA" },
        select: { feria: { select: { id: true, nombre: true } } },
      },
    },
  });
  const porId = new Map(fichas.map((vendedor) => [vendedor.id, vendedor]));
  const ordenadas = ids
    .map((id) => porId.get(id))
    .filter((vendedor) => vendedor !== undefined);

  // El padrón importado trae fichas repetidas: el mismo emprendimiento de la
  // misma persona, dos veces. Se marcan para que Migue no pregunte «¿cuál de
  // las dos?» entre dos iguales, sino que avise que está repetida.
  const clave = (vendedor: (typeof ordenadas)[number]) =>
    `${normalizar(vendedor.emprendimiento)}|${normalizar(responsable(vendedor) ?? "")}`;
  const veces = new Map<string, number>();
  for (const vendedor of ordenadas) {
    veces.set(clave(vendedor), (veces.get(clave(vendedor)) ?? 0) + 1);
  }

  return {
    coincidencias: ordenadas.map((vendedor) => ({
      id: vendedor.id,
      emprendimiento: vendedor.emprendimiento,
      responsable: responsable(vendedor),
      rubro: RUBROS[vendedor.rubro],
      estado: ESTADOS_VENDEDOR[vendedor.estado],
      tieneCuenta: Boolean(vendedor.usuario),
      padronSinReclamar:
        vendedor.origen === "FERIA_DIGITAL" && !vendedor.usuario,
      fichaRepetida: (veces.get(clave(vendedor)) ?? 0) > 1,
      feriasHabilitadas: vendedor.postulaciones.map((postulacion) => ({
        feria: postulacion.feria.nombre,
        enlace: `/admin/ferias/${postulacion.feria.id}`,
      })),
      ficha: ficha(vendedor.id),
    })),
  };
}

/** Todo lo que hay que saber de un feriante, menos contacto y documentos. */
export async function fichaFerianteAdmin(id: string) {
  const hoy = hoyEnZona();
  const hace30 = new Date(hoy);
  hace30.setUTCDate(hace30.getUTCDate() - 30);

  const vendedor = await prisma.vendedor.findUnique({
    where: { id },
    select: {
      id: true,
      emprendimiento: true,
      slug: true,
      rubro: true,
      estado: true,
      motivoRechazo: true,
      origen: true,
      feriaOrigen: true,
      nombreResponsable: true,
      creadoEn: true,
      revisadoEn: true,
      usuario: { select: { nombre: true } },
      postulaciones: {
        orderBy: { creadoEn: "asc" },
        select: {
          estado: true,
          creadoEn: true,
          revisadoEn: true,
          motivoRechazo: true,
          feria: { select: { id: true, nombre: true } },
        },
      },
      stands: {
        where: { edicion: { fechaFin: { gte: hoy } } },
        orderBy: { edicion: { fechaInicio: "asc" } },
        select: {
          numero: true,
          edicion: {
            select: {
              id: true,
              nombre: true,
              fechaInicio: true,
              fechaFin: true,
              estado: true,
              feria: { select: { nombre: true } },
            },
          },
        },
      },
      cambios: {
        where: { estado: "PENDIENTE" },
        orderBy: { creadoEn: "asc" },
        select: {
          seccion: true,
          datos: true,
          creadoEn: true,
          producto: { select: { nombre: true } },
        },
      },
      _count: { select: { productos: { where: { borrador: false } } } },
    },
  });

  if (!vendedor) return { error: "No existe un feriante con ese id." };

  const [publicados, sinStock, interes] = await Promise.all([
    prisma.producto.count({ where: { vendedorId: id, publicado: true } }),
    prisma.producto.count({
      where: { vendedorId: id, publicado: true, disponible: false },
    }),
    prisma.interesStand.aggregate({
      where: { vendedorId: id, fecha: { gte: hace30 } },
      _sum: { aperturas: true, consultas: true },
    }),
  ]);

  return {
    emprendimiento: vendedor.emprendimiento,
    responsable: responsable(vendedor),
    rubro: RUBROS[vendedor.rubro],
    estado: ESTADOS_VENDEDOR[vendedor.estado],
    motivoDelRechazo:
      vendedor.estado === "RECHAZADO" ? vendedor.motivoRechazo : null,
    origen:
      vendedor.origen === "FERIA_DIGITAL"
        ? `Padrón importado de Feria Digital${vendedor.feriaOrigen ? ` (${vendedor.feriaOrigen})` : ""}`
        : "Se registró en la plataforma",
    tieneCuenta: Boolean(vendedor.usuario),
    altaEl: fecha(vendedor.creadoEn),
    revisadoEl: fecha(vendedor.revisadoEn),
    ferias: vendedor.postulaciones.map((postulacion) => ({
      feria: postulacion.feria.nombre,
      enlace: `/admin/ferias/${postulacion.feria.id}`,
      estado: ESTADOS_POSTULACION[postulacion.estado],
      pedidoEl: fecha(postulacion.creadoEn),
      resueltoEl: fecha(postulacion.revisadoEn),
      motivoDelRechazo:
        postulacion.estado === "RECHAZADA" ? postulacion.motivoRechazo : null,
    })),
    standsEnProximasEdiciones: vendedor.stands.map((stand) => ({
      feria: stand.edicion.feria.nombre,
      edicion: stand.edicion.nombre,
      desde: fecha(stand.edicion.fechaInicio),
      hasta: fecha(stand.edicion.fechaFin),
      estadoDeLaEdicion: ESTADOS_EDICION[stand.edicion.estado],
      numeroDeStand: stand.numero,
      enlace: `/admin/ediciones/${stand.edicion.id}`,
    })),
    cambiosEsperandoRevision: vendedor.cambios.map((cambio) => ({
      tipo: TIPOS_DE_CAMBIO[tipoDelCambio(cambio.seccion, cambio.datos)],
      producto: cambio.producto?.nombre ?? null,
      desde: fecha(cambio.creadoEn),
      diasEsperando: diasDesde(cambio.creadoEn, hoy),
    })),
    productos: {
      cargados: vendedor._count.productos,
      publicados,
      enRevision: vendedor._count.productos - publicados,
      publicadosSinStock: sinStock,
    },
    interesUltimos30Dias: {
      vecesQueAbrieronElStand: interes._sum.aperturas ?? 0,
      consultasPorWhatsapp: interes._sum.consultas ?? 0,
    },
    enlaces: {
      ficha: ficha(vendedor.id),
      ...(vendedor.estado === "APROBADO"
        ? { standPublico: `/stands/${vendedor.slug}` }
        : {}),
      ...(vendedor.cambios.length > 0
        ? { revisiones: "/admin/revisiones" }
        : {}),
    },
  };
}

/**
 * La ficha a partir de un nombre o de un id.
 *
 * Que se pueda pedir por nombre no es comodidad: en una pregunta de
 * seguimiento («¿y tiene cambios esperando revisión?») el modelo sólo tiene el
 * texto de lo que se habló antes, no los ids. Pedirle que los recuerde hizo
 * que una vez le pasara el id de una feria; con el nombre no hay qué recordar.
 */
export async function fichaPorNombreOId(texto: string) {
  // Los ids de Prisma son cuid: una «c» y más de veinte letras y números.
  if (/^c[a-z0-9]{20,}$/.test(texto)) {
    const porId = await fichaFerianteAdmin(texto);
    if (!("error" in porId)) return porId;
  }

  const { coincidencias } = await buscarFeriantesAdmin(texto);
  if (coincidencias.length === 0) {
    return { error: `No hay ningún feriante que coincida con «${texto}».` };
  }

  // Una sola, o una que coincide entera con lo escrito: es esa.
  const buscado = normalizar(texto);
  const exacta = coincidencias.filter(
    (coincidencia) => normalizar(coincidencia.emprendimiento) === buscado,
  );
  const elegida =
    coincidencias.length === 1
      ? coincidencias[0]
      : exacta.length === 1
        ? exacta[0]
        : null;
  if (elegida) return fichaFerianteAdmin(elegida.id);

  return {
    error: "Hay más de un feriante que coincide. Preguntá cuál.",
    coincidencias,
  };
}

// ---------------------------------------------------------------------------
// Lo que espera respuesta
// ---------------------------------------------------------------------------

/** Las ferias donde está habilitado cada feriante, para agrupar por feria. */
async function feriasHabilitadas(vendedorIds: string[]) {
  const aceptadas = await prisma.postulacion.findMany({
    where: { vendedorId: { in: vendedorIds }, estado: "ACEPTADA" },
    select: { vendedorId: true, feria: { select: { nombre: true } } },
  });
  const porVendedor = new Map<string, string[]>();
  for (const postulacion of aceptadas) {
    const lista = porVendedor.get(postulacion.vendedorId) ?? [];
    lista.push(postulacion.feria.nombre);
    porVendedor.set(postulacion.vendedorId, lista);
  }
  return porVendedor;
}

/** Cuánto hay pendiente en cada bandeja, desglosado. */
export async function resumenPendientes() {
  const hoy = hoyEnZona();

  const [altas, altaMasVieja, pedidos, cambios] = await Promise.all([
    prisma.vendedor.count({ where: SOLICITUD_PENDIENTE }),
    prisma.vendedor.findFirst({
      where: SOLICITUD_PENDIENTE,
      orderBy: { creadoEn: "asc" },
      select: { creadoEn: true },
    }),
    prisma.postulacion.findMany({
      where: { estado: "PENDIENTE", vendedor: { estado: "APROBADO" } },
      orderBy: { creadoEn: "asc" },
      select: { creadoEn: true, feria: { select: { nombre: true } } },
    }),
    prisma.cambioDelStand.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { creadoEn: "asc" },
      select: { seccion: true, datos: true, creadoEn: true, vendedorId: true },
    }),
  ]);

  const pedidosPorFeria: Record<string, number> = {};
  for (const pedido of pedidos) {
    pedidosPorFeria[pedido.feria.nombre] =
      (pedidosPorFeria[pedido.feria.nombre] ?? 0) + 1;
  }

  const ferias = await feriasHabilitadas([
    ...new Set(cambios.map((cambio) => cambio.vendedorId)),
  ]);
  const revisionesPorTipo: Record<string, number> = {};
  const revisionesPorFeria: Record<string, number> = {};
  for (const cambio of cambios) {
    const tipo = TIPOS_DE_CAMBIO[tipoDelCambio(cambio.seccion, cambio.datos)];
    revisionesPorTipo[tipo] = (revisionesPorTipo[tipo] ?? 0) + 1;
    const suyas = ferias.get(cambio.vendedorId) ?? ["Sin feria presencial"];
    for (const nombre of suyas) {
      revisionesPorFeria[nombre] = (revisionesPorFeria[nombre] ?? 0) + 1;
    }
  }

  return {
    altasDeFeriantes: {
      total: altas,
      laMasViejaEsperaDesde: fecha(altaMasVieja?.creadoEn),
      diasDeLaMasVieja: altaMasVieja
        ? diasDesde(altaMasVieja.creadoEn, hoy)
        : null,
      enlace: "/admin/postulaciones",
    },
    pedidosParaSumarseAUnaFeria: {
      total: pedidos.length,
      porFeria: pedidosPorFeria,
      laMasViejaEsperaDesde: fecha(pedidos[0]?.creadoEn),
      enlace: "/admin/postulaciones",
    },
    revisionesDeCambiosEnStands: {
      total: cambios.length,
      porTipo: revisionesPorTipo,
      porFeria: revisionesPorFeria,
      notaPorFeria:
        "Un feriante habilitado en dos ferias cuenta en las dos, así que la suma por feria puede pasar el total.",
      laMasViejaEsperaDesde: fecha(cambios[0]?.creadoEn),
      diasDeLaMasVieja: cambios[0] ? diasDesde(cambios[0].creadoEn, hoy) : null,
      enlace: "/admin/revisiones",
    },
  };
}

/**
 * Hasta cuántos ítems se le pasan al modelo en una lista. Más que esto no se
 * lee en el chat —y con 60, en las pruebas, la respuesta se cortó por largo—:
 * el resto se ve en el panel, con el enlace que va junto.
 */
const MAXIMO_LISTA = 15;

/** El detalle de una bandeja, de lo más viejo a lo más nuevo. */
export async function listarPendientes(argumentos: {
  bandeja: "altas" | "pedidos_de_feria" | "revisiones";
  feria?: string;
  tipoDeCambio?: string;
  conMasDeDias?: number;
}) {
  const hoy = hoyEnZona();
  const limite = new Date(hoy);
  if (argumentos.conMasDeDias && argumentos.conMasDeDias > 0) {
    limite.setUTCDate(limite.getUTCDate() - argumentos.conMasDeDias);
  }
  const antesDe = argumentos.conMasDeDias ? { lte: limite } : undefined;

  let feria: FeriaResuelta | null = null;
  if (argumentos.feria) {
    const resuelta = await resolverFeria(argumentos.feria);
    if (!resuelta) return noEncontrada(argumentos.feria);
    if ("candidatas" in resuelta) return ambigua(resuelta.candidatas);
    feria = resuelta.feria;
  }

  if (argumentos.bandeja === "altas") {
    // Una solicitud de alta no es de ninguna feria todavía: la feria que eligió
    // vive en su postulación pendiente.
    const where: Prisma.VendedorWhereInput = {
      ...SOLICITUD_PENDIENTE,
      ...(antesDe ? { creadoEn: antesDe } : {}),
      ...(feria ? { postulaciones: { some: { feriaId: feria.id } } } : {}),
    };
    const [total, altas] = await Promise.all([
      prisma.vendedor.count({ where }),
      prisma.vendedor.findMany({
        where,
        orderBy: { creadoEn: "asc" },
        take: MAXIMO_LISTA,
        select: {
          id: true,
          emprendimiento: true,
          nombreResponsable: true,
          rubro: true,
          creadoEn: true,
          usuario: { select: { nombre: true } },
          postulaciones: { select: { feria: { select: { nombre: true } } } },
        },
      }),
    ]);
    return {
      total,
      mostrados: altas.length,
      altas: altas.map((alta) => ({
        emprendimiento: alta.emprendimiento,
        responsable: responsable(alta),
        rubro: RUBROS[alta.rubro],
        quiereSumarseA: alta.postulaciones.map(
          (postulacion) => postulacion.feria.nombre,
        ),
        desde: fecha(alta.creadoEn),
        diasEsperando: diasDesde(alta.creadoEn, hoy),
        ficha: ficha(alta.id),
      })),
      enlace: "/admin/postulaciones",
    };
  }

  if (argumentos.bandeja === "pedidos_de_feria") {
    const where: Prisma.PostulacionWhereInput = {
      estado: "PENDIENTE",
      vendedor: { estado: "APROBADO" },
      ...(feria ? { feriaId: feria.id } : {}),
      ...(antesDe ? { creadoEn: antesDe } : {}),
    };
    const [total, pedidos] = await Promise.all([
      prisma.postulacion.count({ where }),
      prisma.postulacion.findMany({
        where,
        orderBy: { creadoEn: "asc" },
        take: MAXIMO_LISTA,
        select: {
          creadoEn: true,
          feria: { select: { nombre: true } },
          vendedor: {
            select: { id: true, emprendimiento: true, rubro: true },
          },
        },
      }),
    ]);
    return {
      total,
      mostrados: pedidos.length,
      pedidos: pedidos.map((pedido) => ({
        emprendimiento: pedido.vendedor.emprendimiento,
        rubro: RUBROS[pedido.vendedor.rubro],
        feria: pedido.feria.nombre,
        desde: fecha(pedido.creadoEn),
        diasEsperando: diasDesde(pedido.creadoEn, hoy),
        ficha: ficha(pedido.vendedor.id),
      })),
      enlace: "/admin/postulaciones",
    };
  }

  // Revisiones: la feria es la de las postulaciones aceptadas, como en la
  // bandeja. «sin feria» son los que no están habilitados en ninguna.
  const tipo = resolverTipoDeCambio(argumentos.tipoDeCambio);
  if (argumentos.tipoDeCambio && !tipo) {
    return {
      error: `No hay un tipo de cambio «${argumentos.tipoDeCambio}».`,
      tiposValidos: Object.values(TIPOS_DE_CAMBIO),
    };
  }
  const where: Prisma.CambioDelStandWhereInput = {
    estado: "PENDIENTE",
    ...(antesDe ? { creadoEn: antesDe } : {}),
    ...(feria
      ? {
          vendedor: {
            postulaciones: { some: { feriaId: feria.id, estado: "ACEPTADA" } },
          },
        }
      : {}),
  };
  const cambios = (
    await prisma.cambioDelStand.findMany({
      where,
      orderBy: { creadoEn: "asc" },
      select: {
        seccion: true,
        datos: true,
        creadoEn: true,
        producto: { select: { nombre: true } },
        vendedor: { select: { id: true, emprendimiento: true } },
      },
    })
  )
    .map((cambio) => ({
      ...cambio,
      tipo: tipoDelCambio(cambio.seccion, cambio.datos),
    }))
    .filter((cambio) => !tipo || cambio.tipo === tipo);

  const filtros = new URLSearchParams();
  if (tipo) filtros.set("tipo", tipo);
  if (feria) filtros.set("feria", feria.slug);

  return {
    total: cambios.length,
    mostrados: Math.min(cambios.length, MAXIMO_LISTA),
    revisiones: cambios.slice(0, MAXIMO_LISTA).map((cambio) => ({
      emprendimiento: cambio.vendedor.emprendimiento,
      tipo: TIPOS_DE_CAMBIO[cambio.tipo],
      producto: cambio.producto?.nombre ?? null,
      desde: fecha(cambio.creadoEn),
      diasEsperando: diasDesde(cambio.creadoEn, hoy),
      ficha: ficha(cambio.vendedor.id),
    })),
    enlace: `/admin/revisiones${filtros.size > 0 ? `?${filtros}` : ""}`,
  };
}

// ---------------------------------------------------------------------------
// Ferias y ediciones
// ---------------------------------------------------------------------------

/** Las ferias, o el detalle de una: ediciones que vienen, stands y habilitados. */
export async function feriasAdmin(argumentos: { feria?: string }) {
  const hoy = hoyEnZona();

  if (!argumentos.feria) {
    const ferias = await prisma.feria.findMany({
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        categoria: true,
        activa: true,
        direccion: true,
        ediciones: {
          where: { fechaFin: { gte: hoy } },
          orderBy: { fechaInicio: "asc" },
          take: 1,
          select: {
            fechaInicio: true,
            fechaFin: true,
            estado: true,
            lugar: true,
          },
        },
        _count: {
          select: {
            postulaciones: { where: { estado: "ACEPTADA" } },
          },
        },
      },
    });
    const pendientes = await prisma.postulacion.groupBy({
      by: ["feriaId"],
      where: { estado: "PENDIENTE", vendedor: { estado: "APROBADO" } },
      _count: true,
    });
    const pendientesPorFeria = new Map(
      pendientes.map((fila) => [fila.feriaId, fila._count]),
    );

    return {
      ferias: ferias.map((feria) => ({
        nombre: feria.nombre,
        categoria: CATEGORIAS_FERIA[feria.categoria],
        activa: feria.activa,
        direccion: feria.direccion || null,
        feriantesHabilitados: feria._count.postulaciones,
        pedidosParaSumarsePendientes: pendientesPorFeria.get(feria.id) ?? 0,
        proximaEdicion: feria.ediciones[0]
          ? {
              desde: fecha(feria.ediciones[0].fechaInicio),
              hasta: fecha(feria.ediciones[0].fechaFin),
              estado: ESTADOS_EDICION[feria.ediciones[0].estado],
              // Sólo si esa fecha es en otro lado que `direccion`.
              lugar: feria.ediciones[0].lugar?.trim() || null,
            }
          : null,
        enlace: `/admin/ferias/${feria.id}`,
      })),
    };
  }

  const resuelta = await resolverFeria(argumentos.feria);
  if (!resuelta) return noEncontrada(argumentos.feria);
  if ("candidatas" in resuelta) return ambigua(resuelta.candidatas);

  const feria = await prisma.feria.findUniqueOrThrow({
    where: { id: resuelta.feria.id },
    select: {
      id: true,
      nombre: true,
      slug: true,
      categoria: true,
      activa: true,
      direccion: true,
      ediciones: {
        where: { fechaFin: { gte: hoy } },
        orderBy: { fechaInicio: "asc" },
        select: {
          id: true,
          nombre: true,
          fechaInicio: true,
          fechaFin: true,
          diasSemana: true,
          horaApertura: true,
          horaCierre: true,
          horario: true,
          lugar: true,
          estado: true,
          cantidadStands: true,
          _count: {
            select: { stands: { where: { vendedorId: { not: null } } } },
          },
        },
      },
      postulaciones: {
        where: { estado: { in: ["ACEPTADA", "PENDIENTE"] } },
        select: {
          estado: true,
          vendedor: { select: { rubro: true, estado: true } },
        },
      },
    },
  });

  const habilitadosPorRubro: Record<string, number> = {};
  let habilitados = 0;
  let pedidos = 0;
  for (const postulacion of feria.postulaciones) {
    if (postulacion.estado === "ACEPTADA") {
      habilitados++;
      const rubro = RUBROS[postulacion.vendedor.rubro];
      habilitadosPorRubro[rubro] = (habilitadosPorRubro[rubro] ?? 0) + 1;
    } else if (postulacion.vendedor.estado === "APROBADO") {
      pedidos++;
    }
  }

  return {
    nombre: feria.nombre,
    categoria: CATEGORIAS_FERIA[feria.categoria],
    activa: feria.activa,
    direccion: feria.direccion || null,
    feriantesHabilitados: habilitados,
    habilitadosPorRubro,
    pedidosParaSumarsePendientes: pedidos,
    edicionesQueVienen: feria.ediciones.map((edicion) => ({
      nombre: edicion.nombre,
      desde: fecha(edicion.fechaInicio),
      hasta: fecha(edicion.fechaFin),
      horario: resumenHorario(edicion),
      lugar: edicion.lugar?.trim() || null,
      estado: ESTADOS_EDICION[edicion.estado],
      stands: edicion.cantidadStands,
      standsAsignados: edicion._count.stands,
      standsLibres: Math.max(0, edicion.cantidadStands - edicion._count.stands),
      enlace: `/admin/ediciones/${edicion.id}`,
    })),
    enlaces: {
      feria: `/admin/ferias/${feria.id}`,
      revisionesDeSusFeriantes: `/admin/revisiones?feria=${feria.slug}`,
      paginaPublica: `/ferias/${feria.slug}`,
    },
  };
}

const MAXIMO_FERIANTES = MAXIMO_LISTA;

/** Quiénes están habilitados en una feria, opcionalmente de un rubro. */
export async function feriantesDeFeria(argumentos: {
  feria: string;
  rubro?: string;
}) {
  const resuelta = await resolverFeria(argumentos.feria);
  if (!resuelta) return noEncontrada(argumentos.feria);
  if ("candidatas" in resuelta) return ambigua(resuelta.candidatas);

  const rubro = resolverRubro(argumentos.rubro);
  if (argumentos.rubro && !rubro) {
    return {
      error: `No hay un rubro «${argumentos.rubro}».`,
      rubrosValidos: Object.values(RUBROS),
    };
  }

  const where: Prisma.VendedorWhereInput = {
    postulaciones: { some: { feriaId: resuelta.feria.id, estado: "ACEPTADA" } },
    ...(rubro ? { rubro } : {}),
  };
  const [total, feriantes] = await Promise.all([
    prisma.vendedor.count({ where }),
    prisma.vendedor.findMany({
      where,
      orderBy: { emprendimiento: "asc" },
      take: MAXIMO_FERIANTES,
      select: { id: true, emprendimiento: true, rubro: true, estado: true },
    }),
  ]);

  return {
    feria: resuelta.feria.nombre,
    rubro: rubro ? RUBROS[rubro] : "todos",
    total,
    mostrados: feriantes.length,
    // La lista entera de la feria, en «Feriantes». El filtro de rubro no está
    // en esa pantalla: el enlace lleva a todos los de la feria.
    enlaceListaCompleta: `/admin/feriantes?feria=${resuelta.feria.slug}`,
    feriantes: feriantes.map((vendedor) => ({
      emprendimiento: vendedor.emprendimiento,
      rubro: RUBROS[vendedor.rubro],
      estado: ESTADOS_VENDEDOR[vendedor.estado],
      ficha: ficha(vendedor.id),
    })),
  };
}

// ---------------------------------------------------------------------------
// Números generales
// ---------------------------------------------------------------------------

export async function estadisticasAdmin() {
  const hoy = hoyEnZona();

  const [
    porEstado,
    porRubro,
    padron,
    conCuenta,
    sinProductos,
    productos,
    ferias,
    ediciones,
    standsAsignados,
  ] = await Promise.all([
    prisma.vendedor.groupBy({ by: ["estado"], _count: true }),
    prisma.vendedor.groupBy({
      by: ["rubro"],
      where: { estado: "APROBADO" },
      _count: true,
    }),
    prisma.vendedor.count({
      where: { origen: "FERIA_DIGITAL", usuarioId: null },
    }),
    prisma.vendedor.count({ where: { usuarioId: { not: null } } }),
    prisma.vendedor.count({
      where: { estado: "APROBADO", productos: { none: { publicado: true } } },
    }),
    prisma.producto.count({ where: { publicado: true } }),
    prisma.feria.count({ where: { activa: true } }),
    prisma.edicionFeria.count({
      where: {
        fechaFin: { gte: hoy },
        estado: { in: ["PUBLICADA", "EN_CURSO"] },
      },
    }),
    prisma.stand.count({
      where: { vendedorId: { not: null }, edicion: { fechaFin: { gte: hoy } } },
    }),
  ]);

  return {
    feriantesPorEstado: Object.fromEntries(
      porEstado.map((fila) => [ESTADOS_VENDEDOR[fila.estado], fila._count]),
    ),
    aprobadosPorRubro: Object.fromEntries(
      porRubro
        .sort((a, b) => b._count - a._count)
        .map((fila) => [RUBROS[fila.rubro], fila._count]),
    ),
    fichasDelPadronSinReclamar: padron,
    feriantesConCuenta: conCuenta,
    aprobadosSinProductosPublicados: sinProductos,
    notaProductos:
      "Cuenta productos publicados (ya aprobados por la Dirección): los que esperan revisión no cuentan.",
    productosPublicados: productos,
    feriasActivas: ferias,
    edicionesPublicadasQueNoTerminaron: ediciones,
    standsAsignadosEnEsasEdiciones: standsAsignados,
    enlace: "/admin",
  };
}

// ---------------------------------------------------------------------------
// Catálogo, público y vidriera
// ---------------------------------------------------------------------------

/** Quién vende algo: productos publicados, por nombre o descripción. */
export async function buscarProductosAdmin(texto: string) {
  const palabrasBuscadas = normalizar(texto)
    .split(" ")
    .filter((palabra) => palabra.length >= 3);
  if (palabrasBuscadas.length === 0) return { productos: [] };

  const productos = await prisma.producto.findMany({
    where: { publicado: true, vendedor: { estado: "APROBADO" } },
    select: {
      nombre: true,
      descripcion: true,
      disponible: true,
      vendedor: { select: { id: true, emprendimiento: true, slug: true } },
    },
  });

  // «milanesas» tiene que encontrar «Milanesa al plato»: se prueba también
  // la palabra en singular.
  const singular = (palabra: string) =>
    palabra.length > 4 && palabra.endsWith("es")
      ? [palabra.slice(0, -2), palabra.slice(0, -1)]
      : palabra.length > 3 && palabra.endsWith("s")
        ? [palabra.slice(0, -1)]
        : [];
  const coinciden = productos.filter((producto) => {
    const texto = normalizar(
      `${producto.nombre} ${producto.descripcion ?? ""}`,
    );
    return palabrasBuscadas.every((palabra) =>
      [palabra, ...singular(palabra)].some((forma) => texto.includes(forma)),
    );
  });

  return {
    total: coinciden.length,
    productos: coinciden.slice(0, 15).map((producto) => ({
      producto: producto.nombre,
      disponible: producto.disponible,
      emprendimiento: producto.vendedor.emprendimiento,
      ficha: ficha(producto.vendedor.id),
      standPublico: `/stands/${producto.vendedor.slug}`,
    })),
  };
}

/** Lo que le preguntaron a Migue en el sitio público (registro anónimo). */
export async function consultasDelPublico(argumentos: { dias?: number }) {
  const dias = Math.min(Math.max(Math.round(argumentos.dias ?? 7), 1), 90);
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);

  const [total, ultimas] = await Promise.all([
    prisma.consultaAsistente.count({ where: { creadoEn: { gte: desde } } }),
    prisma.consultaAsistente.findMany({
      where: { creadoEn: { gte: desde } },
      orderBy: { creadoEn: "desc" },
      take: 40,
      select: { pregunta: true, creadoEn: true },
    }),
  ]);

  return {
    dias,
    total,
    mostradas: ultimas.length,
    nota: "Son anónimas: no se sabe quién preguntó.",
    consultas: ultimas.map((consulta) => ({
      pregunta: consulta.pregunta,
      el: fecha(consulta.creadoEn),
    })),
  };
}

/** Los stands más mirados y más consultados de los últimos días. */
export async function interesEnLasVidrieras(argumentos: { dias?: number }) {
  const dias = Math.min(Math.max(Math.round(argumentos.dias ?? 30), 1), 180);
  const desde = hoyEnZona();
  desde.setUTCDate(desde.getUTCDate() - dias);

  const filas = await prisma.interesStand.groupBy({
    by: ["vendedorId"],
    where: { fecha: { gte: desde } },
    _sum: { aperturas: true, consultas: true },
  });
  const nombres = new Map(
    (
      await prisma.vendedor.findMany({
        where: { id: { in: filas.map((fila) => fila.vendedorId) } },
        select: { id: true, emprendimiento: true },
      })
    ).map((vendedor) => [vendedor.id, vendedor.emprendimiento]),
  );

  const ranking = (clave: "aperturas" | "consultas") =>
    filas
      .filter((fila) => (fila._sum[clave] ?? 0) > 0)
      .sort((a, b) => (b._sum[clave] ?? 0) - (a._sum[clave] ?? 0))
      .slice(0, 10)
      .map((fila) => ({
        emprendimiento: nombres.get(fila.vendedorId) ?? "(sin nombre)",
        cantidad: fila._sum[clave] ?? 0,
        ficha: ficha(fila.vendedorId),
      }));

  return {
    dias,
    aperturasTotales: filas.reduce(
      (suma, fila) => suma + (fila._sum.aperturas ?? 0),
      0,
    ),
    consultasTotales: filas.reduce(
      (suma, fila) => suma + (fila._sum.consultas ?? 0),
      0,
    ),
    masAbiertos: ranking("aperturas"),
    masConsultadosPorWhatsapp: ranking("consultas"),
    nota: "Son aperturas y consultas, no personas: no se guarda quién entra.",
  };
}
