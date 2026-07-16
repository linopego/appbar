"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { extractTicketToken } from "@/lib/pos/extract-token";
import { messageForCode } from "@/lib/pos/messages";
import { playSound, vibrate } from "@/lib/pos/feedback";
import { formatEur } from "@/lib/utils/money";
import { KlinkLogo } from "@/components/brand/logo";
import { CameraOff } from "lucide-react";
import { pressAffirmativeOnLime, pressNegative } from "@/lib/ui/press";
import type { OperatorRole } from "@/lib/auth/staff";

const SCANNER_ELEMENT_ID = "qr-reader";
const SCAN_COOLDOWN_MS = 2000;

// ── types ──────────────────────────────────────────────────────────────────
interface TierInfo {
  name: string;
  price: string;
}

type State =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "result"; data: LookupData }
  | { kind: "consuming"; tier: TierInfo }
  | { kind: "consumed"; tier: TierInfo }
  | { kind: "error"; code?: string; message: string };

interface LookupData {
  ticketId: string;
  qrToken: string;
  effectiveStatus: "ACTIVE" | "CONSUMED" | "EXPIRED" | "REFUNDED" | "VOIDED";
  tier: TierInfo;
  consumedAt: string | null;
  consumedByName: string | null;
  refundedAt: string | null;
  expiresAt: string;
}

interface Props {
  venueName: string;
  operatorName: string;
  operatorRole?: OperatorRole;
  venueSlug: string;
}

// ── color mapping ──────────────────────────────────────────────────────────
// Esiti secondo BRAND.md: VALIDO = fondo lime con testo Ink (il lime è il
// colore del "sì"); NON VALIDO = fondo error con testo bianco. Il ticket
// trovato in attesa di conferma resta su fondo scuro per leggibilità.
function overlayBg(state: State): string {
  if (state.kind === "result") {
    switch (state.data.effectiveStatus) {
      case "ACTIVE":
        return "bg-klink-ink text-white";
      case "CONSUMED":
      case "EXPIRED":
      case "REFUNDED":
      case "VOIDED":
        return "bg-klink-error text-white";
    }
  }
  if (state.kind === "consuming" || state.kind === "consumed")
    return "bg-klink-success text-klink-ink";
  if (state.kind === "error") return "bg-klink-error text-white";
  return "bg-zinc-900";
}

// ── component ──────────────────────────────────────────────────────────────
export function PosScanner({ venueName, operatorName, operatorRole, venueSlug }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [cameraError, setCameraError] = useState<string | null>(null);
  // Camera on demand: parte SOLO dal bottone "Scansiona ticket"
  const [scannerOn, setScannerOn] = useState(false);
  const lastScanAtRef = useRef<number>(0);
  const stateRef = useRef<State>({ kind: "idle" });

  // Keep stateRef in sync so callback closure sees latest state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Wake lock: schermo acceso SOLO mentre lo scanner è in funzione
  useEffect(() => {
    if (!scannerOn) return;
    let wakeLock: WakeLockSentinel | null = null;
    async function acquireLock() {
      if ("wakeLock" in navigator) {
        try {
          wakeLock = await navigator.wakeLock.request("screen");
        } catch {
          // not supported or denied
        }
      }
    }
    acquireLock();
    const handler = () => {
      if (document.visibilityState === "visible") acquireLock();
    };
    document.addEventListener("visibilitychange", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      wakeLock?.release().catch(() => {});
    };
  }, [scannerOn]);

  const handleScan = useCallback(async (text: string) => {
    const now = Date.now();
    if (now - lastScanAtRef.current < SCAN_COOLDOWN_MS) return;
    const cur = stateRef.current;
    if (cur.kind !== "idle" && cur.kind !== "consumed") return;

    lastScanAtRef.current = now;

    const token = extractTicketToken(text);
    if (!token) {
      setState({ kind: "error", message: "QR non valido" });
      setTimeout(() => setState({ kind: "idle" }), 3000);
      return;
    }

    setState({ kind: "scanning" });

    try {
      const res = await fetch("/api/pos/ticket/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: LookupData;
        error?: { code?: string; message?: string };
      };

      if (!res.ok || !json.ok) {
        const code = json.error?.code;
        setState({ kind: "error", code, message: messageForCode(code) });
        playSound("error");
        return;
      }

      setState({ kind: "result", data: json.data! });
      playSound(json.data!.effectiveStatus === "ACTIVE" ? "beep" : "warn");
    } catch {
      setState({ kind: "error", message: "Errore di rete. Riprova." });
      playSound("error");
    }
  }, []);

  // Camera on demand: il loop (scan → feedback → camera pronta) resta
  // identico, cambia solo quando parte e quando si ferma.
  useEffect(() => {
    if (!scannerOn) return;
    let mounted = true;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;
        scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 280 }, aspectRatio: 1.0 },
          handleScan,
          () => {}
        );
      } catch (err) {
        if (!mounted) return;
        const denied =
          err instanceof Error &&
          (err.message.toLowerCase().includes("permission") ||
            err.name === "NotAllowedError");
        const msg = denied
          ? "Fotocamera non consentita. Tocca l'icona del lucchetto (o ⓘ) nella barra dell'indirizzo, consenti la fotocamera per questo sito e riprova."
          : "Impossibile attivare la fotocamera. Chiudi altre app che la stanno usando e riprova.";
        setCameraError(msg);
        setScannerOn(false);
      }
    })();

    return () => {
      mounted = false;
      scanner?.stop().catch(() => {});
      try { scanner?.clear(); } catch { /* ignore */ }
    };
  }, [scannerOn, handleScan]);

  // Logout: POST via fetch e push verso il login PIN del venue — mai
  // navigare direttamente all'URL dell'API (mostrerebbe il JSON crudo)
  const handleLogout = async () => {
    try {
      await fetch("/api/staff/logout", { method: "POST" });
    } catch {
      // anche se la rete fallisce, si torna comunque al login
    }
    router.push(`/staff/${venueSlug}`);
    router.refresh();
  };

  const handleConsume = async () => {
    if (state.kind !== "result" || state.data.effectiveStatus !== "ACTIVE") return;
    const { qrToken, tier } = state.data;
    setState({ kind: "consuming", tier });

    try {
      const res = await fetch("/api/pos/ticket/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { tier: TierInfo };
        error?: { code?: string; consumedAt?: string; consumedByName?: string };
      };

      if (!res.ok || !json.ok) {
        const code = json.error?.code;
        const msg = messageForCode(code, json.error as Record<string, unknown>);
        setState({ kind: "error", code, message: msg });
        playSound("error");
        vibrate([200, 100, 200]);
        setTimeout(() => setState({ kind: "idle" }), 4000);
        return;
      }

      setState({ kind: "consumed", tier: json.data?.tier ?? tier });
      playSound("success");
      vibrate(200);
      setTimeout(() => setState({ kind: "idle" }), 2000);
    } catch {
      setState({ kind: "error", message: "Errore di rete. Riprova." });
      setTimeout(() => setState({ kind: "idle" }), 4000);
    }
  };

  const dismiss = () => setState({ kind: "idle" });

  const showOverlay =
    state.kind !== "idle" && state.kind !== "scanning";

  return (
    <div className="dark flex flex-col h-dvh bg-black text-zinc-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <KlinkLogo variant="mark" size={22} className="shrink-0" />
          <span className="text-sm font-semibold truncate">{venueName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400 shrink-0">
          <span className="hidden sm:inline">{operatorName}</span>
          <Link
            href={`/staff/${venueSlug}/stats`}
            className="underline hover:text-zinc-200"
          >
            Stats
          </Link>
          {operatorRole === "MANAGER" && (
            <Link
              href="/admin"
              className="underline hover:text-zinc-200 font-semibold"
            >
              Admin
            </Link>
          )}
          {/* Logout via fetch + push: mai navigare all'URL dell'API (JSON crudo) */}
          <button onClick={handleLogout} className="underline hover:text-zinc-200">
            Esci
          </button>
        </div>
      </div>

      {/* Camera area */}
      <div className="flex-1 relative flex items-center justify-center bg-zinc-950">
        {!scannerOn ? (
          <div className="text-center px-6 space-y-5 max-w-sm w-full">
            {cameraError && (
              <div className="space-y-2">
                <CameraOff aria-hidden className="mx-auto h-10 w-10 text-zinc-400" />
                <p className="text-base text-zinc-300 leading-relaxed">{cameraError}</p>
              </div>
            )}
            <button
              onClick={() => {
                setCameraError(null);
                setScannerOn(true);
              }}
              className={`w-full min-h-16 py-5 bg-klink-lime hover:bg-klink-lime-hover rounded-2xl text-2xl font-bold text-klink-ink ${pressAffirmativeOnLime}`}
            >
              {cameraError ? "Riprova" : "Scansiona ticket"}
            </button>
          </div>
        ) : (
          <>
            <div
              id={SCANNER_ELEMENT_ID}
              className="w-full h-full"
              style={{ maxHeight: "calc(100dvh - 96px)" }}
            />
            <button
              onClick={() => setScannerOn(false)}
              className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-40 px-6 min-h-12 rounded-full border border-zinc-600 bg-zinc-900/80 text-lg text-zinc-200 hover:bg-zinc-800 ${pressNegative}`}
            >
              Ferma scanner
            </button>
          </>
        )}

        {/* Overlay */}
        {showOverlay && (
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center p-6 transition-colors duration-200",
              overlayBg(state)
            )}
          >
            <OverlayContent
              state={state}
              onConsume={handleConsume}
              onDismiss={dismiss}
            />
          </div>
        )}
      </div>

      {/* Footer status */}
      <div className="shrink-0 px-4 py-2 text-center text-xs text-zinc-500 border-t border-zinc-800">
        {state.kind === "idle" && (scannerOn ? "Inquadra un QR..." : "Scanner fermo")}
        {state.kind === "scanning" && "Ricerca ticket..."}
        {state.kind === "consuming" && "Conferma in corso..."}
        {state.kind === "consumed" && "✓ Consegnato"}
        {state.kind === "result" && "Ticket trovato"}
        {state.kind === "error" && state.message}
      </div>
    </div>
  );
}

// ── overlay sub-component ──────────────────────────────────────────────────
function OverlayContent({
  state,
  onConsume,
  onDismiss,
}: {
  state: State;
  onConsume: () => void;
  onDismiss: () => void;
}) {
  if (state.kind === "result") {
    const { effectiveStatus, tier, consumedAt, consumedByName } = state.data;

    if (effectiveStatus === "ACTIVE") {
      return (
        <div className="text-center space-y-6 max-w-sm w-full">
          <div>
            <div className="text-6xl font-black uppercase tracking-tight">{tier.name}</div>
            <div className="text-3xl text-klink-lime mt-2 tabular-nums">{formatEur(tier.price)}</div>
          </div>
          <button
            onClick={onConsume}
            className={`w-full py-5 bg-klink-lime hover:bg-klink-lime-hover rounded-2xl text-2xl font-bold text-klink-ink ${pressAffirmativeOnLime}`}
          >
            ✓ Consegnato
          </button>
          <button
            onClick={onDismiss}
            className={`w-full py-3 rounded-2xl text-sm text-zinc-400 hover:text-zinc-200 ${pressNegative}`}
          >
            Annulla
          </button>
        </div>
      );
    }

    // Non-ACTIVE result
    const label =
      effectiveStatus === "CONSUMED"
        ? consumedAt
          ? `Consegnato alle ${new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(consumedAt))}${consumedByName ? ` da ${consumedByName}` : ""}`
          : "Già consegnato"
        : effectiveStatus === "EXPIRED"
          ? "Ticket scaduto"
          : effectiveStatus === "VOIDED"
            ? "Ticket annullato"
            : "Ticket rimborsato";

    return (
      <div className="text-center space-y-4 max-w-sm w-full">
        <div className="text-4xl font-bold">{tier.name}</div>
        <div className="text-zinc-400">{formatEur(tier.price)}</div>
        <div className="text-lg text-zinc-300">{label}</div>
        <button onClick={onDismiss} className="w-full py-4 bg-zinc-700 hover:bg-zinc-600 rounded-2xl font-semibold">
          Chiudi
        </button>
      </div>
    );
  }

  if (state.kind === "consuming") {
    return (
      <div className="text-center space-y-4">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-klink-ink border-t-transparent" />
        <div className="text-xl font-semibold">{state.tier.name}</div>
        <div className="text-klink-ink/70">Conferma in corso...</div>
      </div>
    );
  }

  if (state.kind === "consumed") {
    return (
      <div className="text-center space-y-4">
        <div className="text-7xl">✓</div>
        <div className="text-4xl font-black uppercase">{state.tier.name}</div>
        <div className="text-2xl tabular-nums">{formatEur(state.tier.price)}</div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="text-center space-y-4 max-w-sm w-full">
        <div className="text-5xl">✕</div>
        <div className="text-xl font-semibold">{state.message}</div>
        <button onClick={onDismiss} className="w-full py-4 bg-zinc-700 hover:bg-zinc-600 rounded-2xl font-semibold">
          Chiudi
        </button>
      </div>
    );
  }

  return null;
}
