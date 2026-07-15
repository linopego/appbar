// Feedback di pressione (BRAND.md §6-bis): le azioni AFFERMATIVE si
// illuminano di lime al tocco, quelle NEGATIVE di rosso. Unica fonte delle
// classi: componenti e varianti le compongono da qui, MAI stili copiati.

// Base comune: transizione ~150ms + leggera scala allo stato pressed.
// Con prefers-reduced-motion la scala sparisce (resta il cambio colore).
export const pressBase =
  "transition-all duration-150 active:scale-[0.97] motion-reduce:transition-colors motion-reduce:active:scale-100";

// Affermativa per elementi NON lime: lo sfondo si accende di lime pieno.
export const pressAffirmative =
  `${pressBase} active:bg-klink-lime active:text-klink-ink active:border-klink-lime`;

// Affermativa per elementi GIÀ lime: vira sul lime-hover (più intenso).
export const pressAffirmativeOnLime = `${pressBase} active:bg-klink-lime-hover`;

// Negativa: flash error-soft con testo/icona che virano sull'error.
export const pressNegative =
  `${pressBase} active:bg-klink-error-soft active:text-klink-error active:border-klink-error-soft`;
