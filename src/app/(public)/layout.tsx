import type { ReactNode } from "react";
import { PublicHeader } from "@/components/shared/public-header";
import { PublicFooter } from "@/components/shared/public-footer";

// Layout dell'area pubblica/cliente: header globale e footer con i link
// legali su tutte le pagine.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
      <PublicFooter />
    </>
  );
}
