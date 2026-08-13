/**
 * Armado de links de contacto por WhatsApp.
 *
 * Los números se guardan normalizados (sólo dígitos, con código de país), que
 * es el formato que espera `wa.me`.
 */

/**
 * Normaliza un número argentino al formato de `wa.me`.
 *
 * Acepta lo que suele escribir la gente ("0381 155-123456", "+54 9 381 512-3456",
 * "3815123456") y devuelve `549381...`. Devuelve `null` si no parece válido.
 */
export function normalizarWhatsapp(entrada: string): string | null {
  let digitos = entrada.replace(/\D/g, "");
  if (!digitos) return null;

  // Prefijo internacional escrito como 0054.
  if (digitos.startsWith("00")) digitos = digitos.slice(2);

  if (digitos.startsWith("54")) {
    let resto = digitos.slice(2);
    // Quita el 0 de larga distancia y el 15 de celular si quedaron en el medio.
    if (resto.startsWith("0")) resto = resto.slice(1);
    if (!resto.startsWith("9")) resto = `9${resto}`;
    // Después del 9 puede haber quedado un 15 heredado del formato viejo.
    const sinNueve = resto.slice(1);
    if (sinNueve.length > 10 && sinNueve.startsWith("15")) {
      resto = `9${sinNueve.slice(2)}`;
    }
    digitos = `54${resto}`;
  } else {
    // Número local: 0381 15 5123456 → 3815123456
    if (digitos.startsWith("0")) digitos = digitos.slice(1);
    if (digitos.length > 10 && digitos.startsWith("15")) {
      digitos = digitos.slice(2);
    }
    // Formato 381 15 5123456 (el 15 después de la característica).
    if (digitos.length > 10) {
      const conArea = digitos.replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
      digitos = conArea;
    }
    digitos = `549${digitos}`;
  }

  // Un celular argentino queda en 54 + 9 + 10 dígitos = 13.
  if (digitos.length < 12 || digitos.length > 15) return null;
  return digitos;
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
