"use client";

import { useEffect, useState } from "react";

// "Klink sempre a portata di mano": invito a installare la PWA.
// - Android/Chrome: bottone che lancia il prompt nativo (beforeinstallprompt)
// - iOS/Safari: mini guida in 2 passi (niente prompt programmatico su iOS)
// - Già installata (display-mode: standalone): la card NON compare
// Visivamente secondaria: fondo bianco, testi ink-soft, lime solo sul bottone.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Icona di sistema iOS "Condividi" (quadrato con freccia in su), inline
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
      <path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}

// Icona di sistema iOS "Aggiungi alla schermata Home" (quadrato con +), inline
function AddToHomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  );
}

type Mode = "hidden" | "android" | "ios";

export function InstallAppCard() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    // Già installata → niente card
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    if (standalone) return;

    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIos) {
      const t = window.setTimeout(() => setMode("ios"), 0);
      return () => window.clearTimeout(t);
    }

    // Android/Chrome: la card compare solo se il browser offre il prompt
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setMode("android");
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (mode === "hidden") return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setMode("hidden");
    setDeferredPrompt(null);
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Klink sempre a portata di mano</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aggiungi Klink alla schermata Home: i tuoi ticket a un tocco, anche in
            coda al banco.
          </p>
        </div>
        {mode === "android" ? (
          <button
            onClick={handleInstall}
            className="shrink-0 px-4 py-2 rounded-full bg-klink-lime text-klink-ink text-sm font-semibold hover:bg-klink-lime-hover transition-colors"
          >
            Aggiungi
          </button>
        ) : (
          <button
            onClick={() => setShowIosSteps((v) => !v)}
            className="shrink-0 px-4 py-2 rounded-full border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showIosSteps ? "Chiudi" : "Come si fa"}
          </button>
        )}
      </div>

      {mode === "ios" && showIosSteps && (
        <ol className="mt-3 pt-3 border-t space-y-2.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2.5">
            <ShareIcon />
            <span>
              1. Tocca <strong className="text-foreground">Condividi</strong> nella barra di
              Safari
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <AddToHomeIcon />
            <span>
              2. Scegli <strong className="text-foreground">Aggiungi alla schermata Home</strong>
            </span>
          </li>
        </ol>
      )}
    </div>
  );
}
