import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no Prisma, no bcrypt. Shared by middleware (Edge runtime)
// and the full Node-runtime auth instance in lib/auth.ts.
export const authConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
