/**
 * Paginación de listados.
 *
 * Existe desde que entró el padrón de Feria Digital: el directorio público y la
 * lista de feriantes del panel pasaron de una docena de filas a casi mil, y
 * `/stands` llegó a pesar 3,9 MB con las 989 tarjetas en una sola página.
 *
 * Es lógica pura —números que entran y números que salen— y está separada del
 * componente para poder probarla sin React.
 */

/**
 * El número de página que vino en la URL, o 1.
 *
 * Estricto a propósito: `?pagina=2.5`, `?pagina=-1` o `?pagina=dos` son la
 * primera página y no un error. Una URL armada a mano o cortada a la mitad
 * tiene que mostrar algo, no romperse.
 */
export function leerPagina(valor: string | string[] | undefined): number {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (!texto || !/^\d+$/.test(texto)) return 1;
  const numero = Number(texto);
  return numero >= 1 ? numero : 1;
}

export interface Paginado {
  /** La página que se muestra, ya acotada a las que existen. */
  pagina: number;
  /** Cuántas páginas hay. Siempre al menos 1, aunque no haya filas. */
  paginas: number;
  /** Cuántas filas saltear: el `skip` de Prisma. */
  salto: number;
  porPagina: number;
}

/**
 * Qué página mostrar y cuántas filas saltear.
 *
 * Una página que no existe se acota a la última en vez de mostrar una lista
 * vacía: pasa cuando alguien vuelve a un link viejo después de que el listado
 * se achicó, y «no hay resultados» sería mentira.
 */
export function paginar(
  total: number,
  pedida: number,
  porPagina: number,
): Paginado {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(1, Math.floor(pedida)), paginas);
  return { pagina, paginas, salto: (pagina - 1) * porPagina, porPagina };
}

/** Un hueco entre números de página, que se dibuja como «…». */
export const HUECO = "…" as const;

/**
 * Qué números de página mostrar: la primera, la última y dos a cada lado de la
 * actual, con «…» donde se saltean.
 *
 *   paginasVisibles(6, 42) → [1, "…", 4, 5, 6, 7, 8, "…", 42]
 *
 * Un hueco de una sola página no se dibuja como «…»: se muestra el número, que
 * ocupa lo mismo y ahorra un clic.
 */
export function paginasVisibles(
  actual: number,
  paginas: number,
): Array<number | typeof HUECO> {
  const elegidas = new Set<number>([1, paginas]);
  for (let n = actual - 2; n <= actual + 2; n++) {
    if (n >= 1 && n <= paginas) elegidas.add(n);
  }

  const ordenadas = [...elegidas].sort((a, b) => a - b);
  const salida: Array<number | typeof HUECO> = [];
  for (const [i, n] of ordenadas.entries()) {
    const anterior = ordenadas[i - 1];
    if (anterior !== undefined) {
      if (n - anterior === 2) salida.push(anterior + 1);
      else if (n - anterior > 2) salida.push(HUECO);
    }
    salida.push(n);
  }
  return salida;
}
