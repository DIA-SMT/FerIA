/**
 * Quién está detrás de una ficha de feriante.
 *
 * Hasta la importación del padrón de Feria Digital la respuesta era siempre
 * `vendedor.usuario`, porque toda ficha nacía de alguien registrándose. Las 867
 * fichas importadas invierten eso: existe el emprendimiento y existe el nombre
 * del responsable, pero no hay cuenta hasta que la persona entre por primera
 * vez y la reclame.
 *
 * Por eso `usuario` puede ser null en casi cualquier consulta, y por eso esto
 * es una función y no un `??` repetido en cada pantalla: el orden de los
 * fallbacks tiene que ser el mismo en todas, o el panel muestra un nombre en
 * una tabla y otro en la de al lado.
 */

interface FichaConTitular {
  nombreResponsable: string | null;
  email: string | null;
  usuario: { nombre: string; email: string } | null;
}

export interface Titular {
  nombre: string;
  email: string | null;
  /**
   * `false` cuando la ficha es del padrón y nadie la reclamó todavía. El panel
   * lo muestra: una ficha sin reclamar no se puede editar desde /mi-stand y no
   * hay a quién escribirle por mail.
   */
  reclamada: boolean;
}

export function titularDe(ficha: FichaConTitular): Titular {
  // La cuenta manda: si la persona entró y editó sus datos, lo que dice su
  // perfil es más nuevo que lo que vino en el padrón.
  if (ficha.usuario) {
    return {
      nombre: ficha.usuario.nombre,
      email: ficha.usuario.email,
      reclamada: true,
    };
  }

  return {
    nombre: ficha.nombreResponsable ?? "Sin titular",
    email: ficha.email,
    reclamada: false,
  };
}
