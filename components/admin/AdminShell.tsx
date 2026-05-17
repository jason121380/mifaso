"use client";

import { useState, useEffect } from "react";
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
  const [open, setOpen] = useState(false); // 手機：滑出選單
  const [collapsed, setCollapsed] = useState(false); // 桌機：收合左側選單

  useEffect(() => {
    setCollapsed(localStorage.getItem("admin:sidebar-collapsed") === "1");
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("admin:sidebar-collapsed", next ? "1" : "0");
      return next;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        userName={userName}
        userRole={userRole}
        open={open}
        collapsed={collapsed}
        onClose={() => setOpen(false)}
      />

      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <div
        className={`${
          collapsed ? "md:ml-0" : "md:ml-64"
        } flex min-h-screen flex-col min-w-0 transition-[margin] duration-200 ease-out`}
      >
        <AdminHeader
          onMenu={() => setOpen(true)}
          onToggleCollapse={toggleCollapsed}
          collapsed={collapsed}
        />
        <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
        <Toaster position="top-right" richColors />
      </div>
    </div>
  );
}
