"use client";

import { useState } from "react";

interface RefundWindow {
  day: number;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function timeToStr(h: number, m: number) {
  return `${pad(h)}:${pad(m)}`;
}

function strToTime(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

interface Props {
  initialWindows: RefundWindow[];
  initialTimezone: string;
  timezoneOptions: string[];
}

export function RefundWindowsEditor({ initialWindows, initialTimezone, timezoneOptions }: Props) {
  const [windows, setWindows] = useState<RefundWindow[]>(initialWindows);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addWindow() {
    setWindows((prev) => [...prev, { day: 5, startHour: 22, startMin: 0, endHour: 6, endMin: 0 }]);
  }

  function removeWindow(i: number) {
    setWindows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateWindow(i: number, field: keyof RefundWindow, value: number | string) {
    setWindows((prev) => {
      const next = [...prev];
      if (field === "startHour" || field === "startMin" || field === "endHour" || field === "endMin") {
        const t = strToTime(value as string);
        if (field === "startHour") next[i] = { ...next[i]!, startHour: t.h, startMin: t.m };
        if (field === "endHour") next[i] = { ...next[i]!, endHour: t.h, endMin: t.m };
      } else {
        next[i] = { ...next[i]!, [field]: value as number };
      }
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/venue/refund-windows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windows, timezone }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Errore durante il salvataggio");
        return;
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Timezone */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-900">Fuso orario</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
        >
          {timezoneOptions.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      {/* Windows list */}
      <div className="space-y-3">
        {windows.map((w, i) => (
          <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
            <div className="space-y-0.5">
              <p className="text-xs text-zinc-400">Giorno</p>
              <select
                value={w.day}
                onChange={(e) => updateWindow(i, "day", parseInt(e.target.value, 10))}
                className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                {DAY_LABELS.map((label, d) => (
                  <option key={d} value={d}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-0.5">
              <p className="text-xs text-zinc-400">Inizio</p>
              <input
                type="time"
                value={timeToStr(w.startHour, w.startMin)}
                onChange={(e) => updateWindow(i, "startHour", e.target.value)}
                className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>

            <div className="space-y-0.5">
              <p className="text-xs text-zinc-400">Fine</p>
              <input
                type="time"
                value={timeToStr(w.endHour, w.endMin)}
                onChange={(e) => updateWindow(i, "endHour", e.target.value)}
                className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
            </div>

            <button
              onClick={() => removeWindow(i)}
              className="text-red-500 hover:text-red-700 text-sm px-2 py-1 rounded-lg hover:bg-red-50 transition-colors mt-3 sm:mt-0"
              title="Rimuovi"
            >
              Rimuovi
            </button>
          </div>
        ))}

        {windows.length === 0 && (
          <p className="text-sm text-zinc-400 py-2">Nessuna finestra di blocco configurata. I rimborsi sono sempre disponibili.</p>
        )}
      </div>

      <button
        onClick={addWindow}
        className="text-sm px-4 py-2 rounded-lg border-2 border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors w-full"
      >
        + Aggiungi finestra
      </button>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">✓ Impostazioni salvate</p>}

      <p className="text-xs text-zinc-400">
        Le finestre cross-mezzanotte (es. 22:00–06:00) bloccano le richieste dal giorno indicato fino all&apos;ora di fine del giorno successivo.
      </p>

      <button
        onClick={handleSave}
        disabled={loading}
        className="px-6 py-3 rounded-xl bg-zinc-900 text-white font-semibold hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Salvataggio…" : "Salva impostazioni"}
      </button>
    </div>
  );
}
