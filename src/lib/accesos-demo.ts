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
 * ¿Esta instancia está sirviendo la base de producción?
 *
 * La pregunta es **qué datos sirve**, y no **dónde corre**, y ese cambio es el
 * punto. La versión anterior preguntaba `VERCEL_ENV === "production"`, que es
 * correcto mientras el sitio viva en Vercel y deja de serlo el día que se mude:
 * en una VPS nadie pone esa variable, así que la línea que el comentario de
 * abajo llama «la barrera» se convertiría en silencio en una línea que no hace
 * nada. Una barrera que depende del proveedor de hosting no es una barrera.
 *
 * La marca se compara contra `DATABASE_URL` con `includes`, igual que hace
 * `abortarSiEsProduccion()` en el seed, así que sirve lo mismo para el ref de
 * un proyecto de Supabase que para el host o el nombre de una base propia. Por
 * eso `BASE_DE_PRODUCCION` es el nombre nuevo y general: `PROYECTO_SUPABASE_PROD`
 * se sigue leyendo para no obligar a tocar los entornos hoy, pero cuando la
 * base se mude a infraestructura municipal el nombre viejo deja de describir
 * nada y conviene pasar al otro.
 *
 * Si no hay marca cargada, devuelve `false`: no se puede afirmar que algo es
 * producción sin saber cuál es la de producción. El que protege ahí es el
 * `NODE_ENV` del llamador.
 */
function sirveLaBaseDeProduccion(): boolean {
  if (process.env.VERCEL_ENV === "production") return true;

  const marca =
    process.env.BASE_DE_PRODUCCION ?? process.env.PROYECTO_SUPABASE_PROD;
  if (!marca) return false;

  return (process.env.DATABASE_URL ?? "").includes(marca);
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
 * 1. Sirviendo la base de producción no se muestra **nunca**, diga lo que diga
 *    `ACCESOS_DEMO`. El 23/10/2026 la variable quedó prendida en el deploy y
 *    durante semanas cualquiera que entrara a `/ingresar` se hacía ADMIN del
 *    panel municipal con un click. Una variable de entorno no es una barrera:
 *    es una nota que alguien se tiene que acordar de borrar. Esta línea sí es
 *    una barrera.
 * 2. Las contraseñas salen del entorno. Si no están, no hay cuentas que
 *    mostrar aunque el panel esté habilitado, así que el panel no puede
 *    funcionar sin que alguien cargue las credenciales a propósito.
 *
 * En desarrollo el panel se muestra igual aunque `DATABASE_URL` apunte a
 * producción, que hoy es el caso. No es una excepción floja: quien corre el
 * proyecto en su máquina ya tiene el `.env` con la service role key, o sea
 * acceso total a esa base. El panel no le da nada que no tenga, y sacárselo
 * sólo rompería el desarrollo. Lo que la barrera evita es que un **deploy**
 * ofrezca ese atajo a cualquiera que abra la página.
 */
export function cuentasDemo(): CuentaDemo[] {
  const enDesarrollo = process.env.NODE_ENV === "development";

  // Primero y sin excepción: en un deploy contra la base real, esto no existe.
  if (!enDesarrollo && sirveLaBaseDeProduccion()) return [];

  const habilitado = enDesarrollo || process.env.ACCESOS_DEMO === "true";

  if (!habilitado) return [];

  // Sin contraseñas en el entorno las cuentas no sirven para nada: el click
  // intentaría ingresar con `undefined`. Mejor no ofrecerlas.
  if (!PASSWORD_ADMIN || !PASSWORD_FERIANTE) return [];

  return cuentas(PASSWORD_ADMIN, PASSWORD_FERIANTE);
}
