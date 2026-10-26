"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * El carrito vive en el navegador.
 *
 * No se guarda en la base y no se le pide cuenta a nadie para usarlo: el
 * comprador acá es un vecino que quiere unos alfajores, y pedirle que se
 * registre es la forma más rápida de vaciar el canal. Lo único que llega al
 * servidor es el pedido ya confirmado, con los datos de contacto que la persona
 * escribe en ese momento.
 *
 * **Hay un carrito por feriante, no uno solo.** Cada pedido se le hace a una
 * persona, que es la que cobra y la que entrega; un carrito único con cosas de
 * tres puestos sería tres pedidos, tres pagos y tres conversaciones de WhatsApp
 * disfrazados de una compra. Separarlos desde el principio es decir la verdad
 * sobre lo que está pasando.
 *
 * El precio guardado acá es **sólo para mostrar**. Puede quedar viejo si el
 * feriante lo cambia mientras el carrito está abierto, y puede estar editado a
 * mano por quien sepa abrir las herramientas del navegador. Al confirmar, el
 * servidor relee el precio de la base y arma el pedido con ese: lo que viaja es
 * qué producto y cuántas unidades, nada más.
 */

export interface ItemCarrito {
  productoId: string;
  nombre: string;
  /** Para mostrar mientras se arma el pedido. La fuente real es la base. */
  precioUnitario: number;
  imagen: string | null;
  cantidad: number;
}

export interface CarritoDeStand {
  slug: string;
  emprendimiento: string;
  items: ItemCarrito[];
}

type Carritos = Record<string, CarritoDeStand>;

interface ValorContexto {
  carritos: Carritos;
  /** `false` hasta que se leyó el almacenamiento, para no parpadear en blanco. */
  listo: boolean;
  agregar: (
    stand: { slug: string; emprendimiento: string },
    item: Omit<ItemCarrito, "cantidad">,
    cantidad?: number,
  ) => void;
  cambiarCantidad: (slug: string, productoId: string, cantidad: number) => void;
  quitar: (slug: string, productoId: string) => void;
  vaciar: (slug: string) => void;
}

const Contexto = createContext<ValorContexto | null>(null);

/**
 * La versión va en la clave a propósito: si alguna vez cambia la forma de lo
 * guardado, los carritos viejos no se leen con el formato nuevo, simplemente
 * dejan de existir. Es un carrito, no un documento: perderlo no es grave, y es
 * mucho mejor que renderizar basura.
 */
const CLAVE = "feria:carrito:v1";

/** Tope de unidades por línea, el mismo que valida el servidor. */
const MAXIMO_POR_LINEA = 99;

function leerDelNavegador(): Carritos {
  // Puede tirar: modo privado, cookies bloqueadas, almacenamiento lleno.
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return {};

    const dato: unknown = JSON.parse(crudo);
    if (dato === null || typeof dato !== "object") return {};

    const salida: Carritos = {};
    for (const [slug, valor] of Object.entries(
      dato as Record<string, unknown>,
    )) {
      const carrito = comoCarrito(slug, valor);
      if (carrito) salida[slug] = carrito;
    }
    return salida;
  } catch {
    return {};
  }
}

function comoCarrito(slug: string, valor: unknown): CarritoDeStand | null {
  if (valor === null || typeof valor !== "object") return null;
  const objeto = valor as Record<string, unknown>;

  if (typeof objeto.emprendimiento !== "string") return null;
  if (!Array.isArray(objeto.items)) return null;

  const items: ItemCarrito[] = [];
  for (const crudo of objeto.items) {
    if (crudo === null || typeof crudo !== "object") continue;
    const item = crudo as Record<string, unknown>;
    if (typeof item.productoId !== "string") continue;
    if (typeof item.nombre !== "string") continue;
    if (
      typeof item.precioUnitario !== "number" ||
      !Number.isFinite(item.precioUnitario)
    )
      continue;
    if (typeof item.cantidad !== "number" || !Number.isInteger(item.cantidad))
      continue;
    if (item.cantidad < 1) continue;

    items.push({
      productoId: item.productoId,
      nombre: item.nombre,
      precioUnitario: item.precioUnitario,
      imagen: typeof item.imagen === "string" ? item.imagen : null,
      cantidad: Math.min(item.cantidad, MAXIMO_POR_LINEA),
    });
  }

  if (items.length === 0) return null;
  return { slug, emprendimiento: objeto.emprendimiento, items };
}

function guardarEnNavegador(carritos: Carritos): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(carritos));
  } catch {
    // Sin almacenamiento el carrito sigue funcionando en memoria hasta que la
    // persona recargue. Peor sería romper la página por no poder guardar.
  }
}

export function ProveedorCarrito({ children }: { children: ReactNode }) {
  const [carritos, setCarritos] = useState<Carritos>({});
  const [listo, setListo] = useState(false);

  // La lectura va en un efecto y no en el estado inicial: el servidor renderiza
  // sin localStorage, y si el primer render del cliente trajera los carritos,
  // el HTML no coincidiría con el del servidor.
  useEffect(() => {
    setCarritos(leerDelNavegador());
    setListo(true);
  }, []);

  useEffect(() => {
    if (listo) guardarEnNavegador(carritos);
  }, [carritos, listo]);

  const agregar = useCallback<ValorContexto["agregar"]>(
    (stand, item, cantidad = 1) => {
      setCarritos((previos) => {
        const actual = previos[stand.slug];
        const items = actual ? [...actual.items] : [];
        const indice = items.findIndex((x) => x.productoId === item.productoId);

        if (indice >= 0) {
          const existente = items[indice];
          if (existente) {
            items[indice] = {
              ...existente,
              // El precio se refresca con el que trae la página, que acaba de
              // salir del servidor y es más nuevo que el guardado.
              precioUnitario: item.precioUnitario,
              nombre: item.nombre,
              imagen: item.imagen,
              cantidad: Math.min(
                existente.cantidad + cantidad,
                MAXIMO_POR_LINEA,
              ),
            };
          }
        } else {
          items.push({
            ...item,
            cantidad: Math.min(cantidad, MAXIMO_POR_LINEA),
          });
        }

        return {
          ...previos,
          [stand.slug]: {
            slug: stand.slug,
            emprendimiento: stand.emprendimiento,
            items,
          },
        };
      });
    },
    [],
  );

  const cambiarCantidad = useCallback<ValorContexto["cambiarCantidad"]>(
    (slug, productoId, cantidad) => {
      setCarritos((previos) => {
        const actual = previos[slug];
        if (!actual) return previos;

        if (cantidad < 1) return sinItem(previos, slug, productoId);

        const items = actual.items.map((item) =>
          item.productoId === productoId
            ? { ...item, cantidad: Math.min(cantidad, MAXIMO_POR_LINEA) }
            : item,
        );

        return { ...previos, [slug]: { ...actual, items } };
      });
    },
    [],
  );

  const quitar = useCallback<ValorContexto["quitar"]>((slug, productoId) => {
    setCarritos((previos) => sinItem(previos, slug, productoId));
  }, []);

  const vaciar = useCallback<ValorContexto["vaciar"]>((slug) => {
    setCarritos((previos) => {
      const { [slug]: _descartado, ...resto } = previos;
      return resto;
    });
  }, []);

  const valor = useMemo<ValorContexto>(
    () => ({ carritos, listo, agregar, cambiarCantidad, quitar, vaciar }),
    [carritos, listo, agregar, cambiarCantidad, quitar, vaciar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Saca un item y, si era el último, también el carrito de ese stand. */
function sinItem(
  previos: Carritos,
  slug: string,
  productoId: string,
): Carritos {
  const actual = previos[slug];
  if (!actual) return previos;

  const items = actual.items.filter((item) => item.productoId !== productoId);
  if (items.length === 0) {
    const { [slug]: _vacio, ...resto } = previos;
    return resto;
  }

  return { ...previos, [slug]: { ...actual, items } };
}

export function useCarrito(): ValorContexto {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error("useCarrito necesita estar dentro de <ProveedorCarrito>.");
  }
  return valor;
}

/** Unidades en todos los carritos juntos: es lo que muestra el indicador. */
export function unidadesTotales(carritos: Carritos): number {
  return Object.values(carritos).reduce(
    (suma, carrito) =>
      suma +
      carrito.items.reduce((parcial, item) => parcial + item.cantidad, 0),
    0,
  );
}
