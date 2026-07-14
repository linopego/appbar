import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/brand";

// Logo Klink — mark canonico da BRAND.md (scintilla a 4 punte + satellite su
// tessera lime, angoli 25%). Gli hex vivono SOLO qui e in globals.css.
//
// Varianti:
//   mark   — la tessera da sola (favicon, header compatti, watermark)
//   lockup — mark + wordmark `klink` in Sora bold minuscolo; il colore del
//            wordmark segue currentColor (Ink su chiaro, bianco su Ink)
//   mono   — monocromia: tessera in currentColor con scintilla ritagliata
//            (Ink su fondi chiari, bianca su fondi scuri)

const SPARKLE_MAIN = "M30 12 Q33 32 54 36 Q33 40 30 60 Q27 40 6 36 Q27 32 30 12 Z";
const SPARKLE_SATELLITE = "M52 10 Q53 16 59 17 Q53 18 52 24 Q51 18 45 17 Q51 16 52 10 Z";

function MarkSvg({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={BRAND_NAME}
      className={className}
    >
      <rect width="64" height="64" rx="16" fill="#C8FF2E" />
      <path d={SPARKLE_MAIN} fill="#0F1230" transform="translate(2 -4)" />
      <path d={SPARKLE_SATELLITE} fill="#0F1230" />
    </svg>
  );
}

function MonoSvg({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={BRAND_NAME}
      className={className}
    >
      <mask id="klink-mono-mask">
        <rect width="64" height="64" rx="16" fill="white" />
        <path d={SPARKLE_MAIN} fill="black" transform="translate(2 -4)" />
        <path d={SPARKLE_SATELLITE} fill="black" />
      </mask>
      <rect width="64" height="64" rx="16" fill="currentColor" mask="url(#klink-mono-mask)" />
    </svg>
  );
}

export function KlinkLogo({
  variant = "lockup",
  size = 28,
  className,
}: {
  variant?: "mark" | "lockup" | "mono";
  /** Altezza del mark in px (minimo 20 da BRAND.md) */
  size?: number;
  className?: string;
}) {
  if (variant === "mark") {
    return <MarkSvg size={size} className={className} />;
  }

  if (variant === "mono") {
    return <MonoSvg size={size} className={className} />;
  }

  // Lockup orizzontale: distanza = 1/2 della larghezza del mark
  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap: size / 2 }}>
      <MarkSvg size={size} />
      <span
        className="font-display font-bold lowercase leading-none tracking-tight"
        style={{ fontSize: size * 0.72 }}
      >
        {BRAND_NAME.toLowerCase()}
      </span>
    </span>
  );
}
