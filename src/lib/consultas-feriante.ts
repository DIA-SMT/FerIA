import type { Prisma } from "@prisma/client";

import { normalizar } from "@/lib/busqueda-feriantes";
import { EDICIONES_PUBLICAS, etapaDeEdicion } from "@/lib/consultas";
import {
  calcularCostos,
  datosDeCostosSchema,
  ETIQUETAS_UNIDAD,
  type DatosDeCostos,
  type ResultadoDeCostos,
} from "@/lib/costos";
import { prisma } from "@/lib/db";
import {
  ZONA,
  diasDeDiferencia,
  formatearFecha,
  formatearMoneda,
  formatearNumero,
  formatearRangoFechas,
  hoyEnZona,
} from "@/lib/format";
import { lugarDeEdicion, resumenHorario } from "@/lib/horarios";
import { obtenerInteresDelStand } from "@/lib/interes";
import {
  CATEGORIAS_FERIA,
  ESTADOS_POSTULACION,
  ESTADOS_VENDEDOR,
  RUBROS,
} from "@/lib/labels";
import { tipoDelCambio } from "@/lib/revision";
import { TIPOS_DE_CAMBIO } from "@/lib/tipos-de-cambio";

/**
 * Las consultas que Migue puede hacer para un feriante.
 *
 * Todas reciben el id del stand **del servidor**, de la sesión verificada: el
 * modelo nunca elige de quién son los datos, porque ninguna herramienta le
 * pide un id de feriante. Así no hay pregunta —ni inyección— que lo haga
 * mirar el stand de otro.
 *
 * Las fichas de costos son del feriante y de nadie más: las arma, las ve y las
 * cambia él. Ninguna consulta del panel de administración las lee.
 */

const MI_STAND = "/mi-stand";
const MIS_FERIAS = "/mi-stand/ferias";
export const PRECIOS_Y_COSTOS = "/mi-stand/costos";

function fecha(valor: Date | null | undefined): string | null {
  return valor ? formatearFecha(valor) : null;
}

/** Días de calendario en Tucumán desde algo hasta hoy. */
function diasDesde(valor: Date, hoy: Date): number {
  const [anio, mes, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(valor)
    .split("-")
    .map(Number);
  return Math.max(
    0,
    diasDeDiferencia(new Date(Date.UTC(anio!, mes! - 1, dia!)), hoy),
  );
}

// ---------------------------------------------------------------------------
// Su stand
// ---------------------------------------------------------------------------

/** Cómo está su stand: solicitud, ferias, stands asignados, revisiones. */
export async function miStand(vendedorId: string) {
  const hoy = hoyEnZona();

  const vendedor = await prisma.vendedor.findUnique({
    where: { id: vendedorId },
    select: {
      emprendimiento: true,
      slug: true,
      rubro: true,
      estado: true,
      motivoRechazo: true,
      postulaciones: {
        orderBy: { creadoEn: "asc" },
        select: {
          estado: true,
          creadoEn: true,
          revisadoEn: true,
          motivoRechazo: true,
          feria: { select: { nombre: true, slug: true } },
        },
      },
      stands: {
        where: { edicion: { fechaFin: { gte: hoy }, ...EDICIONES_PUBLICAS } },
        orderBy: { edicion: { fechaInicio: "asc" } },
        select: {
          numero: true,
          edicion: {
            select: {
              nombre: true,
              fechaInicio: true,
              fechaFin: true,
              diasSemana: true,
              horaApertura: true,
              horaCierre: true,
              horario: true,
              lugar: true,
              feria: { select: { nombre: true, direccion: true } },
            },
          },
        },
      },
      cambios: {
        where: { estado: { in: ["PENDIENTE", "RECHAZADO"] } },
        orderBy: { creadoEn: "asc" },
        select: {
          seccion: true,
          datos: true,
          estado: true,
          motivoRechazo: true,
          creadoEn: true,
          producto: { select: { nombre: true } },
        },
      },
    },
  });
  if (!vendedor) return { error: "No encontré tu stand." };

  const [publicados, enRevision, sinStock, interes] = await Promise.all([
    prisma.producto.count({ where: { vendedorId, publicado: true } }),
    prisma.producto.count({ where: { vendedorId, publicado: false } }),
    prisma.producto.count({
      where: { vendedorId, publicado: true, disponible: false },
    }),
    obtenerInteresDelStand(vendedorId),
  ]);

  const cambios = vendedor.cambios.map((cambio) => ({
    tipo: TIPOS_DE_CAMBIO[tipoDelCambio(cambio.seccion, cambio.datos)],
    producto: cambio.producto?.nombre ?? null,
    desde: fecha(cambio.creadoEn),
    diasEsperando: diasDesde(cambio.creadoEn, hoy),
    motivoDelRechazo: cambio.motivoRechazo,
    estado: cambio.estado,
  }));

  return {
    emprendimiento: vendedor.emprendimiento,
    rubro: RUBROS[vendedor.rubro],
    estadoDeLaSolicitud: ESTADOS_VENDEDOR[vendedor.estado],
    motivoDelRechazo:
      vendedor.estado === "RECHAZADO" ? vendedor.motivoRechazo : null,
    ferias: vendedor.postulaciones.map((postulacion) => ({
      feria: postulacion.feria.nombre,
      estado: ESTADOS_POSTULACION[postulacion.estado],
      pedidaEl: fecha(postulacion.creadoEn),
      resueltaEl: fecha(postulacion.revisadoEn),
      motivoDelRechazo:
        postulacion.estado === "RECHAZADA" ? postulacion.motivoRechazo : null,
      paginaDeLaFeria: `/ferias/${postulacion.feria.slug}`,
    })),
    standsEnProximasEdiciones: vendedor.stands.map((stand) => ({
      feria: stand.edicion.feria.nombre,
      edicion: stand.edicion.nombre,
      fechas: formatearRangoFechas(
        stand.edicion.fechaInicio,
        stand.edicion.fechaFin,
      ),
      horario: resumenHorario(stand.edicion),
      lugar: lugarDeEdicion(stand.edicion, stand.edicion.feria) || null,
      numeroDeStand: stand.numero,
    })),
    cambiosEsperandoRevision: cambios
      .filter((cambio) => cambio.estado === "PENDIENTE")
      .map(({ tipo, producto, desde, diasEsperando }) => ({
        tipo,
        producto,
        desde,
        diasEsperando,
      })),
    cambiosQueNoSeAprobaron: cambios
      .filter((cambio) => cambio.estado === "RECHAZADO")
      .map(({ tipo, producto, motivoDelRechazo }) => ({
        tipo,
        producto,
        motivo: motivoDelRechazo,
        queHacer:
          "Corregirlo en esa parte de su stand y volver a guardar: vuelve a revisión.",
      })),
    productos: { publicados, enRevision, publicadosSinStock: sinStock },
    vidriera:
      interes.diasQueFaltan > 0
        ? {
            nota: "Todavía se está contando cuánto miran su vidriera.",
            primerResumen: fecha(interes.fechaDeLaDevolucion),
          }
        : {
            ultimos30Dias: {
              vecesQueAbrieronSuStand: interes.aperturas,
              consultasPorWhatsapp:
                interes.consultasDelStand +
                interes.productos.reduce(
                  (total, producto) => total + producto.consultas,
                  0,
                ),
            },
            productosMasConsultados: interes.productos
              .filter((producto) => producto.consultas > 0)
              .slice(0, 5)
              .map((producto) => ({
                producto: producto.nombre,
                consultas: producto.consultas,
              })),
          },
    enlaces: {
      miStand: MI_STAND,
      misFerias: MIS_FERIAS,
      ...(vendedor.estado === "APROBADO"
        ? { paginaPublica: `/stands/${vendedor.slug}` }
        : {}),
    },
  };
}

/** Sus productos, con su estado y si ya tienen ficha de costos. */
export async function misProductos(vendedorId: string) {
  const productos = await prisma.producto.findMany({
    where: { vendedorId },
    orderBy: [{ destacado: "desc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      publicado: true,
      disponible: true,
      stock: true,
      destacado: true,
      _count: { select: { fichasDeCostos: true } },
    },
  });

  return {
    total: productos.length,
    productos: productos.map((producto) => ({
      id: producto.id,
      nombre: producto.nombre,
      estado: producto.publicado
        ? producto.disponible
          ? "Publicado"
          : "Publicado, sin stock"
        : "Esperando revisión",
      stock: producto.stock,
      destacado: producto.destacado,
      tieneFichaDeCostos: producto._count.fichasDeCostos > 0,
      editar: `/mi-stand/productos/${producto.id}`,
    })),
    agregarUnoNuevo: "/mi-stand/productos/nuevo",
  };
}

// ---------------------------------------------------------------------------
// Las ferias (lo público)
// ---------------------------------------------------------------------------

/** Las ferias activas y sus próximas fechas: lo mismo que ve cualquiera. */
export async function feriasPublicas() {
  const hoy = hoyEnZona();
  const ferias = await prisma.feria.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
    select: {
      nombre: true,
      slug: true,
      categoria: true,
      direccion: true,
      ediciones: {
        where: { ...EDICIONES_PUBLICAS, fechaFin: { gte: hoy } },
        orderBy: { fechaInicio: "asc" },
        take: 3,
        select: {
          fechaInicio: true,
          fechaFin: true,
          diasSemana: true,
          horaApertura: true,
          horaCierre: true,
          horario: true,
          lugar: true,
        },
      },
    },
  });

  return {
    ferias: ferias.map((feria) => ({
      nombre: feria.nombre,
      categoria: CATEGORIAS_FERIA[feria.categoria],
      lugar: feria.direccion || "Todavía no está confirmado.",
      proximasFechas:
        feria.ediciones.length === 0
          ? "Sin fechas programadas por ahora."
          : feria.ediciones.map((edicion) => ({
              fechas: formatearRangoFechas(
                edicion.fechaInicio,
                edicion.fechaFin,
              ),
              horario: resumenHorario(edicion),
              // Sólo si esa fecha es en otro lado que `lugar` (el de siempre).
              lugarDeEstaFecha: edicion.lugar?.trim() || undefined,
              enCursoAhora: etapaDeEdicion(edicion, hoy) === "EN_CURSO",
            })),
      pagina: `/ferias/${feria.slug}`,
    })),
    comoSumarse: `Pide estar en una feria desde «Mis ferias» (${MIS_FERIAS}).`,
  };
}

// ---------------------------------------------------------------------------
// Precios y costos
// ---------------------------------------------------------------------------

/** El resultado de la cuenta, con la plata ya escrita como se lee. */
export function resultadoLegible(
  datos: DatosDeCostos,
  resultado: ResultadoDeCostos,
) {
  const plata = (valor: number) => formatearMoneda(valor, { centavos: true });
  return {
    unidadesPorTanda: datos.unidades,
    costoDeLaTanda: {
      materiaPrima: plata(resultado.tanda.insumos),
      detalleDeMateriaPrima: resultado.insumos.map((insumo) => ({
        insumo: insumo.nombre,
        costo: plata(insumo.costo),
      })),
      trabajo: `${plata(resultado.tanda.trabajo)} (${formatearNumero(datos.minutos)} minutos a ${plata(datos.valorHora)} la hora)`,
      otros: plata(resultado.tanda.otros),
      total: plata(resultado.tanda.total),
    },
    costoPorUnidad: {
      materiaPrima: plata(resultado.porUnidad.insumos),
      trabajo: plata(resultado.porUnidad.trabajo),
      otros: plata(resultado.porUnidad.otros),
      total: plata(resultado.porUnidad.total),
    },
    gananciaBuscada: `${formatearNumero(datos.margen)} % sobre el costo`,
    precioSugerido: plata(resultado.precioSugerido),
    precioSinRedondear: plata(resultado.precioExacto),
    gananciaPorUnidadAlPrecioSugerido: plata(resultado.gananciaPorUnidad),
    conSuPrecioDeHoy: resultado.conPrecioActual
      ? {
          precio: plata(resultado.conPrecioActual.precio),
          gananciaPorUnidad: plata(resultado.conPrecioActual.gananciaPorUnidad),
          gananciaSobreElCosto: `${resultado.conPrecioActual.margen} %`,
          pierde: resultado.conPrecioActual.gananciaPorUnidad < 0,
        }
      : null,
    paraCubrirUnDiaDeFeria: resultado.paraCubrirElDia
      ? `${formatearNumero(resultado.paraCubrirElDia)} unidades al precio sugerido para cubrir ${plata(datos.costoDelDia ?? 0)}`
      : null,
    nota: "La ganancia es lo que queda después de pagar su hora de trabajo.",
  };
}

/** La cuenta, sin guardar nada. */
export function calcularPrecio(datos: unknown) {
  const leidos = datosDeCostosSchema.parse(datos);
  const resultado = calcularCostos(leidos);
  if ("error" in resultado) return resultado;
  return resultadoLegible(leidos, resultado);
}

/** Las unidades de un insumo, para mostrarlo como lo cargó. */
function insumoLegible(insumo: DatosDeCostos["insumos"][number]) {
  return {
    insumo: insumo.nombre,
    pago: formatearMoneda(insumo.precio, { centavos: true }),
    ...(insumo.cantidadComprada
      ? {
          porCantidad: `${formatearNumero(insumo.cantidadComprada)} ${ETIQUETAS_UNIDAD[insumo.unidadComprada ?? "unidad"]}`,
        }
      : {}),
    ...(insumo.cantidadUsada
      ? {
          usaPorTanda: `${formatearNumero(insumo.cantidadUsada)} ${ETIQUETAS_UNIDAD[insumo.unidadUsada ?? insumo.unidadComprada ?? "unidad"]}`,
        }
      : {}),
  };
}

/** Sus fichas guardadas, con la cuenta hecha de nuevo con los datos de hoy. */
export async function misFichasDeCostos(vendedorId: string, nombre?: string) {
  const fichas = await prisma.fichaDeCostos.findMany({
    where: { vendedorId },
    orderBy: { actualizadoEn: "desc" },
    select: {
      id: true,
      nombre: true,
      datos: true,
      actualizadoEn: true,
      producto: { select: { nombre: true } },
    },
  });

  const buscada = nombre ? normalizar(nombre) : "";
  const elegidas = buscada
    ? fichas.filter((ficha) => normalizar(ficha.nombre).includes(buscada))
    : fichas;

  return {
    total: elegidas.length,
    fichas: elegidas.slice(0, 10).map((ficha) => {
      const datos = datosDeCostosSchema.safeParse(ficha.datos);
      if (!datos.success) {
        return {
          nombre: ficha.nombre,
          error: "La ficha tiene datos que no se pueden leer.",
        };
      }
      const resultado = calcularCostos(datos.data);
      return {
        nombre: ficha.nombre,
        producto: ficha.producto?.nombre ?? null,
        actualizadaEl: fecha(ficha.actualizadoEn),
        insumos: datos.data.insumos.map(insumoLegible),
        otrosCostos: datos.data.otros.map((otro) => ({
          costo: otro.nombre,
          monto: formatearMoneda(otro.monto, { centavos: true }),
        })),
        resultado:
          "error" in resultado
            ? resultado
            : resultadoLegible(datos.data, resultado),
      };
    }),
    pantalla: PRECIOS_Y_COSTOS,
  };
}

/**
 * Guarda una ficha: la del producto si es uno de su catálogo, o la que tiene
 * el mismo nombre. Si no hay, la crea.
 */
export async function guardarFichaDeCostos(
  vendedorId: string,
  argumentos: { nombre: string; productoId?: string | null; datos?: unknown },
) {
  const datos = datosDeCostosSchema.parse(argumentos.datos);
  const resultado = calcularCostos(datos);
  if ("error" in resultado) return resultado;

  // El producto tiene que ser suyo: si no, se guarda sin producto.
  const producto = argumentos.productoId
    ? await prisma.producto.findFirst({
        where: { id: argumentos.productoId, vendedorId },
        select: { id: true },
      })
    : null;

  const existente = await prisma.fichaDeCostos.findFirst({
    where: producto
      ? { vendedorId, productoId: producto.id }
      : {
          vendedorId,
          nombre: { equals: argumentos.nombre, mode: "insensitive" },
        },
    select: { id: true },
  });

  const valores = {
    nombre: argumentos.nombre.trim().slice(0, 120),
    productoId: producto?.id ?? null,
    datos: datos as Prisma.InputJsonValue,
  };
  if (existente) {
    await prisma.fichaDeCostos.update({
      where: { id: existente.id },
      data: valores,
    });
  } else {
    await prisma.fichaDeCostos.create({ data: { vendedorId, ...valores } });
  }

  return {
    guardada: true,
    actualizoUnaQueYaTenia: Boolean(existente),
    resultado: resultadoLegible(datos, resultado),
    pantalla: PRECIOS_Y_COSTOS,
  };
}

/**
 * Cambia el precio de un insumo en una ficha guardada y rehace la cuenta. Con
 * `guardar: false` sólo muestra cómo quedaría: Migue pregunta antes de
 * guardar.
 */
/** Una ficha suya por nombre, o el error que explica por qué no. */
async function fichaPorNombre(vendedorId: string, nombre: string) {
  const fichas = await prisma.fichaDeCostos.findMany({
    where: { vendedorId },
    select: { id: true, nombre: true, datos: true },
  });
  const buscada = normalizar(nombre);
  const candidatas = fichas.filter((ficha) =>
    normalizar(ficha.nombre).includes(buscada),
  );
  if (candidatas.length === 0) {
    return {
      error: `No tenés ninguna ficha que se llame «${nombre}».`,
      fichasQueTenes: fichas.map((ficha) => ficha.nombre),
    };
  }
  if (candidatas.length > 1) {
    return {
      error: "Hay más de una ficha con ese nombre. Preguntá cuál.",
      fichas: candidatas.map((ficha) => ficha.nombre),
    };
  }
  const ficha = candidatas[0]!;
  return { ficha, datos: datosDeCostosSchema.parse(ficha.datos) };
}

/**
 * «¿Y si la vendo a 5000?», «¿y si le gano un 30 %?»: la cuenta de una ficha
 * guardada con algún dato cambiado. No guarda nada.
 */
export async function simularFicha(
  vendedorId: string,
  argumentos: {
    ficha: string;
    precioDeVenta?: number;
    margen?: number;
    valorHora?: number;
    unidades?: number;
  },
) {
  const encontrada = await fichaPorNombre(vendedorId, argumentos.ficha);
  if ("error" in encontrada) return encontrada;
  const { ficha, datos } = encontrada;

  const probados = datosDeCostosSchema.parse({
    ...datos,
    ...(argumentos.precioDeVenta != null
      ? { precioActual: argumentos.precioDeVenta }
      : {}),
    ...(argumentos.margen != null ? { margen: argumentos.margen } : {}),
    ...(argumentos.valorHora != null
      ? { valorHora: argumentos.valorHora }
      : {}),
    ...(argumentos.unidades != null ? { unidades: argumentos.unidades } : {}),
  });
  const resultado = calcularCostos(probados);
  if ("error" in resultado) return resultado;

  return {
    ficha: ficha.nombre,
    loQueSeProbo: {
      ...(argumentos.precioDeVenta != null
        ? {
            venderlaA: formatearMoneda(argumentos.precioDeVenta, {
              centavos: true,
            }),
          }
        : {}),
      ...(argumentos.margen != null
        ? { ganancia: `${formatearNumero(argumentos.margen)} %` }
        : {}),
      ...(argumentos.valorHora != null
        ? { suHora: formatearMoneda(argumentos.valorHora, { centavos: true }) }
        : {}),
      ...(argumentos.unidades != null
        ? { unidadesPorTanda: argumentos.unidades }
        : {}),
    },
    resultado: resultadoLegible(probados, resultado),
    guardada: false,
    nota: "Es una prueba: la ficha no cambió.",
  };
}

export async function actualizarInsumo(
  vendedorId: string,
  argumentos: {
    ficha: string;
    insumo: string;
    nuevoPrecio?: number;
    aumentoPorcentaje?: number;
    guardar: boolean;
  },
) {
  const encontrada = await fichaPorNombre(vendedorId, argumentos.ficha);
  if ("error" in encontrada) return encontrada;
  const { ficha, datos } = encontrada;

  const indice = datos.insumos.findIndex((insumo) =>
    normalizar(insumo.nombre).includes(normalizar(argumentos.insumo)),
  );
  if (indice < 0) {
    return {
      error: `La ficha «${ficha.nombre}» no tiene un insumo «${argumentos.insumo}».`,
      insumosDeLaFicha: datos.insumos.map((insumo) => insumo.nombre),
    };
  }

  const anterior = datos.insumos[indice]!;
  let nuevoPrecio: number;
  if (argumentos.nuevoPrecio != null) {
    nuevoPrecio = argumentos.nuevoPrecio;
  } else if (argumentos.aumentoPorcentaje != null) {
    nuevoPrecio =
      Math.round(
        anterior.precio * (1 + argumentos.aumentoPorcentaje / 100) * 100,
      ) / 100;
  } else {
    return { error: "Falta el precio nuevo o el porcentaje de aumento." };
  }

  const nuevos: DatosDeCostos = {
    ...datos,
    insumos: datos.insumos.map((insumo, posicion) =>
      posicion === indice ? { ...insumo, precio: nuevoPrecio } : insumo,
    ),
  };
  const antes = calcularCostos(datos);
  const despues = calcularCostos(nuevos);
  if ("error" in antes) return antes;
  if ("error" in despues) return despues;

  if (argumentos.guardar) {
    await prisma.fichaDeCostos.update({
      where: { id: ficha.id },
      data: { datos: nuevos as Prisma.InputJsonValue },
    });
  }

  return {
    ficha: ficha.nombre,
    insumo: anterior.nombre,
    precioAnterior: formatearMoneda(anterior.precio, { centavos: true }),
    precioNuevo: formatearMoneda(nuevoPrecio, { centavos: true }),
    antes: {
      costoPorUnidad: formatearMoneda(antes.porUnidad.total, {
        centavos: true,
      }),
      precioSugerido: formatearMoneda(antes.precioSugerido, { centavos: true }),
    },
    despues: resultadoLegible(nuevos, despues),
    guardada: argumentos.guardar,
    pantalla: PRECIOS_Y_COSTOS,
  };
}
