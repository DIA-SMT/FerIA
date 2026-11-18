/**
 * El nombre de pila, para saludar: la primera palabra, con mayúscula inicial.
 *
 * CiDiTuc manda el nombre como «NOMBRE APELLIDO», a veces todo en mayúsculas,
 * así que la primera palabra es el nombre y no el apellido.
 */
export function nombreDePila(nombre: string | null | undefined): string {
  const primera = nombre?.trim().split(/\s+/)[0] ?? "";
  if (!primera) return "";
  return (
    primera.charAt(0).toLocaleUpperCase("es-AR") +
    primera.slice(1).toLocaleLowerCase("es-AR")
  );
}
