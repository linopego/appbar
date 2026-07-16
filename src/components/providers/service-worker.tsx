"use client";

import { useEffect } from "react";

// Registra il service worker minimale (installabilità PWA). Nessun caching
// di dati: vedi public/sw.js.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // niente SW (browser vecchio o errore): il sito funziona identico
      });
    }
  }, []);

  return null;
}
