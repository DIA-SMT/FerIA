import type { Prisma } from "@prisma/client";

/**
 * Qué es una solicitud de alta, en un solo lugar.
 *
 * Lo usan el tablero, el contador del menú y el filtro «Pendientes» de la lista
 * de feriantes. Estaba copiado a mano en los tres, y una copia que se desfasa es
 * un número en el tablero que no coincide con la lista que lo explica.
 *
 * Pendiente **y con cuenta**: las fichas del padrón importado pueden estar
 * pendientes, pero nadie las presentó, así que no son una solicitud.
 */
export const SOLICITUD_PENDIENTE: Prisma.VendedorWhereInput = {
  estado: "PENDIENTE",
  usuarioId: { not: null },
};

/**
 * Las fichas importadas del padrón de Feria Digital que nadie reclamó todavía:
 * registros del municipio esperando que su titular entre por CiDiTuc. Pueden
 * estar en cualquier estado —desde el 11/11/2026 están aprobadas y publicadas—;
 * lo que las distingue es que no tienen titular con cuenta.
 */
export const PADRON_SIN_RECLAMAR: Prisma.VendedorWhereInput = {
  origen: "FERIA_DIGITAL",
  usuarioId: null,
};
