"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Menu } from "lucide-react";

const breadcrumbMap: Record<string, string> = {
  dashboard: "總覽",
  articles: "文章管理",
  categories: "分類管理",
  tags: "標籤管理",
  media: "媒體庫",
  users: "用戶管理",
  new: "新增文章",
};

export default function AdminHeader({ userName, onMenu }: { userName: string; onMenu?: () => void }) {
  const pathname = usePathname();
  const segments = pathname.replace("/admin/", "").split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => ({
    label: breadcrumbMap[seg] ?? (seg.length === 25 ? "編輯文章" : seg),
    href: "/admin/" + segments.slice(0, i + 1).join("/"),
  }));

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-8 flex-shrink-0 sticky top-0 z-20">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm min-w-0 overflow-x-auto">
        <button
          type="button"
          onClick={onMenu}
          aria-label="開啟選單"
          className="md:hidden text-gray-600 hover:text-gray-900 mr-1 flex-shrink-0"
        >
          <Menu size={20} />
        </button>
        <Link href="/admin/dashboard" className="text-gray-400 hover:text-gray-700 transition-colors">
          後台
        </Link>
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            <ChevronRight size={12} className="text-gray-300" />
            {i === crumbs.length - 1 ? (
              <span className="text-gray-900 font-medium">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-gray-400 hover:text-gray-700 transition-colors">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/articles/new"
          className="hidden md:flex items-center gap-1.5 bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-rose-brand transition-colors"
        >
          <span className="text-base leading-none">+</span>
          新增文章
        </Link>
        <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-semibold">
          {userName?.[0]?.toUpperCase() ?? "A"}
        </div>
      </div>
    </header>
  );
}
