export function StripeStatusBadge({
  hasAccount,
  chargesEnabled,
}: {
  hasAccount: boolean;
  chargesEnabled: boolean;
}) {
  if (chargesEnabled) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-green-900/50 text-green-400">
        Pagamenti attivi
      </span>
    );
  }
  if (hasAccount) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-yellow-900/50 text-yellow-400">
        Onboarding incompleto
      </span>
    );
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-400">
      Non configurato
    </span>
  );
}
