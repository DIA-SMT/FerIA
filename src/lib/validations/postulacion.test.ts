import { describe, expect, it } from "vitest";

import {
  encuestaSchema,
  postulacionSchema,
  resolverPostulacionSchema,
} from "@/lib/validations/postulacion";

/** Lo mínimo que una encuesta válida tiene que traer. */
const ENCUESTA_MINIMA = {
  feriaId: "clx000000000000000000000",
  emprendimiento: "Tejidos del Norte",
  rubro: "INDUMENTARIA",
  whatsapp: "3815123456",
};

/**
 * La encuesta reemplaza al registro para los feriantes.
 *
 * Lo que se verifica acá no es que acepte lo que tiene que aceptar —eso lo
 * dicen los validadores comunes— sino que **no pida** lo que CiDiTuc ya trae.
 * Si alguien vuelve a agregar `email` o `password` al esquema, el formulario
 * deja de poder enviarse y la única pantalla de alta de feriantes queda rota.
 */
describe("encuestaSchema", () => {
  it("acepta una encuesta sin nombre, correo, documento ni contrasenia", () => {
    const resultado = encuestaSchema.safeParse(ENCUESTA_MINIMA);
    expect(resultado.success).toBe(true);
  });

  it("acepta un alta sin feria: la vidriera no depende de una plaza", () => {
    // Era al revés y esto lo fija. La feria era obligatoria, así que para
    // existir en la plataforma había que pedir un lugar en una plaza aunque lo
    // único que quisieras fuera tu stand online. Son dos permisos distintos:
    // el alta habilita la vidriera, la feria se pide después y es opcional.
    const { feriaId: _feriaId, ...sinFeria } = ENCUESTA_MINIMA;
    const resultado = encuestaSchema.safeParse(sinFeria);

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.feriaId).toBeNull();
    }
  });

  it("deja la feria en null cuando el select vino vacio", () => {
    // Es lo que manda el navegador con el placeholder «Por ahora no, sólo
    // quiero mi stand online» elegido: la clave llega, con la cadena vacía.
    const resultado = encuestaSchema.parse({ ...ENCUESTA_MINIMA, feriaId: "" });

    expect(resultado.feriaId).toBeNull();
  });

  it("conserva la feria cuando si eligio una", () => {
    const resultado = encuestaSchema.parse(ENCUESTA_MINIMA);

    expect(resultado.feriaId).toBe(ENCUESTA_MINIMA.feriaId);
  });

  it("exige whatsapp, que es el boton principal del stand", () => {
    const { whatsapp: _whatsapp, ...sinWhatsapp } = ENCUESTA_MINIMA;
    expect(encuestaSchema.safeParse(sinWhatsapp).success).toBe(false);
  });

  it("rechaza un rubro que no existe", () => {
    expect(
      encuestaSchema.safeParse({ ...ENCUESTA_MINIMA, rubro: "ASTRONAUTICA" })
        .success,
    ).toBe(false);
  });

  it("deja los opcionales en null y no en cadena vacia", () => {
    // El formulario manda siempre todos los campos: los vacíos llegan como "".
    // Guardarlos así dejaría fichas con un Instagram que es un string vacío.
    const resultado = encuestaSchema.safeParse({
      ...ENCUESTA_MINIMA,
      descripcion: "",
      instagram: "",
      mensaje: "",
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.descripcion).toBeNull();
      expect(resultado.data.instagram).toBeNull();
      expect(resultado.data.mensaje).toBeNull();
    }
  });
});

describe("postulacionSchema", () => {
  it("solo pide la feria: el resto ya esta en la ficha", () => {
    const resultado = postulacionSchema.safeParse({
      feriaId: "clx000000000000000000000",
    });

    expect(resultado.success).toBe(true);
  });
});

/**
 * Rechazar sin motivo deja al feriante sin saber qué corregir y a la Dirección
 * sin registro de por qué decidió lo que decidió. Es la misma regla que ya rige
 * para rechazar una solicitud de alta, y acá se verifica que el servidor la
 * exija aunque el formulario mande el campo vacío.
 */
describe("resolverPostulacionSchema", () => {
  const POSTULACION_ID = "clx000000000000000000000";

  it("aceptar no necesita motivo", () => {
    const resultado = resolverPostulacionSchema.safeParse({
      postulacionId: POSTULACION_ID,
      decision: "ACEPTADA",
      motivoRechazo: "",
    });

    expect(resultado.success).toBe(true);
  });

  it("rechazar sin motivo no pasa", () => {
    const resultado = resolverPostulacionSchema.safeParse({
      postulacionId: POSTULACION_ID,
      decision: "RECHAZADA",
      motivoRechazo: "",
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      // El error tiene que caer en el campo, no en el formulario: así el
      // textarea queda marcado en rojo en vez de un cartel genérico arriba.
      expect(resultado.error.flatten().fieldErrors).toHaveProperty(
        "motivoRechazo",
      );
    }
  });

  it("rechazar con motivo pasa", () => {
    const resultado = resolverPostulacionSchema.safeParse({
      postulacionId: POSTULACION_ID,
      decision: "RECHAZADA",
      motivoRechazo: "El rubro no corresponde a esta feria.",
    });

    expect(resultado.success).toBe(true);
  });

  it("rechaza una decision inventada", () => {
    expect(
      resolverPostulacionSchema.safeParse({
        postulacionId: POSTULACION_ID,
        decision: "PENDIENTE",
      }).success,
    ).toBe(false);
  });
});
