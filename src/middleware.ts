import { NextResponse, type NextRequest } from "next/server";
import { verifyStaffToken, STAFF_COOKIE_NAME } from "@/lib/auth/staff-edge";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth/admin-edge";

const NEXTAUTH_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

const PROTECTED_CUSTOMER_ROUTES = ["/profilo", "/ordine"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // === Rotte admin manager (/admin/*) ===
  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get(STAFF_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    const payload = await verifyStaffToken(token);
    if (!payload || payload.role !== "MANAGER") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // === Rotte super-admin ===
  if (pathname.startsWith("/superadmin")) {
    if (pathname === "/superadmin/login") return NextResponse.next();

    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/superadmin/login", req.url));
    }
    const payload = await verifyAdminToken(token);
    if (!payload) {
      const res = NextResponse.redirect(new URL("/superadmin/login", req.url));
      res.cookies.delete(ADMIN_COOKIE_NAME);
      return res;
    }
    return NextResponse.next();
  }

  // === Rotte staff ===
  if (pathname.startsWith("/staff/")) {
    const venueSlug = pathname.split("/")[2];
    if (!venueSlug) return NextResponse.next();

    // La pagina di login PIN (`/staff/[slug]`) è pubblica
    if (pathname === `/staff/${venueSlug}`) return NextResponse.next();

    const token = req.cookies.get(STAFF_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL(`/staff/${venueSlug}`, req.url));
    }
    const payload = await verifyStaffToken(token);
    if (!payload || payload.venueSlug !== venueSlug) {
      const res = NextResponse.redirect(new URL(`/staff/${venueSlug}`, req.url));
      res.cookies.delete(STAFF_COOKIE_NAME);
      return res;
    }
    return NextResponse.next();
  }

  // === Rotte cliente protette ===
  // Cookie-presence check (validazione reale via auth() server-side nelle pagine)
  if (PROTECTED_CUSTOMER_ROUTES.some((r) => pathname.startsWith(r))) {
    const hasNextAuthCookie = NEXTAUTH_COOKIE_NAMES.some(
      (name) => !!req.cookies.get(name)?.value
    );
    if (!hasNextAuthCookie) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/staff/:path*",
    "/superadmin/:path*",
    "/profilo/:path*",
    "/ordine/:path*",
  ],
};
