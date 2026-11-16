import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  Una base en memoria con lo justo que usa `revision.ts`. Las operaciones son
  perezosas, como las de Prisma: no corren hasta que alguien las espera o las
  mete en una transacción. Importa, porque `aprobarCambio` arma la marca de
  «aprobado» antes de saber si va a poder aplicarlo.
*/
type Fila = Record<string, unknown>;

const { base, tabla, eliminar } = vi.hoisted(() => {
  const base = {
    cambios: [] as Fila[],
    vendedores: [] as Fila[],
    productos: [] as Fila[],
  };

  let secuencia = 0;

  // Prisma devuelve copias: modificar la base después no cambia lo leído.
  const copia = <T>(valor: T): T =>
    valor === null ? valor : (JSON.parse(JSON.stringify(valor)) as T);

  function perezosa<T>(correr: () => T) {
    return {
      then(
        resolver: (valor: T) => unknown,
        rechazar?: (error: unknown) => unknown,
      ) {
        try {
          return Promise.resolve(resolver(correr()));
        } catch (error) {
          return rechazar
            ? Promise.resolve(rechazar(error))
            : Promise.reject(error);
        }
      },
    };
  }

  function coincide(fila: Fila, where: Fila): boolean {
    return Object.entries(where).every(([campo, valor]) => {
      if (valor && typeof valor === "object" && "in" in (valor as Fila)) {
        return (valor as { in: unknown[] }).in.includes(fila[campo]);
      }
      if (valor && typeof valor === "object" && "not" in (valor as Fila)) {
        return fila[campo] !== (valor as { not: unknown }).not;
      }
      return fila[campo] === valor;
    });
  }

  function tabla(nombre: keyof typeof base) {
    return {
      findFirst: ({ where }: { where: Fila }) =>
        perezosa(() =>
          copia(base[nombre].filter((f) => coincide(f, where)).at(-1) ?? null),
        ),
      findUnique: ({ where, include }: { where: Fila; include?: Fila }) =>
        perezosa(() => {
          const fila = base[nombre].find((f) => coincide(f, where));
          if (!fila) return null;
          const extra: Fila = {};
          if (include?.vendedor) {
            extra.vendedor = base.vendedores.find(
              (v) => v.id === fila.vendedorId,
            );
          }
          if (include?.producto) {
            extra.producto =
              base.productos.find((p) => p.id === fila.productoId) ?? null;
          }
          return copia({ ...fila, ...extra });
        }),
      create: ({ data }: { data: Fila }) =>
        perezosa(() => {
          const fila = { id: `c${++secuencia}`, estado: "PENDIENTE", ...data };
          base[nombre].push(fila);
          return fila;
        }),
      update: ({ where, data }: { where: Fila; data: Fila }) =>
        perezosa(() => {
          const fila = base[nombre].find((f) => coincide(f, where));
          if (!fila) throw new Error(`no existe en ${nombre}`);
          Object.assign(fila, data);
          return fila;
        }),
      delete: ({ where }: { where: Fila }) =>
        perezosa(() => {
          base[nombre] = base[nombre].filter((f) => !coincide(f, where));
        }),
      count: ({ where }: { where: Fila }) =>
        perezosa(() => base[nombre].filter((f) => coincide(f, where)).length),
    };
  }

  const eliminar = vi.fn(async (_ruta: string) => undefined);

  return { base, tabla, eliminar };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    cambioDelStand: tabla("cambios"),
    vendedor: tabla("vendedores"),
    producto: tabla("productos"),
    $transaction: (operaciones: PromiseLike<unknown>[]) =>
      Promise.all(operaciones),
  },
}));

vi.mock("@/lib/storage", () => ({ almacenamiento: { eliminar } }));

import {
  aprobarCambio,
  descartarCambio,
  productoDelDueno,
  proponerCambio,
  rechazarCambio,
  standDelDueno,
  tipoDelCambio,
} from "@/lib/revision";

const VENDEDOR = {
  id: "v1",
  slug: "dulces-de-la-abuela",
  emprendimiento: "Dulces de la Abuela",
  rubro: "GASTRONOMIA",
  descripcion: "La de antes.",
  imagenPortada: "vendedores/portada-vieja.webp",
  logo: null,
  whatsapp: "3815123456",
  telefono: null,
  email: null,
  instagram: null,
  facebook: null,
  sitioWeb: null,
  direccion: null,
};

function borradas(): string[] {
  return eliminar.mock.calls.map(([ruta]) => ruta);
}

beforeEach(() => {
  base.cambios = [];
  base.vendedores = [{ ...VENDEDOR }];
  base.productos = [];
  eliminar.mockClear();
});

describe("proponer un cambio", () => {
  it("no toca lo publicado", async () => {
    await proponerCambio({
      vendedorId: "v1",
      seccion: "DESCRIPCION",
      datos: { descripcion: "La nueva." },
    });
    expect(base.vendedores[0]!.descripcion).toBe("La de antes.");
    expect(base.cambios).toHaveLength(1);
    expect(base.cambios[0]!.estado).toBe("PENDIENTE");
  });

  it("reemplaza al pendiente de la misma parte y borra la foto que ya no usa", async () => {
    await proponerCambio({
      vendedorId: "v1",
      seccion: "PORTADA",
      datos: { imagenPortada: "vendedores/propuesta-1.webp" },
    });
    await proponerCambio({
      vendedorId: "v1",
      seccion: "PORTADA",
      datos: { imagenPortada: "vendedores/propuesta-2.webp" },
    });

    expect(base.cambios).toHaveLength(1);
    expect(base.cambios[0]!.datos).toEqual({
      imagenPortada: "vendedores/propuesta-2.webp",
    });
    expect(borradas()).toEqual(["vendedores/propuesta-1.webp"]);
  });

  it("vuelve a dejar pendiente uno rechazado, sin el motivo", async () => {
    base.cambios.push({
      id: "r1",
      vendedorId: "v1",
      seccion: "DESCRIPCION",
      productoId: null,
      datos: { descripcion: "Mal." },
      estado: "RECHAZADO",
      motivoRechazo: "Tiene un teléfono.",
    });
    await proponerCambio({
      vendedorId: "v1",
      seccion: "DESCRIPCION",
      datos: { descripcion: "Bien." },
    });
    expect(base.cambios).toHaveLength(1);
    expect(base.cambios[0]).toMatchObject({
      estado: "PENDIENTE",
      motivoRechazo: null,
      datos: { descripcion: "Bien." },
    });
  });
});

describe("aprobar", () => {
  it("publica la portada y borra la vieja", async () => {
    await proponerCambio({
      vendedorId: "v1",
      seccion: "PORTADA",
      datos: { imagenPortada: "vendedores/nueva.webp" },
    });
    const resultado = await aprobarCambio(
      base.cambios[0]!.id as string,
      "admin",
    );

    expect(resultado.ok).toBe(true);
    expect(base.vendedores[0]!.imagenPortada).toBe("vendedores/nueva.webp");
    expect(base.cambios[0]).toMatchObject({
      estado: "APROBADO",
      revisadoPorId: "admin",
    });
    expect(borradas()).toEqual(["vendedores/portada-vieja.webp"]);
  });

  it("con otro nombre, cambia también la dirección del stand", async () => {
    await proponerCambio({
      vendedorId: "v1",
      seccion: "IDENTIDAD",
      datos: { emprendimiento: "Dulces de Tafí", rubro: "GASTRONOMIA" },
    });
    const resultado = await aprobarCambio(
      base.cambios[0]!.id as string,
      "admin",
    );

    expect(base.vendedores[0]!.slug).toBe("dulces-de-tafi");
    expect(resultado).toEqual({
      ok: true,
      slugs: ["dulces-de-la-abuela", "dulces-de-tafi"],
    });
  });

  it("publica un producto nuevo", async () => {
    base.productos.push({
      id: "p1",
      vendedorId: "v1",
      publicado: false,
      imagenes: ["productos/a.webp"],
    });
    await proponerCambio({
      vendedorId: "v1",
      seccion: "PRODUCTO",
      productoId: "p1",
      datos: { nuevo: true },
    });
    await aprobarCambio(base.cambios[0]!.id as string, "admin");

    expect(base.productos[0]!.publicado).toBe(true);
    expect(borradas()).toEqual([]);
  });

  it("aplica la edición de un producto y borra recién ahí las fotos que sacó", async () => {
    base.productos.push({
      id: "p1",
      vendedorId: "v1",
      publicado: true,
      nombre: "Dulce",
      imagenes: ["productos/a.webp", "productos/b.webp"],
    });
    await proponerCambio({
      vendedorId: "v1",
      seccion: "PRODUCTO",
      productoId: "p1",
      datos: {
        nombre: "Dulce de cayote",
        descripcion: null,
        imagenes: ["productos/a.webp", "productos/c.webp"],
        precio: null,
        stock: null,
        destacado: false,
      },
    });
    expect(borradas()).toEqual([]);

    await aprobarCambio(base.cambios[0]!.id as string, "admin");
    expect(base.productos[0]).toMatchObject({
      nombre: "Dulce de cayote",
      imagenes: ["productos/a.webp", "productos/c.webp"],
    });
    expect(borradas()).toEqual(["productos/b.webp"]);
  });

  it("no aprueba dos veces", async () => {
    await proponerCambio({
      vendedorId: "v1",
      seccion: "DESCRIPCION",
      datos: { descripcion: "Nueva." },
    });
    const id = base.cambios[0]!.id as string;
    await aprobarCambio(id, "admin");
    expect((await aprobarCambio(id, "admin")).ok).toBe(false);
  });

  it("si el producto ya no existe, no lo marca como aprobado", async () => {
    base.cambios.push({
      id: "x1",
      vendedorId: "v1",
      seccion: "PRODUCTO",
      productoId: "borrado",
      datos: { nuevo: true },
      estado: "PENDIENTE",
    });
    expect((await aprobarCambio("x1", "admin")).ok).toBe(false);
    expect(base.cambios[0]!.estado).toBe("PENDIENTE");
  });
});

describe("rechazar y descartar", () => {
  it("rechazar deja lo publicado, guarda el motivo y borra la foto propuesta", async () => {
    await proponerCambio({
      vendedorId: "v1",
      seccion: "PORTADA",
      datos: { imagenPortada: "vendedores/borrosa.webp" },
    });
    await rechazarCambio(
      base.cambios[0]!.id as string,
      "admin",
      "Está borrosa.",
    );

    expect(base.vendedores[0]!.imagenPortada).toBe(
      "vendedores/portada-vieja.webp",
    );
    expect(base.cambios[0]).toMatchObject({
      estado: "RECHAZADO",
      motivoRechazo: "Está borrosa.",
    });
    expect(borradas()).toEqual(["vendedores/borrosa.webp"]);
  });

  it("rechazar un producto nuevo no le borra las fotos: sigue ahí para corregirlo", async () => {
    base.productos.push({
      id: "p1",
      vendedorId: "v1",
      publicado: false,
      imagenes: ["productos/a.webp"],
    });
    await proponerCambio({
      vendedorId: "v1",
      seccion: "PRODUCTO",
      productoId: "p1",
      datos: { nuevo: true },
    });
    await rechazarCambio(
      base.cambios[0]!.id as string,
      "admin",
      "Falta la descripción.",
    );
    expect(borradas()).toEqual([]);
  });

  it("el feriante descarta su cambio y no le borra lo publicado", async () => {
    await proponerCambio({
      vendedorId: "v1",
      seccion: "PORTADA",
      datos: { imagenPortada: "vendedores/portada-vieja.webp" },
    });
    expect(await descartarCambio(base.cambios[0]!.id as string, "v1")).toBe(
      true,
    );
    expect(base.cambios).toHaveLength(0);
    // Era la misma que la publicada: no se borra.
    expect(borradas()).toEqual([]);
  });

  it("no deja descartar el cambio de otro feriante", async () => {
    await proponerCambio({
      vendedorId: "v1",
      seccion: "DESCRIPCION",
      datos: { descripcion: "Nueva." },
    });
    expect(await descartarCambio(base.cambios[0]!.id as string, "otro")).toBe(
      false,
    );
    expect(base.cambios).toHaveLength(1);
  });
});

describe("lo que ve el dueño", () => {
  const cambio = (fila: Partial<Fila>) =>
    ({
      id: "c",
      productoId: null,
      motivoRechazo: null,
      estado: "PENDIENTE",
      ...fila,
    }) as Parameters<typeof standDelDueno>[1][number];

  it("ve lo pendiente aplicado, y lo rechazado no", () => {
    const { vendedor, estados } = standDelDueno(
      VENDEDOR as Parameters<typeof standDelDueno>[0],
      [
        cambio({
          id: "a",
          seccion: "DESCRIPCION",
          datos: { descripcion: "Nueva." },
        }),
        cambio({
          id: "b",
          seccion: "LOGO",
          datos: { logo: "vendedores/logo.webp" },
          estado: "RECHAZADO",
          motivoRechazo: "No se ve.",
        }),
      ],
    );

    expect(vendedor.descripcion).toBe("Nueva.");
    expect(vendedor.logo).toBeNull();
    expect(estados.DESCRIPCION).toEqual({
      id: "a",
      estado: "PENDIENTE",
      motivo: null,
    });
    expect(estados.LOGO).toEqual({
      id: "b",
      estado: "RECHAZADO",
      motivo: "No se ve.",
    });
  });

  it("ve su versión del producto y sabe si es el alta", () => {
    const producto = {
      id: "p1",
      publicado: true,
      nombre: "Dulce",
      descripcion: null,
      imagenes: [],
      destacado: false,
      stock: null,
      precio: null,
    };
    const editado = productoDelDueno(producto, [
      cambio({
        seccion: "PRODUCTO",
        productoId: "p1",
        datos: {
          nombre: "Dulce de cayote",
          descripcion: null,
          imagenes: [],
          precio: null,
          stock: null,
          destacado: true,
        },
      }),
    ]);
    expect(editado.producto.nombre).toBe("Dulce de cayote");
    expect(editado.nuevo).toBe(false);

    const alta = productoDelDueno({ ...producto, publicado: false }, [
      cambio({ seccion: "PRODUCTO", productoId: "p1", datos: { nuevo: true } }),
    ]);
    expect(alta.nuevo).toBe(true);
    expect(alta.producto.nombre).toBe("Dulce");

    expect(productoDelDueno(producto, []).revision).toBeNull();
  });
});

describe("el tipo de cada cambio, para filtrar la bandeja", () => {
  it("separa el alta de un producto de los cambios a uno publicado", () => {
    expect(tipoDelCambio("PRODUCTO", { nuevo: true })).toBe("producto-nuevo");
    expect(
      tipoDelCambio("PRODUCTO", {
        nombre: "x",
        descripcion: null,
        imagenes: [],
        precio: null,
        stock: null,
        destacado: false,
      }),
    ).toBe("producto");
    expect(tipoDelCambio("LOGO", { logo: "a.webp" })).toBe("logo");
  });
});

describe("la cantidad de un producto", () => {
  it("aprobar un cambio no pisa la cantidad, que se aplica en el momento", async () => {
    base.productos.push({
      id: "p1",
      vendedorId: "v1",
      publicado: true,
      nombre: "Dulce",
      imagenes: [],
      stock: 7,
    });
    await proponerCambio({
      vendedorId: "v1",
      seccion: "PRODUCTO",
      productoId: "p1",
      datos: {
        nombre: "Dulce de cayote",
        descripcion: null,
        imagenes: [],
        precio: null,
        stock: 2,
        destacado: false,
      },
    });
    await aprobarCambio(base.cambios[0]!.id as string, "admin");
    expect(base.productos[0]).toMatchObject({
      nombre: "Dulce de cayote",
      stock: 7,
    });
  });
});
