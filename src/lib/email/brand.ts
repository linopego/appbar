import { BRAND_NAME } from "@/lib/brand";

// ─────────────────────────────────────────────────────────────────────────────
// Brand Klink per le email transazionali (BRAND.md §7: header Ink con lockup
// bianco, corpo bianco, CTA lime con testo Ink).
//
// UNICO punto (insieme al logo SVG) in cui gli hex del brand vivono fuori da
// globals.css: i client email non leggono variabili CSS, i colori vanno inline.
// Gli hex sono ESATTAMENTE quelli di BRAND.md.
// ─────────────────────────────────────────────────────────────────────────────

export const EMAIL_COLORS = {
  lime: "#C8FF2E",
  limeSoft: "#F2FFD1",
  ink: "#0F1230",
  inkSoft: "#4A4E6B",
  inkMuted: "#8A8FA8",
  cream: "#F4F2EA",
  white: "#FFFFFF",
  border: "#E8E4DA",
  error: "#E2472B",
  warning: "#F0A500",
} as const;

const FONT = "'Sora', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const BODY_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// CTA primaria: pill lime, testo Ink (mai bianco su lime — regola vincolante)
export function emailCta(href: string, label: string): string {
  return `
    <div style="text-align: center; margin: 0 0 24px;">
      <a href="${href}"
         style="display: inline-block; padding: 14px 36px; background: ${EMAIL_COLORS.lime}; color: ${EMAIL_COLORS.ink}; text-decoration: none; border-radius: 9999px; font-weight: 600; font-family: ${BODY_FONT};">
        ${escapeHtml(label)}
      </a>
    </div>`;
}

// Riquadro informativo neutro (righe chiave/valore, note)
export function emailPanel(innerHtml: string): string {
  return `
    <div style="background: ${EMAIL_COLORS.cream}; border-radius: 12px; padding: 16px 20px; margin: 0 0 24px;">
      ${innerHtml}
    </div>`;
}

// Layout: fondo cream, header Ink con wordmark bianco, card bianca radius 16.
// Il wordmark è testuale (i client email spesso bloccano SVG/immagini inline):
// `klink` minuscolo bold, come da BRAND.md.
export function emailLayout(opts: { title: string; bodyHtml: string }): string {
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: ${BODY_FONT}; background: ${EMAIL_COLORS.cream};">
  <div style="max-width: 560px; margin: 32px auto; padding: 0 16px;">
    <div style="background: ${EMAIL_COLORS.ink}; border-radius: 16px 16px 0 0; padding: 20px 32px;">
      <span style="font-family: ${FONT}; font-weight: 700; font-size: 22px; color: ${EMAIL_COLORS.white}; letter-spacing: -0.02em;">${BRAND_NAME.toLowerCase()}</span>
    </div>
    <div style="background: ${EMAIL_COLORS.white}; border-radius: 0 0 16px 16px; padding: 32px;">
      ${opts.bodyHtml}
    </div>
    <p style="margin: 16px 0 0; color: ${EMAIL_COLORS.inkMuted}; font-size: 12px; text-align: center; font-family: ${BODY_FONT};">
      ${BRAND_NAME} — email automatica, non rispondere a questo messaggio.
    </p>
  </div>
</body>
</html>
  `.trim();
}
