"use client";

import { useState } from "react";
import { Toaster } from "sonner";
import Sidebar from "./Sidebar";
import AdminHeader from "./AdminHeader";

export default function AdminShell({
  userName,
  userRole,
  children,
}: {
  userName: string;
  userRole: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        userName={userName}
        userRole={userRole}
        open={open}
        onClose={() => setOpen(false)}
      />

      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <div className="md:ml-64 flex min-h-screen flex-col min-w-0">
        <AdminHeader userName={userName} onMenu={() => setOpen(true)} />
        <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
        <Toaster position="top-right" richColors />
      </div>
    </div>
  );
}
