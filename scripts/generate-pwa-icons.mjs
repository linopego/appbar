// Icone PWA dal mark canonico Klink (BRAND.md).
// Uso: pnpm add -D sharp && node scripts/generate-pwa-icons.mjs
import sharp from "sharp";
import { writeFile, mkdir } from "fs/promises";

// Mark canonico: tessera lime con angoli 25% + scintilla Ink
const MARK_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="16" fill="#C8FF2E"/>
  <path d="M30 12 Q33 32 54 36 Q33 40 30 60 Q27 40 6 36 Q27 32 30 12 Z" fill="#0F1230" transform="translate(2 -4)"/>
  <path d="M52 10 Q53 16 59 17 Q53 18 52 24 Q51 18 45 17 Q51 16 52 10 Z" fill="#0F1230"/>
</svg>`;

// Maskable: tessera piena (nessun angolo trasparente), scintilla nella
// safe zone centrale (~66%): il sistema ritaglia lui la forma
const MASKABLE_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" fill="#C8FF2E"/>
  <g transform="translate(32 32) scale(0.66) translate(-32 -32)">
    <path d="M30 12 Q33 32 54 36 Q33 40 30 60 Q27 40 6 36 Q27 32 30 12 Z" fill="#0F1230" transform="translate(2 -4)"/>
    <path d="M52 10 Q53 16 59 17 Q53 18 52 24 Q51 18 45 17 Q51 16 52 10 Z" fill="#0F1230"/>
  </g>
</svg>`;

await mkdir("public/icons", { recursive: true });
const JOBS = [
  ["icon-192.png", MARK_SVG, 192],
  ["icon-512.png", MARK_SVG, 512],
  ["maskable-192.png", MASKABLE_SVG, 192],
  ["maskable-512.png", MASKABLE_SVG, 512],
];
for (const [name, svg, px] of JOBS) {
  const buf = await sharp(Buffer.from(svg)).resize(px, px).png().toBuffer();
  await writeFile(`public/icons/${name}`, buf);
  console.log(name, buf.length, "bytes");
}
