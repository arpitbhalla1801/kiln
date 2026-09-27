import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({ credentials: { email: {}, password: {} }, authorize: async (creds) => (creds?.email === process.env.AUTH_DEMO_EMAIL && creds?.password === process.env.AUTH_DEMO_PASSWORD) ? { id: "1", email: String(creds.email) } : null }),
  ],
});
