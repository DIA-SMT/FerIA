/**
 * Genera `src/app/tema-oscuro.css`: la paleta del tema oscuro.
 *
 *   node scripts/generar-tema-oscuro.mjs
 *
 * El modo oscuro no se escribe pantalla por pantalla. Los colores de Tailwind
 * son variables (`--color-slate-50`, `--color-municipal-600`…) y las clases
 * las leen; con la clase `dark` en `<html>`, este archivo cambia lo que valen,
 * y las 90 y pico de pantallas se dan vuelta solas.
 *
 * Cómo se dan vuelta:
 *
 *   · Las familias de color (el azul municipal, el celeste, los verdes y rojos
 *     de los avisos…) se espejan: el 50 pasa a valer lo que el 950, el 100 lo
 *     que el 900, y así; el 500 queda. Un aviso `bg-emerald-50 text-emerald-900`
 *     —verde clarito con letra oscura— pasa a ser verde oscuro con letra clara,
 *     y un enlace `text-municipal-600` pasa a un azul claro que se lee sobre
 *     fondo oscuro.
 *   · Los grises (slate) no se espejan: van a una escala propia, azulada, para
 *     que la noche sea azul noche y no negro.
 *   · El blanco no se toca —`text-white` sobre un botón azul tiene que seguir
 *     siendo blanco—. Las superficies usan `bg-superficie`, que es blanco de día
 *     y azul noche de noche.
 *
 * Lo que tiene que quedar igual de noche lleva la clase `paleta-original`, que
 * le devuelve la paleta de día. Son dos casos:
 *
 *   · Lo que ya es oscuro de día, como el pie.
 *   · Los botones y pastillas de color lleno con letra blanca. El espejo vuelve
 *     claro un `bg-red-600`, y el blanco encima deja de leerse.
 *
 * Los colores salen de la fuente: la paleta de Tailwind de
 * `node_modules/tailwindcss/theme.css` y la institucional del `@theme` de
 * `globals.css`. Si cambia alguna, se vuelve a correr esto.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Las familias que el sitio usa (ver `grep` en el commit que agregó esto). */
const FAMILIAS_TAILWIND = ["red", "emerald", "amber", "rose", "violet", "orange"];
const FAMILIAS_PROPIAS = ["municipal", "celeste", "acento"];
const TONOS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

/** El espejo de cada tono. El 500 es el centro y no se mueve. */
const ESPEJO = {
  50: "950", 100: "900", 200: "800", 300: "700", 400: "600", 500: "500",
  600: "400", 700: "300", 800: "200", 900: "100", 950: "50",
};

/**
 * Los grises de noche, azulados. No son el espejo de los de día: el espejo
 * daría negro puro y texto blanco puro, que cansa y no es la identidad.
 * Medidos sobre `superficie` (#0f1e34): el 600, que es el texto secundario,
 * da 9:1; el 500, el más apagado que lleva texto, 6,5:1.
 */
const SLATE_NOCHE = {
  50: "#0b1628", // fondos sutiles; el fondo de los paneles
  100: "#15263f", // fondo al pasar el mouse
  200: "#22375a", // bordes
  300: "#30496b", // bordes marcados, deshabilitados
  400: "#62799b", // íconos, marcadores de posición
  500: "#8d9db5", // texto apagado
  600: "#a8b6ca", // texto secundario
  700: "#c4cfdd", // texto
  800: "#dbe3ec", // texto principal
  900: "#edf1f6", // títulos
  950: "#f6f8fb",
};

const SUPERFICIE_DIA = "#ffffff";
const SUPERFICIE_NOCHE = "#0f1e34";

function leerVariables(archivo) {
  const texto = readFileSync(resolve(raiz, archivo), "utf8");
  const variables = new Map();
  for (const [, nombre, valor] of texto.matchAll(/(--color-[a-z]+-\d+):\s*([^;]+);/g)) {
    variables.set(nombre, valor.trim());
  }
  return variables;
}

const tailwind = leerVariables("node_modules/tailwindcss/theme.css");
const propias = leerVariables("src/app/globals.css");

function valor(familia, tono) {
  const nombre = `--color-${familia}-${tono}`;
  const encontrado = propias.get(nombre) ?? tailwind.get(nombre);
  if (!encontrado) throw new Error(`No encuentro ${nombre}`);
  return encontrado;
}

const noche = [];
const original = [];

noche.push(`  --color-superficie: ${SUPERFICIE_NOCHE};`);
original.push(`  --color-superficie: ${SUPERFICIE_DIA};`);

for (const tono of TONOS) {
  noche.push(`  --color-slate-${tono}: ${SLATE_NOCHE[tono]};`);
  original.push(`  --color-slate-${tono}: ${valor("slate", tono)};`);
}

for (const familia of [...FAMILIAS_PROPIAS, ...FAMILIAS_TAILWIND]) {
  for (const tono of TONOS) {
    noche.push(`  --color-${familia}-${tono}: ${valor(familia, ESPEJO[tono])};`);
    original.push(`  --color-${familia}-${tono}: ${valor(familia, tono)};`);
  }
}

const css = `/*
  GENERADO por scripts/generar-tema-oscuro.mjs — no editar a mano.
  Ver el comentario de ese script: cómo se dan vuelta los colores y por qué.
*/

:root.dark {
  color-scheme: dark;
${noche.join("\n")}
}

/* Lo que de noche queda como de día: el pie y los botones de color lleno. */
:root.dark .paleta-original {
  color-scheme: light;
${original.join("\n")}
}
`;

writeFileSync(resolve(raiz, "src/app/tema-oscuro.css"), css);
console.log(`src/app/tema-oscuro.css: ${noche.length} colores de noche.`);
