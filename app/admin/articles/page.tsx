"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { FileText, Search, Plus, Eye, Pencil, Trash2, Star, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PUBLISHED: { label: "已發布", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  DRAFT:     { label: "草稿",   className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  ARCHIVED:  { label: "已封存", className: "bg-gray-100 text-gray-500 ring-1 ring-gray-200" },
};

export default function ArticlesPage() {
  const [articles, setArticles] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const res = await fetch(`/api/articles?${params}`);
    const data = await res.json();
    setArticles(data.articles ?? []);
    setMeta(data.meta ?? { total: 0, totalPages: 1 });
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  async function deleteArticle(id: string, title: string) {
    if (!confirm(`確定要刪除「${title}」？此操作無法復原。`)) return;
    await fetch(`/api/articles/${id}`, { method: "DELETE" });
    fetchArticles();
  }

  async function toggleFeatured(id: string, current: boolean) {
    await fetch(`/api/articles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !current }),
    });
    setArticles((prev) => prev.map((a) => a.id === id ? { ...a, featured: !current } : a));
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">文章管理</h1>
          <p className="text-sm text-gray-400 mt-1">共 {meta.total} 篇文章</p>
        </div>
        <Link
          href="/admin/articles/new"
          className="flex items-center gap-2 bg-rose-brand text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-rose-dark transition-colors shadow-sm"
        >
          <Plus size={15} />
          新增文章
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="search"
            placeholder="搜尋文章標題..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-rose-brand focus:ring-2 focus:ring-rose-light transition-all"
          />
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {[
            { value: "", label: "全部" },
            { value: "PUBLISHED", label: "已發布" },
            { value: "DRAFT", label: "草稿" },
            { value: "ARCHIVED", label: "已封存" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatus(opt.value); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                status === opt.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-7 h-7 border-2 border-rose-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-24">
            <FileText size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium mb-1">尚無文章</p>
            <Link href="/admin/articles/new" className="text-sm text-amber-600 hover:underline">立即撰寫第一篇 →</Link>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-2 md:px-4 py-3 w-8" />
                  <th className="text-left px-3 md:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">文章標題</th>
                  <th className="text-left px-3 md:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">分類</th>
                  <th className="text-left px-3 md:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">作者</th>
                  <th className="text-left px-3 md:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">狀態</th>
                  <th className="text-left px-3 md:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap hidden xl:table-cell">發布日期</th>
                  <th className="px-6 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {articles.map((article) => (
                  <tr key={article.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-2 md:px-4 py-4">
                      <button
                        onClick={() => toggleFeatured(article.id, article.featured)}
                        title={article.featured ? "取消精選" : "設為精選"}
                        className="p-1 rounded transition-colors hover:scale-110 active:scale-95"
                      >
                        <Star
                          size={16}
                          className={article.featured ? "text-amber-400" : "text-gray-200 hover:text-amber-300"}
                          fill={article.featured ? "currentColor" : "none"}
                        />
                      </button>
                    </td>
                    <td className="px-3 md:px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{article.title}</p>
                        {article.excerpt && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xs hidden lg:block">{article.excerpt}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-4 hidden md:table-cell">
                      {article.category ? (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-medium">{article.category.name}</span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                          {article.author?.name?.[0]}
                        </div>
                        <span className="text-sm text-gray-600">{article.author?.name}</span>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-4">
                      <span className={`inline-block whitespace-nowrap text-[11px] px-2.5 py-0.5 rounded-full font-medium ${STATUS_CONFIG[article.status]?.className}`}>
                        {STATUS_CONFIG[article.status]?.label}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-4 hidden xl:table-cell">
                      <span className="text-xs text-gray-400">{formatDate(article.publishedAt ?? article.updatedAt)}</span>
                    </td>
                    <td className="px-3 md:px-6 py-4">
                      <div className="flex items-center gap-1 justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        {article.status === "PUBLISHED" && (
                          <Link href={`/article/${article.slug}`} target="_blank"
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="前台預覽">
                            <Eye size={14} />
                          </Link>
                        )}
                        <Link href={`/admin/articles/${article.id}`}
                          className="p-1.5 text-gray-400 hover:text-rose-brand hover:bg-rose-light rounded-lg transition-colors" title="編輯">
                          <Pencil size={14} />
                        </Link>
                        <button onClick={() => deleteArticle(article.id, article.title)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="刪除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-50">
                <p className="text-xs text-gray-400">第 {page} 頁，共 {meta.totalPages} 頁</p>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`min-w-[32px] h-8 text-xs rounded-lg transition-colors ${p === page ? "bg-rose-brand text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
