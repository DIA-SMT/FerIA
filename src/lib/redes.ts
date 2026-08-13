/**
 * Los perfiles de redes se guardan como nombre de usuario (sin @ ni dominio),
 * tal como los normalizan los esquemas de `validations/comunes.ts`.
 * Acá se arman las URL para mostrarlas.
 */

export function linkInstagram(usuario: string): string {
  return `https://instagram.com/${usuario}`;
}

export function linkFacebook(usuario: string): string {
  return `https://facebook.com/${usuario}`;
}

/** Muestra el sitio web sin protocolo ni barra final, para que quede legible. */
export function sitioWebLegible(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

/** Link `tel:` con el número limpio de separadores. */
export function linkTelefono(telefono: string): string {
  return `tel:${telefono.replace(/[^\d+]/g, "")}`;
}
