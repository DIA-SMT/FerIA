/**
 * Cuentas de ejemplo para el panel de accesos rápidos del login.
 *
 * ⚠️ **Sólo servidor.** Este módulo no lo puede importar un componente de
 * cliente: si lo hiciera, las credenciales terminarían en el bundle que baja al
 * navegador incluso con el panel apagado.
 *
 * Por qué está separado del componente: la primera versión decidía si mostrarse
 * dentro del propio componente de cliente, confiando en que el minificador
 * eliminara el bloque al compilar. No es confiable —con la variable vacía Next
 * no la reemplaza por una constante y no se elimina nada—, así que las
 * credenciales quedaban en el bundle de producción. Ahora viven acá y viajan
 * como props únicamente cuando el flag está prendido.
 *
 * El flag es `ACCESOS_DEMO`, sin `NEXT_PUBLIC_`, justamente para que sólo lo
 * lea el servidor y no se inline en ningún bundle.
 */

export interface CuentaDemo {
  etiqueta: string;
  detalle: string;
  email: string;
  password: string;
}

/** Las mismas contraseñas que fija `prisma/seed.ts`. */
const PASSWORD_ADMIN = "Ferias.2026";
const PASSWORD_FERIANTE = "Feriante.2026";

const CUENTAS: CuentaDemo[] = [
  {
    etiqueta: "Municipal",
    detalle: "Panel completo",
    email: "admin@smt.gob.ar",
    password: PASSWORD_ADMIN,
  },
  {
    etiqueta: "Feriante aprobado",
    detalle: "Tejidos del Cerro",
    email: "tejidosdelcerro@example.com",
    password: PASSWORD_FERIANTE,
  },
  {
    etiqueta: "Feriante pendiente",
    detalle: "Telar Andino",
    email: "telarandino@example.com",
    password: PASSWORD_FERIANTE,
  },
  {
    etiqueta: "Feriante rechazado",
    detalle: "Importados LH",
    email: "importadoslh@example.com",
    password: PASSWORD_FERIANTE,
  },
];

/**
 * Las cuentas a mostrar, o un arreglo vacío si el panel está apagado.
 *
 * Se muestra en desarrollo siempre, y en un deploy sólo declarando
 * `ACCESOS_DEMO=true`. Si la variable no está, no se manda nada: el default es
 * el seguro.
 *
 * ⚠️ Prenderlo en una URL pública significa que cualquiera que la encuentre
 * entra como ADMIN con un click y puede aprobar feriantes, borrar ferias o
 * registrar pagos. Apagalo antes de que el sitio sea real.
 */
export function cuentasDemo(): CuentaDemo[] {
  const habilitado =
    process.env.NODE_ENV === "development" ||
    process.env.ACCESOS_DEMO === "true";

  return habilitado ? CUENTAS : [];
}
