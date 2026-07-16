"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveSnapshot } from "@/lib/reports/live-data";
import { formatEur } from "@/lib/utils/money";

// Dashboard "Serata live": pensata per restare aperta ore su telefono/tablet.
// Polling ogni 20 secondi (mai più frequente: costi serverless), in pausa a
// scheda nascosta, refetch immediato quando torna visibile. Wake lock
// opzionale come nel POS. Barre orarie in puro CSS: niente librerie chart.

const POLL_INTERVAL_MS = 20_000;

const THEMES = {
  light: {
    card: "rounded-xl border border-zinc-200 bg-white",
    kpiLabel: "text-xs uppercase tracking-wide text-zinc-500",
    kpiValue: "text-4xl font-bold text-zinc-900 tabular-nums",
    kpiSub: "text-xs text-zinc-500",
    title: "text-sm font-semibold text-zinc-900",
    row: "text-sm text-zinc-700",
    muted: "text-xs text-zinc-500",
    divide: "divide-y divide-zinc-100",
    barTrack: "bg-zinc-100",
    error: "text-red-600",
    toggleOff: "border border-zinc-300 text-zinc-600 hover:bg-zinc-50",
  },
  dark: {
    card: "rounded-xl border border-zinc-800 bg-zinc-900",
    kpiLabel: "text-xs uppercase tracking-wide text-zinc-500",
    kpiValue: "text-4xl font-bold text-zinc-100 tabular-nums",
    kpiSub: "text-xs text-zinc-500",
    title: "text-sm font-semibold text-zinc-100",
    row: "text-sm text-zinc-300",
    muted: "text-xs text-zinc-500",
    divide: "divide-y divide-zinc-800",
    barTrack: "bg-zinc-800",
    error: "text-red-400",
    toggleOff: "border border-zinc-700 text-zinc-400 hover:bg-zinc-800",
  },
} as const;

type Theme = keyof typeof THEMES;

export function LiveDashboard({ endpoint, theme }: { endpoint: string; theme: Theme }) {
  const t = THEMES[theme];
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [keepAwake, setKeepAwake] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; data?: LiveSnapshot; error?: string };
      if (!res.ok || !data.ok || !data.data) {
        setError(typeof data.error === "string" ? data.error : "Errore nel caricamento.");
        return;
      }
      setSnapshot(data.data);
      setUpdatedAt(new Date());
      setError(null);
    } catch {
      setError("Errore di rete: riprovo tra poco.");
    } finally {
      inFlight.current = false;
    }
  }, [endpoint]);

  // Polling: ogni 20s, in pausa quando la scheda è nascosta. Il primo fetch
  // è deferito a un tick per non fare setState sincrono nell'effect.
  useEffect(() => {
    const initial = window.setTimeout(load, 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) load();
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Wake lock opzionale (stesso pattern del POS): schermo acceso se attivato
  useEffect(() => {
    if (!keepAwake) return;
    let wakeLock: WakeLockSentinel | null = null;
    async function acquireLock() {
      if ("wakeLock" in navigator) {
        try {
          wakeLock = await navigator.wakeLock.request("screen");
        } catch {
          // non supportato o negato: pazienza
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
  }, [keepAwake]);

  if (!snapshot) {
    return (
      <div className={`${t.card} p-8 text-center`}>
        <p className={t.row}>{error ?? "Caricamento della serata…"}</p>
      </div>
    );
  }

  const maxHourCount = Math.max(1, ...snapshot.hourly.map((b) => b.count));

  return (
    <div className="space-y-4">
      {/* Barra di stato: serata, aggiornamento, wake lock */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={t.muted}>
          Serata del {snapshot.day.key} — dalle 06:00 alle 06:00 (ora italiana)
        </p>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className={`${t.muted} tabular-nums`}>
              Aggiornato alle {updatedAt.toLocaleTimeString("it-IT")}
            </span>
          )}
          <button
            type="button"
            onClick={() => setKeepAwake((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              keepAwake ? "bg-klink-lime text-klink-ink" : t.toggleOff
            }`}
          >
            {keepAwake ? "✓ Schermo sempre acceso" : "Tieni acceso lo schermo"}
          </button>
        </div>
      </div>

      {error && <p className={`text-sm ${t.error}`}>{error}</p>}

      {/* KPI grandi, leggibili da lontano */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`${t.card} p-5`}>
          <p className={t.kpiLabel}>Venduto stasera</p>
          <p className={`${t.kpiValue} mt-1`}>{formatEur(snapshot.kpi.soldTotal)}</p>
          <p className={`${t.kpiSub} mt-1`}>
            {snapshot.kpi.soldOrders} {snapshot.kpi.soldOrders === 1 ? "ordine" : "ordini"}
          </p>
        </div>
        <div className={`${t.card} p-5`}>
          <p className={t.kpiLabel}>Consumato stasera</p>
          <p className={`${t.kpiValue} mt-1`}>{snapshot.kpi.consumedCount}</p>
          <p className={`${t.kpiSub} mt-1`}>ticket scansionati al banco</p>
        </div>
        <div className={`${t.card} p-5`}>
          <p className={t.kpiLabel}>In circolazione</p>
          <p className={`${t.kpiValue} mt-1`}>{snapshot.kpi.activeCirculating}</p>
          <p className={`${t.kpiSub} mt-1`}>
            ticket attivi non scaduti (totale locale): consumazioni ancora dovute
          </p>
        </div>
      </div>

      {/* Per fascia: venduti / consumati stasera */}
      <section className={`${t.card} p-4 space-y-3`}>
        <h2 className={t.title}>Per fascia — stasera</h2>
        {snapshot.tiers.length === 0 ? (
          <p className={t.muted}>Ancora nessun movimento stasera.</p>
        ) : (
          <ul className={t.divide}>
            <li className={`grid grid-cols-[1fr_auto_auto] gap-x-4 py-1.5 ${t.muted}`}>
              <span>Fascia</span>
              <span className="text-right w-28">Venduti</span>
              <span className="text-right w-28">Consumati</span>
            </li>
            {snapshot.tiers.map((row) => (
              <li
                key={`${row.tierName}|${row.unitPrice}`}
                className={`grid grid-cols-[1fr_auto_auto] gap-x-4 py-2 ${t.row}`}
              >
                <span className="min-w-0 truncate">
                  {row.tierName}{" "}
                  <span className={t.muted}>({formatEur(row.unitPrice)})</span>
                </span>
                <span className="text-right w-28 tabular-nums">
                  {row.soldQuantity} · {formatEur(row.soldTotal)}
                </span>
                <span className="text-right w-28 tabular-nums">
                  {row.consumedQuantity} · {formatEur(row.consumedTotal)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Andamento orario: barre pure CSS, dalle 06 alle 05 */}
      <section className={`${t.card} p-4 space-y-3`}>
        <h2 className={t.title}>Consumazioni per ora</h2>
        <div className="flex items-end gap-1 h-32" role="img" aria-label="Consumazioni per ora della serata">
          {snapshot.hourly.map((bucket) => (
            <div key={bucket.hour} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className={`w-full rounded-t ${t.barTrack} relative h-full flex items-end`}>
                <div
                  className="w-full rounded-t bg-klink-lime"
                  style={{ height: `${Math.round((bucket.count / maxHourCount) * 100)}%` }}
                  title={`${bucket.hour}:00 — ${bucket.count}`}
                />
              </div>
              <span className={`${t.muted} tabular-nums ${Number(bucket.hour) % 3 === 0 ? "" : "invisible"}`}>
                {bucket.hour}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Feed ultimi eventi: mai dati personali dei clienti */}
      <section className={`${t.card} p-4 space-y-3`}>
        <h2 className={t.title}>Ultimi eventi</h2>
        {snapshot.feed.length === 0 ? (
          <p className={t.muted}>Ancora nessun evento stasera.</p>
        ) : (
          <ul className={t.divide}>
            {snapshot.feed.map((event, i) => (
              <li key={`${event.at}-${i}`} className={`flex items-center gap-3 py-2 ${t.row}`}>
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    event.kind === "sale" ? "bg-klink-lime" : "bg-klink-info"
                  }`}
                />
                <span className="min-w-0 truncate flex-1">
                  {event.text}
                  {event.sub && <span className={t.muted}> — {event.sub}</span>}
                </span>
                <span className={`${t.muted} tabular-nums shrink-0`}>{event.time}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
