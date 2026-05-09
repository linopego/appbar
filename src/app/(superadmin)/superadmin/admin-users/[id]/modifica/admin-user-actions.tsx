"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  userId: string;
  active: boolean;
  isSelf: boolean;
}

export function AdminUserActions({ userId, active, isSelf }: Props) {
  const router = useRouter();

  // Toggle active
  const [toggleLoading, setToggleLoading] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Reset TOTP
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpDone, setTotpDone] = useState(false);

  // Reset password
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [newTempPassword, setNewTempPassword] = useState<string | null>(null);
  const [pwCopied, setPwCopied] = useState(false);

  async function handleToggleActive() {
    const label = active ? "disattivare" : "attivare";
    if (!confirm(`Vuoi ${label} questo account admin?`)) return;
    setToggleError(null);
    setToggleLoading(true);
    try {
      const res = await fetch(
        `/api/superadmin/admin-users/${userId}/toggle-active`,
        { method: "POST" }
      );
      const json = (await res.json()) as {
        ok: boolean;
        error?: string | { message?: string };
      };
      if (!res.ok || !json.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : json.error?.message ?? "Errore durante l'operazione";
        setToggleError(msg);
        return;
      }
      router.refresh();
    } catch {
      setToggleError("Errore di rete. Riprova.");
    } finally {
      setToggleLoading(false);
    }
  }

  async function handleResetTotp() {
    if (
      !confirm(
        "Reset TOTP: l'utente dovrà riconfigurare il 2FA al prossimo accesso. Confermi?"
      )
    )
      return;
    setTotpError(null);
    setTotpDone(false);
    setTotpLoading(true);
    try {
      const res = await fetch(
        `/api/superadmin/admin-users/${userId}/reset-totp`,
        { method: "POST" }
      );
      const json = (await res.json()) as {
        ok: boolean;
        error?: string | { message?: string };
      };
      if (!res.ok || !json.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : json.error?.message ?? "Errore durante il reset TOTP";
        setTotpError(msg);
        return;
      }
      setTotpDone(true);
      router.refresh();
    } catch {
      setTotpError("Errore di rete. Riprova.");
    } finally {
      setTotpLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!confirm("Genera una nuova password temporanea per questo admin?")) return;
    setPwError(null);
    setPwLoading(true);
    try {
      const res = await fetch(
        `/api/superadmin/admin-users/${userId}/reset-password`,
        { method: "POST" }
      );
      const json = (await res.json()) as {
        ok: boolean;
        data?: { temporaryPassword?: string };
        error?: string | { message?: string };
      };
      if (!res.ok || !json.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : json.error?.message ?? "Errore durante il reset password";
        setPwError(msg);
        return;
      }
      setNewTempPassword(json.data?.temporaryPassword ?? "");
    } catch {
      setPwError("Errore di rete. Riprova.");
    } finally {
      setPwLoading(false);
    }
  }

  async function handleCopyPw() {
    if (!newTempPassword) return;
    await navigator.clipboard.writeText(newTempPassword);
    setPwCopied(true);
    setTimeout(() => setPwCopied(false), 2000);
  }

  return (
    <div className="border-t border-zinc-800 pt-6 space-y-4">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
        Azioni account
      </h2>

      {/* Toggle active */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <div>
          <p className="font-medium text-zinc-200 text-sm">
            {active ? "Disattiva account" : "Attiva account"}
          </p>
          <p className="text-xs text-zinc-400">
            {active
              ? "L'utente non potrà più accedere al pannello."
              : "Ripristina l'accesso per questo admin."}
          </p>
        </div>
        {toggleError && (
          <p className="text-xs text-red-400">{toggleError}</p>
        )}
        <button
          type="button"
          onClick={handleToggleActive}
          disabled={toggleLoading || isSelf}
          className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${
            active
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-green-700 hover:bg-green-600 text-white"
          }`}
        >
          {toggleLoading
            ? "Aggiornamento…"
            : active
            ? "Disattiva"
            : "Attiva"}
        </button>
        {isSelf && (
          <p className="text-xs text-zinc-500">
            Non puoi modificare il tuo stesso account.
          </p>
        )}
      </div>

      {/* Reset TOTP */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <div>
          <p className="font-medium text-zinc-200 text-sm">Reset TOTP</p>
          <p className="text-xs text-zinc-400">
            Rimuove il segreto TOTP. L&apos;utente dovrà riconfigurare il 2FA
            al prossimo accesso.
          </p>
        </div>
        {totpError && <p className="text-xs text-red-400">{totpError}</p>}
        {totpDone && (
          <p className="text-xs text-green-400">TOTP resettato con successo.</p>
        )}
        <button
          type="button"
          onClick={handleResetTotp}
          disabled={totpLoading || isSelf}
          className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500 disabled:opacity-50 transition-colors"
        >
          {totpLoading ? "Reset…" : "Reset TOTP"}
        </button>
        {isSelf && (
          <p className="text-xs text-zinc-500">
            Non puoi resettare il TOTP del tuo stesso account.
          </p>
        )}
      </div>

      {/* Reset password */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <div>
          <p className="font-medium text-zinc-200 text-sm">Reset password</p>
          <p className="text-xs text-zinc-400">
            Genera una nuova password temporanea. L&apos;utente dovrà cambiarla
            al primo accesso.
          </p>
        </div>
        {pwError && <p className="text-xs text-red-400">{pwError}</p>}
        {newTempPassword !== null ? (
          <div className="space-y-2">
            <p className="text-xs text-amber-400 bg-amber-900/30 border border-amber-800 rounded-lg px-3 py-2">
              Salva questa password subito — non sarà più visibile.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 break-all select-all">
                {newTempPassword}
              </code>
              <button
                type="button"
                onClick={handleCopyPw}
                className="shrink-0 px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm transition-colors"
              >
                {pwCopied ? "Copiato!" : "Copia"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={pwLoading || isSelf}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {pwLoading ? "Reset…" : "Reset password"}
          </button>
        )}
        {isSelf && (
          <p className="text-xs text-zinc-500">
            Non puoi resettare la password del tuo stesso account.
          </p>
        )}
      </div>
    </div>
  );
}
