"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Tag,
  ImageIcon,
  Users,
  LogOut,
  ExternalLink,
  ChevronRight,
  X,
  BarChart3,
} from "lucide-react";

const navItems = [
  { href: "/admin/dashboard", label: "總覽", icon: LayoutDashboard },
  { href: "/admin/articles", label: "文章管理", icon: FileText },
  { href: "/admin/categories", label: "分類管理", icon: FolderOpen },
  { href: "/admin/tags", label: "標籤管理", icon: Tag },
  { href: "/admin/media", label: "媒體庫", icon: ImageIcon },
  { href: "/admin/analytics", label: "流量分析", icon: BarChart3 },
  { href: "/admin/users", label: "用戶管理", icon: Users },
];

const ROLE_MAP: Record<string, string> = {
  ADMIN: "管理員",
  EDITOR: "編輯",
  AUTHOR: "作者",
};

interface SidebarProps {
  userName: string;
  userRole: string;
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ userName, userRole, open = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen w-64 bg-white flex flex-col z-40 border-r border-gray-100 transform transition-transform duration-200 ease-out md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <Link href="/" target="_blank" className="flex items-center">
            <Image src="/logo.png" alt="mifaso 迷髮所" width={120} height={48} className="h-10 w-auto object-contain" priority />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" target="_blank" className="text-gray-300 hover:text-gray-500 transition-colors">
              <ExternalLink size={14} />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="關閉選單"
              className="md:hidden text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2">主選單</p>
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                  isActive
                    ? "bg-rose-brand text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon
                  size={16}
                  className={cn(
                    "flex-shrink-0 transition-colors",
                    isActive ? "text-amber-400" : "text-gray-400 group-hover:text-gray-600"
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight size={12} className="text-gray-400" />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 mb-2">
          <div className="w-8 h-8 rounded-full bg-rose-brand flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {userName?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-gray-400">{ROLE_MAP[userRole] ?? userRole}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
        >
          <LogOut size={15} />
          <span>登出</span>
        </button>
      </div>
    </aside>
  );
}
