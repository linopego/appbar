import type { MetadataRoute } from "next";

// Web App Manifest (PWA): Klink installabile sulla schermata Home.
// Colori dal brand: theme Ink, background grigio freddo (--klink-bg).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Klink",
    short_name: "Klink",
    description: "Compri i drink prima, li ritiri con un QR.",
    start_url: "/home",
    display: "standalone",
    theme_color: "#0F1230",
    background_color: "#F5F6F8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
