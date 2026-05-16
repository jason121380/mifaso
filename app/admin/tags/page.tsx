"use client";

import { useState, useEffect } from "react";

interface Tag {
  id: string;
  name: string;
  slug: string;
  _count: { articles: number };
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  async function fetchTags() {
    const res = await fetch("/api/tags");
    setTags(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchTags(); }, []);

  async function createTag() {
    if (!newTagName.trim()) return;
    setSaving(true);
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTagName.trim() }),
    });
    setNewTagName("");
    fetchTags();
    setSaving(false);
  }

  async function deleteTag(id: string, name: string) {
    if (!confirm(`確定要刪除標籤「${name}」？`)) return;
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    fetchTags();
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">標籤管理</h1>
          <p className="text-gray-400 text-sm mt-1">共 {tags.length} 個標籤</p>
        </div>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋標籤..."
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-rose-brand focus:ring-2 focus:ring-rose-light transition-all w-full sm:w-56"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Add tag */}
      <div className="bg-white border border-gray-100 p-6 mb-8 rounded-xl">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">新增標籤</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createTag(); }}
            placeholder="輸入標籤名稱"
            className="flex-1 border border-gray-200 focus:border-rose-brand focus:ring-2 focus:ring-rose-light outline-none px-3 py-2.5 text-sm rounded-lg transition-all"
          />
          <button
            onClick={createTag}
            disabled={saving || !newTagName.trim()}
            className="bg-rose-brand text-white px-6 py-2.5 text-sm font-medium rounded-lg hover:bg-rose-dark transition-colors disabled:opacity-40"
          >
            新增
          </button>
        </div>
      </div>

      {/* Tags list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-rose-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase())).map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between gap-2 bg-white border border-gray-200 px-3 py-2.5 rounded-lg hover:border-rose-brand transition-colors group"
            >
              <span className="text-sm text-gray-700 break-all leading-snug min-w-0">
                {tag.name}
                <span className="text-xs text-gray-300 ml-1.5">{tag._count.articles}</span>
              </span>
              <button
                onClick={() => deleteTag(tag.id, tag.name)}
                className="text-gray-300 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0 text-xs p-1 -m-1"
                title="刪除標籤"
                aria-label={`刪除標籤 ${tag.name}`}
              >
                ✕
              </button>
            </div>
          ))}
          {tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
            <p className="text-gray-300 text-sm col-span-2 sm:col-span-3 lg:col-span-4 xl:col-span-5">{search ? `找不到「${search}」` : "尚無標籤"}</p>
          )}
        </div>
      )}
    </div>
  );
}
