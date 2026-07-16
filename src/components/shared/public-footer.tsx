import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

// Footer comune dell'area pubblica: link legali sempre raggiungibili.
export function PublicFooter() {
  return (
    <footer className="border-t py-6 bg-background">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} {BRAND_NAME}
        </p>
        <nav className="flex items-center gap-5">
          <Link href="/accesso-staff" className="hover:text-foreground transition-colors">
            Area staff
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/termini" className="hover:text-foreground transition-colors">
            Termini
          </Link>
        </nav>
      </div>
    </footer>
  );
}
