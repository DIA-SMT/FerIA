import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import sharp from "sharp";

/*
  La imagen del catálogo que el feriante comparte por WhatsApp o sube a
  Instagram: su nombre, sus productos con foto (y precio, si lo pone) y cómo
  encontrarlo. La arma `next/og` en el servidor, así sale igual en cualquier
  teléfono y con las fotos reales, no con una captura de pantalla.

  Sólo servidor: lee las tipografías del disco y procesa las fotos con sharp.
*/

export const MAXIMO_PRODUCTOS = 6;

export type FormatoImagen = "publicacion" | "historia";

/** Publicación: 4:5, lo que mejor ocupa el feed de Instagram y un chat. */
const ALTO: Record<FormatoImagen, number> = {
  publicacion: 1350,
  historia: 1920,
};
const ANCHO = 1080;
const MARGEN = 56;
const ENCABEZADO = 150;
const PIE = 150;
const SEPARACION = 36;
const HUECO = 24;

/** Columnas y filas según cuántos productos y el formato. */
function grilla(formato: FormatoImagen, cantidad: number) {
  const tabla: Record<FormatoImagen, Array<[number, number]>> = {
    // índice = cantidad de productos
    publicacion: [
      [1, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [2, 2],
      [3, 2],
      [3, 2],
    ],
    historia: [
      [1, 1],
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 2],
      [2, 3],
      [2, 3],
    ],
  };
  const [columnas, filas] = tabla[formato][Math.min(cantidad, 6)]!;
  return { columnas, filas };
}

export interface ProductoDeLaImagen {
  nombre: string;
  /** La foto tal como está guardada. `null` si no tiene. */
  foto: Buffer | null;
  /** Ya escrito: «$ 15.000». */
  precio: string | null;
}

export interface DatosDeLaImagen {
  formato: FormatoImagen;
  emprendimiento: string;
  /** «Gastronomía · Feria de Emprendedores». */
  subtitulo: string;
  logo: Buffer | null;
  /** El WhatsApp como se lee: «381 512-3456». */
  whatsapp: string;
  instagram: string | null;
  /** Sin protocolo: «feria.smt.gob.ar/stands/dulces-de-tita». */
  enlace: string;
  productos: ProductoDeLaImagen[];
}

async function aDataUrl(
  contenido: Buffer,
  ancho: number,
  alto: number,
): Promise<string> {
  const jpeg = await sharp(contenido)
    .rotate()
    .resize(ancho, alto, { fit: "cover" })
    .jpeg({ quality: 82 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

let fuentes: Promise<
  Array<{ name: string; data: Buffer; weight: 600 | 800 }>
> | null = null;

/** Baloo 2, la letra redonda del sitio. Se lee una vez por proceso. */
function cargarFuentes() {
  fuentes ??= Promise.all(
    ([600, 800] as const).map(async (weight) => ({
      name: "Baloo",
      weight,
      data: await readFile(
        path.join(
          process.cwd(),
          "src/fuentes/imagenes",
          `baloo-2-${weight}.ttf`,
        ),
      ),
    })),
  );
  return fuentes;
}

const AZUL_OSCURO = "#081B45";
const AZUL = "#0866F2";
const GRIS = "#374B70";

export async function imagenDelCatalogo(
  datos: DatosDeLaImagen,
): Promise<ImageResponse> {
  const alto = ALTO[datos.formato];
  const productos = datos.productos.slice(0, MAXIMO_PRODUCTOS);
  const { columnas, filas } = grilla(datos.formato, productos.length);
  const conPrecio = productos.some((producto) => producto.precio);

  const anchoUtil = ANCHO - 2 * MARGEN;
  const altoUtil = alto - 2 * MARGEN - ENCABEZADO - PIE - 2 * SEPARACION;
  const anchoCelda = Math.floor(
    (anchoUtil - (columnas - 1) * HUECO) / columnas,
  );
  const altoCelda = Math.floor((altoUtil - (filas - 1) * HUECO) / filas);
  const tresColumnas = columnas === 3;
  // Lugar para dos renglones de nombre: con tres columnas, uno solo cortaba
  // «Empanadas tucumanas» en «Empanadas tucuma…».
  const altoTexto = (tresColumnas ? 100 : 122) + (conPrecio ? 48 : 0);
  // Sin pasarse de un poco más alta que ancha: una foto finita y larga no
  // muestra nada.
  const altoFoto = Math.min(
    altoCelda - altoTexto,
    Math.round(anchoCelda * 1.1),
  );

  const [tipografias, logo, fotos] = await Promise.all([
    cargarFuentes(),
    datos.logo ? aDataUrl(datos.logo, 240, 240) : null,
    Promise.all(
      productos.map((producto) =>
        producto.foto ? aDataUrl(producto.foto, anchoCelda, altoFoto) : null,
      ),
    ),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: ANCHO,
        height: alto,
        display: "flex",
        flexDirection: "column",
        padding: MARGEN,
        fontFamily: "Baloo",
        color: AZUL_OSCURO,
        backgroundImage:
          "linear-gradient(180deg, #dcecfb 0%, #f5f9ff 55%, #ffffff 100%)",
      }}
    >
      {/* Encabezado: logo, nombre y de qué es. */}
      <div
        style={{ display: "flex", alignItems: "center", height: ENCABEZADO }}
      >
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            width={120}
            height={120}
            style={{
              borderRadius: 60,
              border: "6px solid white",
              marginRight: 28,
              objectFit: "cover",
            }}
            alt=""
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              fontSize: datos.emprendimiento.length > 26 ? 50 : 62,
              fontWeight: 800,
              lineHeight: 1.02,
            }}
          >
            {datos.emprendimiento}
          </div>
          {datos.subtitulo && (
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: GRIS,
                marginTop: 6,
              }}
            >
              {datos.subtitulo}
            </div>
          )}
        </div>
      </div>

      {/* Los productos. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignContent: "center",
          gap: HUECO,
          height: altoUtil,
          marginTop: SEPARACION,
          marginBottom: SEPARACION,
        }}
      >
        {productos.map((producto, indice) => (
          <div
            key={indice}
            style={{
              display: "flex",
              flexDirection: "column",
              width: anchoCelda,
              backgroundColor: "white",
              borderRadius: 28,
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(8, 27, 69, 0.10)",
            }}
          >
            {fotos[indice] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fotos[indice]!}
                width={anchoCelda}
                height={altoFoto}
                style={{ objectFit: "cover" }}
                alt=""
              />
            ) : (
              <div
                style={{
                  width: anchoCelda,
                  height: altoFoto,
                  backgroundColor: "#e6f0fb",
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: tresColumnas ? "14px 20px 18px" : "18px 26px 22px",
              }}
            >
              <div
                style={{
                  fontSize: tresColumnas ? 28 : 34,
                  fontWeight: 600,
                  lineHeight: 1.15,
                  display: "block",
                  lineClamp: 2,
                }}
              >
                {producto.nombre}
              </div>
              {producto.precio && (
                <div
                  style={{
                    fontSize: tresColumnas ? 32 : 40,
                    fontWeight: 800,
                    color: AZUL,
                    marginTop: 4,
                  }}
                >
                  {producto.precio}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Cómo encontrarlo. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: PIE,
          padding: "0 32px",
          backgroundColor: "white",
          borderRadius: 28,
          boxShadow: "0 8px 24px rgba(8, 27, 69, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: "#059669",
              marginRight: 14,
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.15h-.01a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 012.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.09-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29z" />
            </svg>
          </div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{datos.whatsapp}</div>
          {datos.instagram && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginLeft: "auto",
              }}
            >
              <svg
                width="38"
                height="38"
                viewBox="0 0 24 24"
                fill="none"
                stroke={AZUL_OSCURO}
                strokeWidth="2"
                style={{ marginRight: 10 }}
              >
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle
                  cx="17.2"
                  cy="6.8"
                  r="1"
                  fill={AZUL_OSCURO}
                  stroke="none"
                />
              </svg>
              <div style={{ fontSize: 32, fontWeight: 600 }}>
                {`@${datos.instagram}`}
              </div>
            </div>
          )}
        </div>
        <div
          style={{ fontSize: 24, fontWeight: 600, color: GRIS, marginTop: 10 }}
        >
          {`Ferias de la Ciudad · ${datos.enlace}`}
        </div>
      </div>
    </div>,
    {
      width: ANCHO,
      height: alto,
      fonts: tipografias.map(({ name, data, weight }) => ({
        name,
        data,
        weight,
        style: "normal" as const,
      })),
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
