// Feedback di pressione v2 (BRAND.md §6-bis): al pointerdown parte un impulso
// che SI COMPLETA SEMPRE (~400ms) — onda dal punto di tocco, lime sulle azioni
// affermative, error-soft con bordo error sulle negative — così anche un tap
// velocissimo produce un feedback visibile. L'onda è innescata dal listener
// globale (PressFeedbackListener) sugli elementi con data-press; qui vivono le
// classi host. Unica fonte: componenti e varianti compongono da qui, MAI
// stili copiati.
//
// Le classi restano complementari all'onda: scala 0.97 e colore mentre il
// dito è giù (utile sulle pressioni lunghe). Con prefers-reduced-motion
// niente onda né scala: il listener applica un cambio colore netto (~200ms).

// Tipo dell'attributo data-press letto dal listener globale.
export type PressKind = "affirmative" | "affirmative-on-lime" | "negative";

// Base comune: host dell'onda (position relative + overflow hidden, così
// border-radius è rispettato) + transizione ~150ms + leggera scala pressed.
export const pressBase =
  "klink-press-host transition-all duration-150 active:scale-[0.97] motion-reduce:transition-colors motion-reduce:active:scale-100";

// Affermativa per elementi NON lime: onda lime; tenuto premuto, lime pieno.
export const pressAffirmative =
  `${pressBase} active:bg-klink-lime active:text-klink-ink active:border-klink-lime`;

// Affermativa per elementi GIÀ lime: onda e pressed sul lime-hover.
export const pressAffirmativeOnLime = `${pressBase} active:bg-klink-lime-hover`;

// Negativa: onda error-soft bordata error; tenuto premuto, flash error-soft.
export const pressNegative =
  `${pressBase} active:bg-klink-error-soft active:text-klink-error active:border-klink-error-soft`;

// Attributo per gli elementi che compongono le classi a mano (card, stepper
// custom): <div className={pressAffirmative} {...pressAttrs("affirmative")}>
export function pressAttrs(kind: PressKind): { "data-press": PressKind } {
  return { "data-press": kind };
}
