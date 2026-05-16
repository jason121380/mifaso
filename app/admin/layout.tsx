import { auth } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";
import { SessionProvider } from "next-auth/react";

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
