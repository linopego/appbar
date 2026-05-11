"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  userId: string;
  initialEmail: string;
  initialName: string;
  isSelf: boolean;
}

export function AdminUserEditForm({
  userId,
  initialEmail,
  initialName,
  isSelf,
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TOTP reset
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);

  // Password reset
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [newTempPassword, setNewTempPassword] = useState<string | null>(null);
  const [pwCopied, setPwCopied] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/admin-users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string | { message?: string };
      };
      if (!res.ok || !json.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : json.error?.message ?? "Errore durante il salvataggio";
        setError(msg);
        return;
      }
      router.push("/superadmin/admin-users");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetTotp() {
    if (
      !confirm(
        "Reset TOTP: l'utente dovrà riconfigurare l'autenticazione a due fattori al prossimo accesso. Confermi?"
      )
    )
      return;
    setTotpError(null);
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
    <div className="space-y-8">
      {/* Save form */}
      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-200">
            Nome <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-200">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
            className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-white font-semibold disabled:opacity-50 transition-colors"
          >
            {loading ? "Salvataggio…" : "Salva modifiche"}
          </button>
          <Link
            href="/superadmin/admin-users"
            className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 font-medium"
          >
            Annulla
          </Link>
        </div>
      </form>

      {/* Danger zone — hidden for self */}
      {!isSelf && (
        <div className="border-t border-zinc-800 pt-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            Zona pericolosa
          </h2>

          {/* Reset TOTP */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <div>
              <p className="font-medium text-zinc-200 text-sm">Reset TOTP</p>
              <p className="text-xs text-zinc-400">
                Rimuove il segreto TOTP. L&apos;utente dovrà riconfigurare il
                2FA al prossimo accesso.
              </p>
            </div>
            {totpError && (
              <p className="text-xs text-red-400">{totpError}</p>
            )}
            <button
              type="button"
              onClick={handleResetTotp}
              disabled={totpLoading}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500 disabled:opacity-50 transition-colors"
            >
              {totpLoading ? "Reset…" : "Reset TOTP"}
            </button>
          </div>

          {/* Reset password */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <div>
              <p className="font-medium text-zinc-200 text-sm">Reset password</p>
              <p className="text-xs text-zinc-400">
                Genera una nuova password temporanea. L&apos;utente dovrà
                cambiarla al primo accesso.
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
                disabled={pwLoading}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {pwLoading ? "Reset…" : "Reset password"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
