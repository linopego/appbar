import type { ReactNode } from "react";
import { PublicHeader } from "@/components/shared/public-header";

// Layout dell'area pubblica/cliente: header globale su tutte le pagine.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}
