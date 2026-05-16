import { auth } from "@/lib/auth";
import Sidebar from "@/components/admin/Sidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    return <>{children}</>;
  }

  const user = session.user as any;

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar userName={user.name ?? ""} userRole={user.role ?? "AUTHOR"} />
        <div className="flex flex-col flex-1 ml-64 min-w-0">
          <AdminHeader userName={user.name ?? ""} />
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
          <Toaster position="top-right" richColors />
        </div>
      </div>
    </SessionProvider>
  );
}
