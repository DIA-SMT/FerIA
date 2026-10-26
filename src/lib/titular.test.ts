import { describe, expect, it } from "vitest";

import { titularDe } from "@/lib/titular";

/**
 * Con el padrón importado, `usuario` es null en la mayoría de las fichas. El
 * orden de los respaldos tiene que ser el mismo en todas las pantallas o el
 * panel muestra un nombre en una tabla y otro en la de al lado.
 */
describe("titularDe", () => {
  it("la cuenta manda sobre el padron", () => {
    // Si la persona entró y editó sus datos, su perfil es más nuevo que lo
    // que vino en el padrón.
    expect(
      titularDe({
        nombreResponsable: "Perez Juan",
        email: "viejo@example.com",
        usuario: { nombre: "Juan Pérez", email: "nuevo@example.com" },
      }),
    ).toEqual({
      nombre: "Juan Pérez",
      email: "nuevo@example.com",
      reclamada: true,
    });
  });

  it("sin cuenta usa lo que trajo el padron, y lo marca", () => {
    expect(
      titularDe({
        nombreResponsable: "Perez Juan",
        email: "juan@example.com",
        usuario: null,
      }),
    ).toEqual({
      nombre: "Perez Juan",
      email: "juan@example.com",
      reclamada: false,
    });
  });

  it("sin nombre ni cuenta no deja la celda vacia", () => {
    expect(
      titularDe({ nombreResponsable: null, email: null, usuario: null }),
    ).toEqual({ nombre: "Sin titular", email: null, reclamada: false });
  });

  it("«reclamada» distingue el padron de quien se registro", () => {
    // Es lo que el panel muestra como «Padrón sin reclamar»: una ficha así no
    // se puede editar desde /mi-stand y no hay a quién escribirle.
    const delPadron = titularDe({
      nombreResponsable: "X",
      email: null,
      usuario: null,
    });
    const registrado = titularDe({
      nombreResponsable: null,
      email: null,
      usuario: { nombre: "X", email: "x@example.com" },
    });

    expect(delPadron.reclamada).toBe(false);
    expect(registrado.reclamada).toBe(true);
  });
});
