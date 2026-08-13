/** Marcas diacríticas combinantes (tildes, diéresis) que deja `normalize("NFD")`. */
const DIACRITICOS = /[̀-ͯ]/g;

/** Convierte un texto en un slug apto para URL: "Tejidos del Norte" → "tejidos-del-norte". */
export function generarSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Genera un slug único consultando la base.
 *
 * `existe` recibe un candidato y responde si ya está tomado. Si el slug base
 * está ocupado se prueba `-2`, `-3`, etc.
 */
export async function generarSlugUnico(
  texto: string,
  existe: (candidato: string) => Promise<boolean>,
): Promise<string> {
  const base = generarSlug(texto) || "sin-nombre";

  if (!(await existe(base))) return base;

  for (let sufijo = 2; sufijo < 100; sufijo++) {
    const candidato = `${base}-${sufijo}`;
    if (!(await existe(candidato))) return candidato;
  }

  // Fallback prácticamente inalcanzable: desempata con marca de tiempo.
  return `${base}-${Date.now().toString(36)}`;
}
