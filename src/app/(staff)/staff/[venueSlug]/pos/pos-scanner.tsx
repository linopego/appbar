"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { extractTicketToken } from "@/lib/pos/extract-token";
import { messageForCode } from "@/lib/pos/messages";
import { playSound, vibrate } from "@/lib/pos/feedback";
import { formatEur } from "@/lib/utils/money";
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
  effectiveStatus: "ACTIVE" | "CONSUMED" | "EXPIRED" | "REFUNDED";
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
function overlayBg(state: State): string {
  if (state.kind === "result") {
    switch (state.data.effectiveStatus) {
      case "ACTIVE":
        return "bg-green-900";
      case "CONSUMED":
        return "bg-zinc-800";
      case "EXPIRED":
        return "bg-zinc-700";
      case "REFUNDED":
        return "bg-red-950";
    }
  }
  if (state.kind === "consuming" || state.kind === "consumed") return "bg-green-900";
  if (state.kind === "error") return "bg-red-950";
  return "bg-zinc-900";
}

// ── component ──────────────────────────────────────────────────────────────
export function PosScanner({ venueName, operatorName, venueSlug }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const lastScanAtRef = useRef<number>(0);
  const stateRef = useRef<State>({ kind: "idle" });

  // Keep stateRef in sync so callback closure sees latest state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Wake lock to keep screen on
  useEffect(() => {
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
  }, []);

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

  // Mount scanner once
  useEffect(() => {
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
        const msg =
          err instanceof Error && err.message.toLowerCase().includes("permission")
            ? "Permessi camera negati. Abilita la camera nelle impostazioni del browser."
            : "Impossibile attivare la camera. Verifica i permessi.";
        setCameraError(msg);
      }
    })();

    return () => {
      mounted = false;
      scanner?.stop().catch(() => {});
      try { scanner?.clear(); } catch { /* ignore */ }
    };
  }, [handleScan]);

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
        <div className="text-sm font-semibold truncate">{venueName}</div>
        <div className="flex items-center gap-3 text-xs text-zinc-400 shrink-0">
          <span className="hidden sm:inline">{operatorName}</span>
          <Link
            href={`/staff/${venueSlug}/stats`}
            className="underline hover:text-zinc-200"
          >
            Stats
          </Link>
          <form action="/api/staff/logout" method="POST">
            <button type="submit" className="underline hover:text-zinc-200">
              Esci
            </button>
          </form>
        </div>
      </div>

      {/* Camera area */}
      <div className="flex-1 relative flex items-center justify-center bg-zinc-950">
        {cameraError ? (
          <div className="text-center px-6 space-y-2">
            <div className="text-4xl">📷</div>
            <p className="text-sm text-zinc-400">{cameraError}</p>
          </div>
        ) : (
          <div
            id={SCANNER_ELEMENT_ID}
            className="w-full h-full"
            style={{ maxHeight: "calc(100dvh - 96px)" }}
          />
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
        {state.kind === "idle" && "Inquadra un QR..."}
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
            <div className="text-3xl text-green-300 mt-2">{formatEur(tier.price)}</div>
          </div>
          <button
            onClick={onConsume}
            className="w-full py-5 bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-2xl text-2xl font-bold transition-colors"
          >
            ✓ Consegnato
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-3 text-sm text-zinc-400 hover:text-zinc-200"
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
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-green-400 border-t-transparent" />
        <div className="text-xl font-semibold">{state.tier.name}</div>
        <div className="text-zinc-400">Conferma in corso...</div>
      </div>
    );
  }

  if (state.kind === "consumed") {
    return (
      <div className="text-center space-y-4">
        <div className="text-7xl">✓</div>
        <div className="text-4xl font-black uppercase">{state.tier.name}</div>
        <div className="text-2xl text-green-300">{formatEur(state.tier.price)}</div>
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
