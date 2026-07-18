// Icone PWA + apple-touch-icon dal mark canonico Klink (BRAND.md).
// Uso: pnpm add -D sharp && node scripts/generate-pwa-icons.mjs
//
// Regola imparata sul campo: le icone di installazione devono essere
// COMPLETAMENTE OPACHE, fondo lime a tutto quadro, NIENTE angoli
// pre-arrotondati (li smussano iOS/Android) e NIENTE trasparenza —
// iOS riempie la trasparenza di nero e l'icona esce scura.
import sharp from "sharp";
import { writeFile, mkdir } from "fs/promises";

const SPARKLE_MAIN = 'M30 12 Q33 32 54 36 Q33 40 30 60 Q27 40 6 36 Q27 32 30 12 Z';
const SPARKLE_SATELLITE = 'M52 10 Q53 16 59 17 Q53 18 52 24 Q51 18 45 17 Q51 16 52 10 Z';

// Fondo lime pieno + scintilla centrata a una data scala (attorno al centro)
function fullBleedSvg(scale) {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" fill="#C8FF2E"/>
  <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
    <path d="${SPARKLE_MAIN}" fill="#0F1230" transform="translate(2 -4)"/>
    <path d="${SPARKLE_SATELLITE}" fill="#0F1230"/>
  </g>
</svg>`;
}

// Icone standard e apple-touch: margine ~12% per lato → contenuto al 76%
const ICON_SVG = fullBleedSvg(0.76);
// Maskable: scintilla dentro la safe zone (cerchio centrale 80%) — il punto
// più esterno (satellite) dista ~37.5 unità dal centro, il raggio utile è
// 25.6: scala 0.62 lo tiene dentro con margine
const MASKABLE_SVG = fullBleedSvg(0.62);

async function render(svg, px, outPath) {
  const buf = await sharp(Buffer.from(svg))
    .resize(px, px)
    .flatten({ background: "#C8FF2E" })
    .removeAlpha() // opacità garantita: nessun canale alpha nel PNG
    .png()
    .toBuffer();
  await writeFile(outPath, buf);
  console.log(outPath, `${px}x${px}`, buf.length, "bytes");
}

await mkdir("public/icons", { recursive: true });
await render(ICON_SVG, 192, "public/icons/icon-192.png");
await render(ICON_SVG, 512, "public/icons/icon-512.png");
await render(MASKABLE_SVG, 192, "public/icons/maskable-192.png");
await render(MASKABLE_SVG, 512, "public/icons/maskable-512.png");
// Convenzione Next App Router: src/app/apple-icon.png → <link rel="apple-touch-icon">
await render(ICON_SVG, 180, "src/app/apple-icon.png");
