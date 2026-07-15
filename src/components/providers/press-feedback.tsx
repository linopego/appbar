"use client";

import { useEffect } from "react";
import { spawnPressImpulse } from "@/lib/ui/press-impulse";

// Listener globale del feedback di pressione (BRAND.md §6-bis): un solo
// pointerdown delegato per tutta l'app. Gli elementi che vogliono l'impulso
// dichiarano data-press="affirmative | affirmative-on-lime | negative"
// (il Button condiviso lo fa da solo in base alla variante).
export function PressFeedbackListener() {
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!(event.target instanceof Element)) return;
      const host = event.target.closest<HTMLElement>("[data-press]");
      if (!host) return;
      if (host.matches(":disabled, [aria-disabled='true']")) return;
      spawnPressImpulse(host, event.clientX, event.clientY);
    }
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return null;
}
