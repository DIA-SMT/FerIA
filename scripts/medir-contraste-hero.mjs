import sharp from "sharp";

/**
 * Mide el contraste del hero claro componiendo foto + velo, igual que el
 * navegador: busca el píxel MÁS OSCURO de la franja de texto, que es el peor
 * caso para letra oscura sobre fondo claro.
 */

// Paradas de `.velo-hero-claro`, en pares [posición, opacidad del blanco].
const VELO = [
  [0.0, 1.0],
  [0.3, 1.0],
  [0.42, 0.96],
  [0.5, 0.92],
  [0.6, 0.55],
  [0.72, 0.18],
  [0.84, 0.0],
  [1.0, 0.0],
];

function alfaDelVelo(t) {
  for (let i = 1; i < VELO.length; i++) {
    const [x0, a0] = VELO[i - 1];
    const [x1, a1] = VELO[i];
    if (t <= x1) return a0 + ((t - x0) / (x1 - x0)) * (a1 - a0);
  }
  return 0;
}

const canal = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminancia = (r, g, b) =>
  0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
const contraste = (l1, l2) =>
  (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

// Sólo lo que se apoya DIRECTAMENTE sobre la foto. El placeholder del
// buscador no está acá porque vive dentro de una caja blanca opaca: medirlo
// contra el peor píxel de la foto daría un número alarmante y falso.
const TEXTOS = {
  "titulo (municipal-950)": "#051f47",
  "Tucumanas (municipal-600)": "#0455cc",
  "antetitulo (municipal-700)": "#0345a5",
  "parrafo (slate-700)": "#334155",
  "ayuda del buscador (slate-600)": "#475569",
  "etiquetas de los numeros": "#475569",
};

(async () => {
  const anchoPantalla = Number(process.argv[2] ?? 1440);
  // El bloque de texto son 6 de 12 columnas del grid, dentro de max-w-7xl.
  const fraccionTexto = 6 / 12;

  const { data, info } = await sharp("public/hero-feria-dia.webp")
    .raw()
    .toBuffer({ resolveWithObject: true });

  let peor = { l: 1, x: 0, y: 0 };

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < Math.floor(info.width * fraccionTexto); x++) {
      const i = (y * info.width + x) * info.channels;
      const t = x / info.width;
      const a = alfaDelVelo(t);
      // Blanco encima con alfa `a`, que es lo que hace el degradado.
      const r = data[i] * (1 - a) + 255 * a;
      const g = data[i + 1] * (1 - a) + 255 * a;
      const b = data[i + 2] * (1 - a) + 255 * a;
      const l = luminancia(r, g, b);
      if (l < peor.l) peor = { l, x, y };
    }
  }

  console.log(
    `Peor pixel de la franja de texto (${anchoPantalla} px): x=${peor.x} y=${peor.y}, luminancia ${peor.l.toFixed(4)}\n`,
  );

  for (const [nombre, color] of Object.entries(TEXTOS)) {
    const [r, g, b] = hex(color);
    const ratio = contraste(peor.l, luminancia(r, g, b));
    const aa = ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA grande" : "NO PASA";
    const aaa = ratio >= 7 ? " · AAA" : "";
    console.log(`  ${nombre.padEnd(32)} ${ratio.toFixed(1)}:1   ${aa}${aaa}`);
  }
})();
