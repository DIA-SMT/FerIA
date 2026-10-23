/**
 * Armado de links de contacto por WhatsApp.
 *
 * Los números se guardan normalizados (sólo dígitos, con código de país), que
 * es el formato que espera `wa.me`.
 */

/**
 * Característica + abonado de un celular argentino: siempre 10 dígitos, sea la
 * característica de 2, 3 o 4. Es la medida contra la que se corta y se valida
 * todo acá abajo.
 */
const LARGO_NACIONAL = 10;

/**
 * Saca el 15 del formato viejo de celular, que puede venir pegado adelante
 * ("155123456") o después de la característica ("381 15 5123456").
 *
 * Sólo lo intenta cuando el número quedó más largo que los 10 dígitos de
 * característica + abonado: si ya mide 10, un "15" ahí adentro es parte del
 * número y sacarlo lo rompería.
 */
function sacarQuinceViejo(nacional: string): string {
  let resultado = nacional;
  if (resultado.length > LARGO_NACIONAL && resultado.startsWith("15")) {
    resultado = resultado.slice(2);
  }
  if (resultado.length > LARGO_NACIONAL) {
    resultado = resultado.replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
  }
  return resultado;
}

/**
 * Valida la parte nacional (característica + abonado) de un celular.
 *
 * Antes acá sólo se miraba el largo total del resultado (12 a 15 dígitos) y eso
 * dejaba pasar números que no existen: "15 5123456" quedaba como 549155123456 y
 * se publicaba como botón principal de contacto del stand en la vidriera. El
 * vecino hacía click y le escribía a cualquiera.
 *
 * Las reglas del plan de numeración: característica de 2 a 4 dígitos + abonado,
 * 10 dígitos en total, ni la característica ni el abonado empiezan en 0, y el 15
 * no es una característica (es el prefijo viejo de celular).
 *
 * Dónde corta la característica no se puede deducir del número solo y acá no
 * tenemos el padrón, así que pedimos que exista al menos un corte posible. La
 * única característica de 2 dígitos es la 11 (AMBA); el resto son de 3 o 4, y
 * con eso alcanza para no dejar pasar cosas como "381 000-0000".
 */
function esNacionalPosible(nacional: string): boolean {
  if (nacional.length !== LARGO_NACIONAL) return false;
  // El 0 adelante es el de larga distancia, no parte de la característica.
  if (nacional.startsWith("0") || nacional.startsWith("15")) return false;
  // Dónde puede terminar la característica, o sea dónde arranca el abonado.
  const cortesPosibles = nacional.startsWith("11") ? [2] : [3, 4];
  return cortesPosibles.some((corte) => nacional.charAt(corte) !== "0");
}

/**
 * Normaliza un número argentino al formato de `wa.me`.
 *
 * Acepta lo que suele escribir la gente ("0381 155-123456", "+54 9 381 512-3456",
 * "3815123456") y devuelve `549381...`. Devuelve `null` si no parece válido.
 * La tabla de casos probados está al final del archivo.
 */
export function normalizarWhatsapp(entrada: string): string | null {
  let digitos = entrada.replace(/\D/g, "");
  if (!digitos) return null;

  // Prefijo internacional escrito como 0054.
  if (digitos.startsWith("00")) digitos = digitos.slice(2);

  // Nos quedamos con la parte nacional y reponemos el "549" recién al final:
  // así hay un solo lugar donde validar y no se cuela un número a medio armar.
  let nacional: string;
  if (digitos.startsWith("54")) {
    nacional = digitos.slice(2);
    // El 0 de larga distancia, cuando quedó en el medio ("+54 0381 ...").
    if (nacional.startsWith("0")) nacional = nacional.slice(1);
    // El 9 de celular va entre el 54 y la característica; como ninguna
    // característica empieza en 9, sacarlo no es ambiguo.
    if (nacional.startsWith("9")) nacional = nacional.slice(1);
  } else {
    // Número local: 0381 15 5123456 → 3815123456
    nacional = digitos.startsWith("0") ? digitos.slice(1) : digitos;
  }

  nacional = sacarQuinceViejo(nacional);
  if (!esNacionalPosible(nacional)) return null;
  return `549${nacional}`;
}

/** Muestra el número de forma legible: `549381...` → `+54 9 381 512-3456`. */
export function formatearWhatsapp(numero: string): string {
  const digitos = numero.replace(/\D/g, "");
  if (digitos.startsWith("549") && digitos.length === 13) {
    const area = digitos.slice(3, 6);
    const parte1 = digitos.slice(6, 9);
    const parte2 = digitos.slice(9);
    return `+54 9 ${area} ${parte1}-${parte2}`;
  }
  return `+${digitos}`;
}

/** Link `wa.me` con el mensaje ya escrito. */
export function linkWhatsapp(numero: string, mensaje: string): string {
  const digitos = numero.replace(/\D/g, "");
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}

/** Mensaje por defecto para consultar por un emprendimiento. */
export function mensajeConsultaStand(emprendimiento: string): string {
  return `¡Hola ${emprendimiento}! Los vi en las Ferias Municipales de San Miguel de Tucumán y quería hacerles una consulta.`;
}

/** Mensaje por defecto para consultar por un producto puntual. */
export function mensajeConsultaProducto(
  emprendimiento: string,
  producto: string,
): string {
  return `¡Hola ${emprendimiento}! Los vi en las Ferias Municipales de San Miguel de Tucumán y quería consultar por "${producto}".`;
}

/*
 * Casos probados de `normalizarWhatsapp`. Va como comentario y no como test
 * porque todavía no hay corredor de tests en el repo; cuando lo haya, esta
 * tabla se copia tal cual.
 *
 * Los marcados con (*) son los que cambiaron al endurecer la validación: antes
 * devolvían un número que no existe y se publicaba igual en la vidriera.
 *
 *   entrada                   salida esperada
 *   ------------------------  ---------------
 *   "0381 155-123456"         "5493815123456"
 *   "+54 9 381 512-3456"      "5493815123456"
 *   "3815123456"              "5493815123456"
 *   "381 512-3456"            "5493815123456"
 *   "0054 9 381 512 3456"     "5493815123456"
 *   "0054 381 512 3456"       "5493815123456"
 *   "54 0381 512-3456"        "5493815123456"   0 de larga distancia en el medio
 *   "54 15 381 512-3456"      "5493815123456"   15 pegado adelante
 *   "(0381) 15-5123456"       "5493815123456"
 *   "5493815123456"           "5493815123456"   el formato en que ya se guarda
 *   "+54 9 381 15 512-3456"   "5493815123456"   (*) antes "549381155123456"
 *   "011 15 5123-4567"        "5491151234567"   característica de 2 dígitos
 *   "1151234567"              "5491151234567"
 *   "+54 9 11 15 5123-4567"   "5491151234567"   (*) antes "549111551234567"
 *   "15 5123456"              null              (*) antes "549155123456"
 *   "1551234567"              null              (*) 15 no es característica
 *   "+54 9 15 5123-4567"      null              (*) falta la característica
 *   "549155123456"            null              (*) el número roto ya guardado
 *   "381512345"               null              (*) falta un dígito
 *   "38151234567"             null              (*) sobra un dígito
 *   "0381 000-0000"           null              (*) abonado en 0
 *   "0381 155-12345"          null              (*) falta un dígito
 *   "+1 415 555 0123"         null              (*) no es argentino
 *   ""                        null
 *   "hola"                    null
 *   "54"                      null
 */
