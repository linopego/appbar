// Rigenera le icone PNG dei pass wallet dal mark canonico Klink (BRAND.md).
// Uso: pnpm add -D sharp && node scripts/generate-wallet-icons.mjs
// poi ricopiare i base64 in src/lib/wallet/pass-assets.ts (vedi in fondo).
import sharp from "sharp";
import { writeFile, mkdir } from "fs/promises";

const MARK_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="16" fill="#C8FF2E"/>
  <path d="M30 12 Q33 32 54 36 Q33 40 30 60 Q27 40 6 36 Q27 32 30 12 Z" fill="#0F1230" transform="translate(2 -4)"/>
  <path d="M52 10 Q53 16 59 17 Q53 18 52 24 Q51 18 45 17 Q51 16 52 10 Z" fill="#0F1230"/>
</svg>`;

// Dimensioni richieste dalle spec Apple: icon 29pt (@1x/@2x/@3x), logo ~50pt
const SIZES = [["icon.png", 29], ["icon@2x.png", 58], ["icon@3x.png", 87], ["logo.png", 50], ["logo@2x.png", 100]];

await mkdir("src/lib/wallet/assets", { recursive: true });
for (const [name, px] of SIZES) {
  const buf = await sharp(Buffer.from(MARK_SVG)).resize(px, px).png().toBuffer();
  await writeFile(`src/lib/wallet/assets/${name}`, buf);
  console.log(name, buf.length, "bytes — base64:", buf.toString("base64").slice(0, 40) + "…");
}
console.log("\nAggiorna src/lib/wallet/pass-assets.ts con i nuovi base64.");
