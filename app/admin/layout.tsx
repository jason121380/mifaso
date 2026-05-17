import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: { absolute: "MIFASO 後台" },
  manifest: "/admin/manifest.webmanifest",
  icons: {
    icon: "/admin-icon.png",
    shortcut: "/admin-icon.png",
    apple: "/admin-apple-icon.png",
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    return <>{children}</>;
  }

  const user = session.user as any;

  return (
    <SessionProvider session={session}>
      <AdminShell userName={user.name ?? ""} userRole={user.role ?? "AUTHOR"}>
        {children}
      </AdminShell>
    </SessionProvider>
  );
}
