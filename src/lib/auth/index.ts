import NextAuth from "next-auth";
import { authConfig } from "./config";

// Sanitizza NEXTAUTH_URL prima che NextAuth la legga — previene crash in build
// se l'env var contiene caratteri extra (es. angle brackets da copia/incolla).
if (process.env.NEXTAUTH_URL) {
  const raw = process.env.NEXTAUTH_URL.replace(/[<>"\s]/g, "").replace(/^https?:\/\/https?:\/\//, "https://");
  process.env.NEXTAUTH_URL = raw;
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
