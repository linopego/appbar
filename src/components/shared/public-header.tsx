import Link from "next/link";
import { auth } from "@/lib/auth";
import { KlinkLogo } from "@/components/brand/logo";
import { PublicHeaderActions } from "./public-header-actions";

// Header globale dell'area pubblica: da ogni pagina un cliente loggato
// raggiunge i propri ticket in due tap (menu → I miei ticket).
// POS, admin e superadmin hanno i loro header: questo non li tocca.
export async function PublicHeader() {
  const session = await auth();
  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
      }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-sm">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-foreground hover:opacity-80 transition-opacity" aria-label="Klink — home">
          <KlinkLogo variant="lockup" size={26} />
        </Link>
        <PublicHeaderActions user={user} />
      </div>
    </header>
  );
}
