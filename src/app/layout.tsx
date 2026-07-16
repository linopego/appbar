import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/session-provider";
import { PressFeedbackListener } from "@/components/providers/press-feedback";
import { ServiceWorkerRegistration } from "@/components/providers/service-worker";
import { BRAND_NAME, BRAND_TAGLINE, BRAND_THEME_COLOR } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s — ${BRAND_NAME}`,
  },
  description: BRAND_TAGLINE,
  // PWA su iOS (l'apple-touch-icon è già servita da src/app/apple-icon.png)
  appleWebApp: {
    capable: true,
    title: BRAND_NAME,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND_THEME_COLOR,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={`${inter.variable} ${sora.variable} antialiased`}>
        <SessionProvider>{children}</SessionProvider>
        <PressFeedbackListener />
        <ServiceWorkerRegistration />
        <Toaster richColors />
      </body>
    </html>
  );
}
