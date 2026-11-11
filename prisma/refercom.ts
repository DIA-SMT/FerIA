/**
 * El padrón de Feria Digital, tal como está en la base MySQL del municipio.
 *
 * Mi Feria Digital tiene detrás una base propia, `smt_refercom`, con unos 1100
 * emprendimientos: más completa que el export de Firestore que se usó al
 * principio, y la que manda desde el 11/11/2026. Este módulo arma, a partir de
 * sus tablas, las mismas fichas que entiende `importar-feria-digital.ts`, así
 * que la traducción de rubros, la validación de WhatsApp y todo lo demás se
 * comparten con el camino de Firestore.
 *
 * Es lógica pura y está separada de `extraer-refercom.ts`, que es el que se
 * conecta, por la misma razón que `feria-digital.ts`: así se prueba sin base.
 *
 * Dos decisiones que no se leen en el código:
 *
 *  · **Una ficha por emprendimiento**, no por persona. Quien tiene dos
 *    emprendimientos queda en dos fichas, y al entrar por CiDiTuc va a poder
 *    manejar una sola desde su cuenta. Decidido con Lucas el 11/11/2026.
 *  · **No se usa la vista `emprendimientos`** de esa base. Une los productos
 *    por rubro y no por lo que vende cada uno, así que a cada emprendimiento le
 *    adjudica todos los productos de su rubro y cualquier conteo sale inflado.
 *    Los cruces se hacen acá, con las tablas.
 */

/** Las columnas que se leen de cada tabla, con los nombres que tienen allá. */
export interface FilaPersona {
  id_emprendedor: number;
  dni: number | string | null;
  apellido: string | null;
  nombre: string | null;
  telefono: string | null;
  domicilio: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
}

export interface FilaEmprendimiento {
  id_emprendimiento: number;
  id_emprendedor: number | null;
  id_feria: number | null;
  nombre_empre: string | null;
}

/** `tbl_emprendimiento_deta`: qué rubro tiene cada emprendimiento. */
export interface FilaRubroDeEmprendimiento {
  id_emprendimiento: number;
  id_rubro: number | null;
}

export interface FilaRubro {
  id_rubro: number;
  rubro: string | null;
}

export interface FilaFeria {
  id_feria: number;
  feria: string | null;
}

/** `tbl_deta_producto`: qué productos vende cada emprendimiento. */
export interface FilaProductoDeEmprendimiento {
  id_emprendimiento: number;
  id_producto: number | null;
}

export interface FilaProducto {
  id_producto: number;
  producto: string | null;
}

export interface TablasRefercom {
  personas: FilaPersona[];
  emprendimientos: FilaEmprendimiento[];
  rubrosDeEmprendimiento: FilaRubroDeEmprendimiento[];
  rubros: FilaRubro[];
  ferias: FilaFeria[];
  productosDeEmprendimiento: FilaProductoDeEmprendimiento[];
  productos: FilaProducto[];
}

/**
 * Una ficha con la forma que lee `leerPadron`.
 *
 * Los nombres de campo son los del export de Firestore a propósito: así el
 * importador no necesita saber de dónde vino el padrón.
 */
export interface FichaRefercom {
  /** El `id_emprendimiento`, que la vista del municipio llama `ident`. */
  id: string;
  emprendimiento: string | null;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  dni: string | null;
  domicilio: string | null;
  feria: string | null;
  rubros: string[];
  productos: string[];
}

/**
 * Texto limpio, o `null` si no hay nada utilizable.
 *
 * El `"0"` también cuenta como vacío: es como esa base marca un teléfono o un
 * DNI que no se cargó, y un DNI 0 no tiene que enganchar ninguna ficha cuando
 * alguien entra por CiDiTuc.
 */
export function valor(dato: unknown): string | null {
  if (dato === null || dato === undefined) return null;
  const limpio = String(dato).trim();
  return limpio === "" || limpio === "0" ? null : limpio;
}

/** Junta valores por clave sin repetirlos, conservando el orden de llegada. */
function agrupar<T>(
  filas: T[],
  clave: (fila: T) => number,
  dato: (fila: T) => string | null,
): Map<number, string[]> {
  const grupos = new Map<number, string[]>();
  for (const fila of filas) {
    const texto = dato(fila);
    if (texto === null) continue;
    const lista = grupos.get(clave(fila)) ?? [];
    if (!lista.includes(texto)) lista.push(texto);
    grupos.set(clave(fila), lista);
  }
  return grupos;
}

export function armarFichas(tablas: TablasRefercom): FichaRefercom[] {
  const personas = new Map(tablas.personas.map((p) => [p.id_emprendedor, p]));
  const ferias = new Map(tablas.ferias.map((f) => [f.id_feria, valor(f.feria)]));
  const rubros = new Map(tablas.rubros.map((r) => [r.id_rubro, valor(r.rubro)]));
  const productos = new Map(
    tablas.productos.map((p) => [p.id_producto, valor(p.producto)]),
  );

  // Un rubro o un producto que ya no existe en su catálogo se descarta acá: el
  // importador lo va a mandar a OTROS y lo va a listar, que es lo que sirve.
  const rubrosDe = agrupar(
    tablas.rubrosDeEmprendimiento,
    (d) => d.id_emprendimiento,
    (d) => (d.id_rubro === null ? null : (rubros.get(d.id_rubro) ?? null)),
  );
  const productosDe = agrupar(
    tablas.productosDeEmprendimiento,
    (d) => d.id_emprendimiento,
    (d) => (d.id_producto === null ? null : (productos.get(d.id_producto) ?? null)),
  );

  return tablas.emprendimientos.map((e) => {
    // Hay emprendimientos cuya persona no existe. Salen igual, sin datos de
    // contacto, y el importador los omite por falta de WhatsApp y los lista.
    const p =
      e.id_emprendedor === null ? undefined : personas.get(e.id_emprendedor);

    return {
      id: String(e.id_emprendimiento),
      emprendimiento: valor(e.nombre_empre),
      nombre: valor(p?.nombre),
      apellido: valor(p?.apellido),
      telefono: valor(p?.telefono),
      email: valor(p?.email),
      instagram: valor(p?.instagram),
      facebook: valor(p?.facebook),
      dni: valor(p?.dni),
      domicilio: valor(p?.domicilio),
      feria: e.id_feria === null ? null : (ferias.get(e.id_feria) ?? null),
      rubros: rubrosDe.get(e.id_emprendimiento) ?? [],
      productos: productosDe.get(e.id_emprendimiento) ?? [],
    };
  });
}
