import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cambio password" };

// Cambio password del manager (obbligatorio dopo una password temporanea).
// La sessione MANAGER è garantita dal middleware su /admin/*.
export default function CambioPasswordPage() {
  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Imposta la tua password</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Stai usando una password temporanea: scegline una nuova per continuare.
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
