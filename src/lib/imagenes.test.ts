import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { procesarFotoProducto } from "@/lib/imagenes";

type Color = [number, number, number];

/** Azar reproducible (LCG), para el ruido y las motas. */
function azar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Arma una foto de `ancho`×`alto` pintando cada píxel y la devuelve en PNG. */
async function foto(
  ancho: number,
  alto: number,
  pintar: (x: number, y: number) => Color,
): Promise<Buffer> {
  const datos = Buffer.alloc(ancho * alto * 3);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const [r, g, b] = pintar(x, y);
      const i = (y * ancho + x) * 3;
      datos[i] = r;
      datos[i + 1] = g;
      datos[i + 2] = b;
    }
  }
  return sharp(datos, { raw: { width: ancho, height: alto, channels: 3 } })
    .png()
    .toBuffer();
}

/** El producto: un rectángulo rojo en el centro de una foto de 400×300. */
const enProducto = (x: number, y: number) =>
  x >= 100 && x < 300 && y >= 75 && y < 225;
const ROJO: Color = [170, 45, 40];

/**
 * Color de la salida (1200×1200, foto entera con `contain`) en el punto que era
 * (x, y) en la foto de 400×300: escala 3 y 150 px de relleno arriba.
 */
async function colorEn(salida: Buffer, x: number, y: number): Promise<Color> {
  const { data, info } = await sharp(salida)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i = ((y * 3 + 150) * info.width + x * 3) * info.channels;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
}

const luz = ([r, g, b]: Color) => 0.299 * r + 0.587 * g + 0.114 * b;

describe("el blanqueo del fondo de las fotos de producto", () => {
  it("no blanquea un fondo oscuro aunque sea parejo (foto de cocina con poca luz)", async () => {
    const ruido = azar(1);
    const entrada = await foto(400, 300, (x, y) => {
      if (enProducto(x, y)) return ROJO;
      // Una bolsa blanca cerca del borde: da altas luces, así que tampoco se
      // aclara la exposición — igual que la foto real que falló.
      if (x >= 330 && x < 380 && y >= 30 && y < 80) return [250, 250, 248];
      const n = Math.round((ruido() - 0.5) * 20);
      return [70 + n, 50 + n, 35 + n];
    });

    const { contenido, ajustes } = await procesarFotoProducto(entrada);

    expect(ajustes.fondoBlanco).toBe(false);
    // La mesa sigue siendo mesa: nada de manchones blancos.
    expect(luz(await colorEn(contenido, 40, 150))).toBeLessThan(110);
    expect(luz(await colorEn(contenido, 200, 260))).toBeLessThan(110);
  });

  it("sigue blanqueando un fondo claro y liso", async () => {
    const ruido = azar(2);
    const entrada = await foto(400, 300, (x, y) => {
      if (enProducto(x, y)) return ROJO;
      const n = Math.round((ruido() - 0.5) * 8);
      return [228 + n, 226 + n, 220 + n];
    });

    const { contenido, ajustes } = await procesarFotoProducto(entrada);

    expect(ajustes.fondoBlanco).toBe(true);
    expect(luz(await colorEn(contenido, 40, 150))).toBeGreaterThan(245);
    // El producto queda intacto.
    const [r, g, b] = await colorEn(contenido, 200, 150);
    expect(r).toBeGreaterThan(130);
    expect(g).toBeLessThan(90);
    expect(b).toBeLessThan(90);
  });

  it("no blanquea si quedaría salteado (un individual moteado sobre una mesa lisa)", async () => {
    // Los bordes son mesa lisa, así que el fondo pasa por «parejo»; pero
    // alrededor del producto hay un individual con motas, y la inundación se
    // mete entre ellas: blanquearía el claro y dejaría las motas sueltas.
    const motas = azar(3);
    const enIndividual = (x: number, y: number) =>
      x >= 40 && x < 360 && y >= 40 && y < 260;
    const entrada = await foto(400, 300, (x, y) => {
      if (enProducto(x, y)) return ROJO;
      if (enIndividual(x, y) && motas() < 0.15) return [110, 110, 110];
      return [225, 225, 225];
    });

    const { ajustes } = await procesarFotoProducto(entrada);

    expect(ajustes.fondoBlanco).toBe(false);
  });
});
