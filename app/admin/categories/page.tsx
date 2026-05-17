"use client";

import { useState, useEffect } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
  _count: { articles: number };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "", sortOrder: 0 });
  const [showForm, setShowForm] = useState(false);

  async function fetchCategories() {
    const res = await fetch("/api/categories");
    setCategories(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchCategories(); }, []);

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setForm({ name: cat.name, slug: cat.slug, description: cat.description ?? "", sortOrder: cat.sortOrder });
    setShowForm(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", slug: "", description: "", sortOrder: categories.length });
    setShowForm(false);
  }

  async function handleSave() {
    const url = editingId ? `/api/categories/${editingId}` : "/api/categories";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { fetchCategories(); resetForm(); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`確定要刪除分類「${name}」？`)) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    fetchCategories();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">分類管理</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-rose-brand text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-rose-dark transition-colors shadow-sm"
        >
          <span className="text-base leading-none">＋</span> 新增分類
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-100 p-6 mb-8 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-4">{editingId ? "編輯分類" : "新增分類"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">分類名稱 *</label>
              <input type="text" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 focus:border-rose-brand focus:ring-2 focus:ring-rose-light outline-none px-3 py-2.5 text-sm rounded-lg transition-all"
                placeholder="例如：美髮" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Slug（網址）</label>
              <input type="text" value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className="w-full border border-gray-200 focus:border-rose-brand focus:ring-2 focus:ring-rose-light outline-none px-3 py-2.5 text-sm rounded-lg transition-all"
                placeholder="hair-style" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">描述</label>
              <input type="text" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 focus:border-rose-brand focus:ring-2 focus:ring-rose-light outline-none px-3 py-2.5 text-sm rounded-lg transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">排序</label>
              <input type="number" value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="w-full border border-gray-200 focus:border-rose-brand focus:ring-2 focus:ring-rose-light outline-none px-3 py-2.5 text-sm rounded-lg transition-all"
                min={0} />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={handleSave} className="bg-rose-brand text-white px-6 py-2.5 text-sm font-medium rounded-lg hover:bg-rose-dark transition-colors">
              {editingId ? "更新" : "新增"}
            </button>
            <button onClick={resetForm} className="border border-gray-200 text-gray-500 px-6 py-2.5 text-sm rounded-lg hover:border-gray-400 hover:text-gray-700 transition-colors">
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-rose-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white border border-gray-100 p-5 rounded-xl hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{cat.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">/{cat.slug}</p>
                </div>
                <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full flex-shrink-0">{cat._count.articles} 篇</span>
              </div>
              {cat.description && (
                <p className="text-sm text-gray-400 mt-3 line-clamp-2">{cat.description}</p>
              )}
              <div className="flex gap-3 mt-4 pt-4 border-t border-gray-50">
                <button onClick={() => startEdit(cat)} className="text-xs text-gray-500 hover:text-gray-900 font-medium transition-colors">編輯</button>
                <button onClick={() => handleDelete(cat.id, cat.name)} className="text-xs text-red-400 hover:text-red-600 transition-colors">刪除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
