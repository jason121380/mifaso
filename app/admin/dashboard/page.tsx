import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  FileText, TrendingUp, Eye, Clock, ArrowRight,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PUBLISHED: { label: "已發布", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  DRAFT:     { label: "草稿",   className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  ARCHIVED:  { label: "已封存", className: "bg-gray-100 text-gray-500 ring-1 ring-gray-200" },
};

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user as any;
  const isAdmin = user.role === "ADMIN" || user.role === "EDITOR";
  const authorFilter = user.role === "AUTHOR" ? { authorId: user.id } : {};

  const [totalPublished, totalDraft, totalViews, totalCategories, totalUsers, recentArticles, topArticles] =
    await Promise.all([
      prisma.article.count({ where: { status: "PUBLISHED", ...authorFilter } }),
      prisma.article.count({ where: { status: "DRAFT", ...authorFilter } }),
      prisma.article.aggregate({ where: { status: "PUBLISHED", ...authorFilter }, _sum: { viewCount: true } }),
      prisma.category.count(),
      isAdmin ? prisma.user.count() : Promise.resolve(0),
      prisma.article.findMany({
        where: authorFilter,
        include: { author: { select: { name: true } }, category: true },
        orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
        take: 6,
      }),
      prisma.article.findMany({
        where: { status: "PUBLISHED", ...authorFilter },
        orderBy: { viewCount: "desc" },
        take: 4,
        select: { id: true, title: true, slug: true, viewCount: true, category: true },
      }),
    ]);

  const stats = [
    { label: "已發布文章", value: totalPublished, href: "/admin/articles?status=PUBLISHED", desc: "篇文章已上線" },
    { label: "草稿文章", value: totalDraft, href: "/admin/articles?status=DRAFT", desc: "篇尚未發布" },
    { label: "總瀏覽量", value: (totalViews._sum.viewCount ?? 0).toLocaleString(), href: "/admin/articles", desc: "累計讀者瀏覽" },
    { label: "文章分類", value: totalCategories, href: "/admin/categories", desc: "個主題分類" },
    ...(isAdmin ? [{ label: "編輯帳號", value: totalUsers, href: "/admin/users", desc: "位團隊成員" }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user.name ? `歡迎回來，${user.name.split(" ")[0]} 👋` : "後台總覽"}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
        </div>
        <Link
          href="/admin/articles/new"
          className="flex items-center gap-2 bg-rose-brand text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-rose-dark transition-colors shadow-sm"
        >
          <FileText size={15} />
          撰寫新文章
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-xl p-5 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all ml-auto mt-1" />
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-0.5">{stat.value}</p>
            <p className="text-xs text-gray-400">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Recent articles */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900 text-sm">最新文章</h2>
            </div>
            <Link href="/admin/articles" className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
              全部文章 <ArrowRight size={11} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentArticles.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">尚無文章</p>
                <Link href="/admin/articles/new" className="text-xs text-amber-600 hover:underline mt-1 block">立即新增</Link>
              </div>
            ) : (
              recentArticles.map((article) => (
                <div key={article.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate group-hover:text-gray-900">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {article.category && (
                        <span className="text-xs text-gray-400">{article.category.name}</span>
                      )}
                      <span className="text-gray-200">·</span>
                      <span className="text-xs text-gray-400">{formatDate(article.publishedAt ?? article.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[article.status]?.className}`}>
                      {STATUS_CONFIG[article.status]?.label}
                    </span>
                    <Link
                      href={`/admin/articles/${article.id}`}
                      className="text-xs text-gray-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-all font-medium"
                    >
                      編輯
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top articles */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
            <TrendingUp size={15} className="text-gray-400" />
            <h2 className="font-semibold text-gray-900 text-sm">熱門文章</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {topArticles.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">發布文章後即可看到數據</p>
              </div>
            ) : (
              topArticles.map((article, i) => (
                <div key={article.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                  <span className={`text-lg font-bold font-serif w-6 flex-shrink-0 ${
                    i === 0 ? "text-amber-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-gray-300"
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Link href={`/admin/articles/${article.id}`} className="text-sm text-gray-800 hover:text-amber-600 line-clamp-2 leading-snug font-medium transition-colors">
                      {article.title}
                    </Link>
                    {article.category && (
                      <p className="text-xs text-gray-400 mt-0.5">{article.category.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <Eye size={11} />
                    <span>{article.viewCount.toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
