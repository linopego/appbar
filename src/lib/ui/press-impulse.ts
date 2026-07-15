// Feedback di pressione v2 (BRAND.md §6-bis): al pointerdown parte un
// impulso che si completa da solo (~400ms), visibile anche su tap veloci.
// Onda che si espande dal punto di tocco: lime sulle azioni affermative,
// error-soft con bordo error sulle negative. Con prefers-reduced-motion
// niente onda: solo un cambio colore netto di ~200ms.
//
// L'attivazione è delegata: PressFeedbackListener (montato una volta nel
// layout) osserva i pointerdown e chiama spawnPressImpulse sugli elementi
// con l'attributo data-press. Le classi host vivono in src/lib/ui/press.ts.

import type { PressKind } from "@/lib/ui/press";

export const RIPPLE_DURATION_MS = 400;
export const FLASH_DURATION_MS = 200;

export interface RippleGeometry {
  size: number;
  left: number;
  top: number;
}

// Geometria dell'onda: cerchio centrato sul punto di tocco, grande abbastanza
// da coprire l'intero elemento da qualunque angolo parta (pura, testabile).
export function rippleGeometry(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number
): RippleGeometry {
  // Raggio = diagonale dell'elemento: copre l'angolo opposto anche toccando
  // un vertice (max(w,h) non basterebbe sugli elementi larghi E alti)
  const size = Math.hypot(rect.width, rect.height) * 2;
  return {
    size,
    left: clientX - rect.left - size / 2,
    top: clientY - rect.top - size / 2,
  };
}

function flash(host: HTMLElement, kind: PressKind) {
  const cls = `klink-press-flash-${kind}`;
  // Riavvio anche su tap consecutivi: rimuovi, forza reflow, riapplica
  host.classList.remove(cls);
  void host.offsetWidth;
  host.classList.add(cls);
  window.setTimeout(() => host.classList.remove(cls), FLASH_DURATION_MS + 50);
}

export function spawnPressImpulse(host: HTMLElement, clientX: number, clientY: number) {
  const kind = (host.dataset["press"] ?? "affirmative") as PressKind;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    flash(host, kind);
    return;
  }

  const { size, left, top } = rippleGeometry(host.getBoundingClientRect(), clientX, clientY);
  const ripple = document.createElement("span");
  ripple.className = "klink-ripple";
  ripple.dataset["kind"] = kind;
  ripple.setAttribute("aria-hidden", "true");
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${left}px`;
  ripple.style.top = `${top}px`;
  // L'onda si rimuove da sola: tap ripetuti generano onde consecutive senza
  // bloccare i click (pointer-events: none in CSS).
  ripple.addEventListener("animationend", () => ripple.remove());
  window.setTimeout(() => ripple.remove(), RIPPLE_DURATION_MS + 100);
  host.appendChild(ripple);
}
