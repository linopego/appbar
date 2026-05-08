import { NextResponse, type NextRequest } from "next/server";

// Auth.js database strategy non è validabile in Edge runtime (richiede l'adapter
// Prisma che è Node-only). Qui facciamo una verifica leggera della presenza del
// cookie di sessione; la validazione reale avviene in page/layout server-side
// tramite `auth()` (Node runtime).

const PROTECTED_CLIENT_ROUTES = ["/profilo"];

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSessionCookie = SESSION_COOKIE_NAMES.some(
    (name) => !!req.cookies.get(name)?.value
  );

  if (PROTECTED_CLIENT_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!hasSessionCookie) {
      const loginUrl = new URL("/login", req.nextUrl);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
