"use client";

import { useEffect, useState } from "react";
import { AppleWalletBadge, GoogleWalletBadge } from "./wallet-badges";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

// Bottoni "aggiungi al wallet" del ticket: su iOS solo Apple, su Android solo
// Google, su desktop entrambi. I flag arrivano dal server (feature flag env):
// senza configurazione il componente non viene proprio montato.
export function WalletButtons({
  qrToken,
  appleEnabled,
  googleEnabled,
  badgeHeight = 44,
}: {
  qrToken: string;
  appleEnabled: boolean;
  googleEnabled: boolean;
  badgeHeight?: number;
}) {
  const [platform, setPlatform] = useState<Platform | null>(null);

  // Rilevamento piattaforma solo client-side (navigator non esiste in SSR);
  // deferito a un tick per non fare setState sincrono nell'effect.
  useEffect(() => {
    const t = window.setTimeout(() => setPlatform(detectPlatform()), 0);
    return () => window.clearTimeout(t);
  }, []);

  if (platform === null) return null;

  const showApple = appleEnabled && platform !== "android";
  const showGoogle = googleEnabled && platform !== "ios";
  if (!showApple && !showGoogle) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {showApple && (
        <a
          href={`/api/tickets/${qrToken}/wallet/apple`}
          aria-label="Add to Apple Wallet"
          className="inline-block"
        >
          <AppleWalletBadge height={badgeHeight} />
        </a>
      )}
      {showGoogle && (
        <a
          href={`/api/tickets/${qrToken}/wallet/google`}
          aria-label="Aggiungi a Google Wallet"
          className="inline-block"
        >
          <GoogleWalletBadge height={badgeHeight} />
        </a>
      )}
    </div>
  );
}
