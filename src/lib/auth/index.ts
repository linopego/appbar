import NextAuth from "next-auth";

// Provider configuration aggiunta nel prossimo prompt
export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [],
});
