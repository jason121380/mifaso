import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl, auth: session } = req;

  // Not logged in → redirect to login
  if (!session) {
    return NextResponse.redirect(
      new URL(`/admin/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, req.url)
    );
  }
});

export const config = {
  // Match all /admin routes EXCEPT /admin/login to avoid redirect loops
  matcher: ["/admin/((?!login$).*)"],
};
