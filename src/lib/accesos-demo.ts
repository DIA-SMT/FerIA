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

/**
 * Las mismas contraseñas que fija `prisma/seed.ts`, leídas del entorno.
 *
 * Antes estaban escritas acá y en el seed, y además publicadas en una tabla
 * del README — en un repositorio público. Una contraseña que vive en el código
 * es una contraseña publicada: lo único que la protege es que nadie mire.
 *
 * Son las mismas dos variables que usa el seed, así que las cuentas de los
 * accesos rápidos no pueden desincronizarse de las que existen en la base.
 */
const PASSWORD_ADMIN = process.env.SEED_PASSWORD_ADMIN;
const PASSWORD_FERIANTE = process.env.SEED_PASSWORD_FERIANTE;

/**
 * Las cuentas, armadas con las contraseñas que vinieron del entorno.
 *
 * Es una función y no una constante justamente para que las contraseñas entren
 * como `string` ya verificado: si faltan, `cuentasDemo` devuelve el arreglo
 * vacío antes de llamar acá y nunca se arma una cuenta a medias.
 */
function cuentas(passwordAdmin: string, passwordFeriante: string): CuentaDemo[] {
  return [
    {
      etiqueta: "Municipal",
      detalle: "Panel completo",
      email: "admin@smt.gob.ar",
      password: passwordAdmin,
    },
    {
      etiqueta: "Feriante aprobado",
      detalle: "Tejidos del Cerro",
      email: "tejidosdelcerro@example.com",
      password: passwordFeriante,
    },
    {
      etiqueta: "Feriante pendiente",
      detalle: "Telar Andino",
      email: "telarandino@example.com",
      password: passwordFeriante,
    },
    {
      etiqueta: "Feriante rechazado",
      detalle: "Importados LH",
      email: "importadoslh@example.com",
      password: passwordFeriante,
    },
  ];
}

/**
 * Las cuentas a mostrar, o un arreglo vacío si el panel está apagado.
 *
 * Se muestra en desarrollo siempre, y en un deploy sólo declarando
 * `ACCESOS_DEMO=true`. Si la variable no está, no se manda nada: el default es
 * el seguro.
 *
 * Hay dos barreras más, porque la variable sola no alcanzó:
 *
 * 1. En producción no se muestra **nunca**, diga lo que diga `ACCESOS_DEMO`.
 *    El 23/10/2026 la variable quedó prendida en el deploy y durante semanas
 *    cualquiera que entrara a `/ingresar` se hacía ADMIN del panel municipal
 *    con un click. Una variable de entorno no es una barrera: es una nota que
 *    alguien se tiene que acordar de borrar. Esta línea sí es una barrera.
 * 2. Las contraseñas salen del entorno. Si no están, no hay cuentas que
 *    mostrar aunque el panel esté habilitado, así que el panel no puede
 *    funcionar sin que alguien cargue las credenciales a propósito.
 */
export function cuentasDemo(): CuentaDemo[] {
  // Primero y sin excepción: en producción esto no existe.
  if (process.env.VERCEL_ENV === "production") return [];

  const habilitado =
    process.env.NODE_ENV === "development" ||
    process.env.ACCESOS_DEMO === "true";

  if (!habilitado) return [];

  // Sin contraseñas en el entorno las cuentas no sirven para nada: el click
  // intentaría ingresar con `undefined`. Mejor no ofrecerlas.
  if (!PASSWORD_ADMIN || !PASSWORD_FERIANTE) return [];

  return cuentas(PASSWORD_ADMIN, PASSWORD_FERIANTE);
}
