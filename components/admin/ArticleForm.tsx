"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ImageUpload from "./ImageUpload";
import { generateSlug } from "@/lib/utils";
import { Globe, FolderOpen, Tag as TagIcon, ImageIcon, Send, Save, Plus, X, AlertCircle, Star, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const RichTextEditor = dynamic(() => import("./RichTextEditor"), { ssr: false });

interface ArticleFormProps {
  initialData?: any;
  categories: { id: string; name: string }[];
  allTags: { id: string; name: string }[];
  mode: "create" | "edit";
}

const inputCls = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-rose-brand focus:ring-2 focus:ring-rose-light transition-all bg-white";
const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

export default function ArticleForm({ initialData, categories, allTags, mode }: ArticleFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newTag, setNewTag] = useState("");

  const [form, setForm] = useState({
    title: initialData?.title ?? "",
    slug: initialData?.slug ?? "",
    excerpt: initialData?.excerpt ?? "",
    content: initialData?.content ?? "",
    featuredImage: initialData?.featuredImage ?? "",
    featuredImageAlt: initialData?.featuredImageAlt ?? "",
    status: initialData?.status ?? "DRAFT",
    featured: initialData?.featured ?? false,
    categoryId: initialData?.categoryId ?? "",
    tagIds: initialData?.tags?.map((t: any) => t.tagId ?? t.tag?.id) ?? [],
    metaTitle: initialData?.metaTitle ?? "",
    metaDescription: initialData?.metaDescription ?? "",
  });

  const [tags, setTags] = useState(allTags);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);

  async function suggestTitles() {
    setAiLoading("titles");
    setTitleSuggestions([]);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "titles", title: form.title, content: form.content }),
      });
      const data = await res.json();
      if (!data.result) return;
      const list = String(data.result)
        .split("\n")
        .map((s: string) => s.replace(/^\s*\d+[.、)]\s*/, "").replace(/^[-・*]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 6);
      setTitleSuggestions(list);
    } finally {
      setAiLoading(null);
    }
  }

  async function generateAI(type: "excerpt" | "metaTitle" | "metaDescription" | "tags") {
    setAiLoading(type);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: form.title,
          content: form.content,
          availableTags: type === "tags" ? tags.map((t) => t.name).join("、") : undefined,
        }),
      });
      const data = await res.json();
      if (!data.result) return;

      if (type === "tags") {
        const suggested = data.result.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean);
        const matched = tags.filter((t) => suggested.includes(t.name)).map((t) => t.id);
        set("tagIds", matched);
      } else {
        set(type, data.result);
      }
    } finally {
      setAiLoading(null);
    }
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleTitleBlur() {
    if (!form.slug && form.title) set("slug", generateSlug(form.title));
  }

  async function addNewTag(nameOverride?: string) {
    const name = (nameOverride ?? newTag).trim();
    if (!name) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const tag = await res.json();
    setTags((prev) => [...prev, tag]);
    set("tagIds", [...form.tagIds, tag.id]);
    setNewTag("");
  }

  function toggleTag(id: string) {
    set("tagIds", form.tagIds.includes(id)
      ? form.tagIds.filter((t: string) => t !== id)
      : [...form.tagIds, id]);
  }

  async function handleSave(statusOverride?: string) {
    setSaving(true);
    setError("");
    const payload = { ...form, status: statusOverride ?? form.status };
    const url = mode === "create" ? "/api/articles" : `/api/articles/${initialData.id}`;
    const method = mode === "create" ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setError(typeof data.error === "string" ? data.error : "儲存失敗，請確認欄位內容"); setSaving(false); return; }
    const published = (statusOverride ?? form.status) === "PUBLISHED";
    toast.success(published ? "文章已發布！" : "草稿已儲存", { description: form.title.substring(0, 50) });
    router.push(`/admin/articles/${data.id}`);
    router.refresh();
    setSaving(false);
  }

  return (
    <div className="max-w-6xl">
      {error && (
        <div className="mb-6 flex items-center gap-2.5 p-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl">
          <AlertCircle size={15} className="flex-shrink-0" />
          {typeof error === "string" ? error : "請檢查表單內容"}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Main column ── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Title */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls + " mb-0"}>文章標題 <span className="text-red-400">*</span></label>
              <button
                type="button"
                onClick={suggestTitles}
                disabled={(!form.title && !form.content) || aiLoading === "titles"}
                title="依主題/內文產生高點擊率標題"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rose-50 text-rose-brand hover:bg-rose-dark hover:text-white transition-colors disabled:opacity-40 font-medium"
              >
                {aiLoading === "titles" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                AI 精靈
              </button>
            </div>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="輸入吸引人的標題,或先寫主題/內文再按 AI 精靈..."
              className="w-full font-serif text-2xl border-0 border-b-2 border-gray-100 focus:border-rose-brand focus:outline-none py-2 placeholder:text-gray-200 transition-colors bg-transparent"
              required
            />
            {titleSuggestions.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs text-gray-400">點選套用(高點擊率建議):</p>
                {titleSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { set("title", s); setTitleSuggestions([]); }}
                    className="block w-full text-left text-sm px-3 py-2 rounded-lg border border-gray-200 hover:border-rose-brand hover:bg-rose-50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Slug */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <label className={labelCls}>
              <Globe size={13} className="inline mr-1.5 text-gray-400" />
              文章網址 (Slug)
            </label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg overflow-hidden focus-within:border-rose-brand focus-within:ring-2 focus-within:ring-rose-light transition-all">
              <span className="pl-3 text-xs text-gray-400 select-none whitespace-nowrap">/article/</span>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="article-url"
                className="flex-1 py-2.5 pr-3 text-sm focus:outline-none bg-transparent"
              />
            </div>
          </div>

          {/* Excerpt */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls + " mb-0"}>文章摘要</label>
              <button
                type="button"
                onClick={() => generateAI("excerpt")}
                disabled={!form.title || aiLoading === "excerpt"}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rose-50 text-rose-brand hover:bg-rose-dark hover:text-white transition-colors disabled:opacity-40 font-medium"
              >
                {aiLoading === "excerpt" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                AI 精靈
              </button>
            </div>
            <textarea
              value={form.excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              placeholder="簡短描述這篇文章的重點，顯示於列表頁面..."
              rows={6}
              className={inputCls + " resize-y"}
            />
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <label className={labelCls}>文章內容 <span className="text-red-400">*</span></label>
            <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
              <RichTextEditor content={form.content} onChange={(html) => set("content", html)} />
            </div>
          </div>

          {/* SEO */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 bg-green-50 rounded flex items-center justify-center">
                <Globe size={13} className="text-green-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800">SEO 設定</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls + " mb-0"}>Meta 標題</label>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${form.metaTitle.length > 60 ? "text-amber-500" : "text-gray-300"}`}>
                      {form.metaTitle.length}/70
                    </span>
                    <button
                      type="button"
                      onClick={() => generateAI("metaTitle")}
                      disabled={!form.title || aiLoading === "metaTitle"}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rose-50 text-rose-brand hover:bg-rose-dark hover:text-white transition-colors disabled:opacity-40 font-medium"
                    >
                      {aiLoading === "metaTitle" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      AI 精靈
                    </button>
                  </div>
                </div>
                <input type="text" value={form.metaTitle} onChange={(e) => set("metaTitle", e.target.value)}
                  placeholder="留空則使用文章標題" maxLength={70} className={inputCls} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls + " mb-0"}>Meta 描述</label>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${form.metaDescription.length > 150 ? "text-amber-500" : "text-gray-300"}`}>
                      {form.metaDescription.length}/160
                    </span>
                    <button
                      type="button"
                      onClick={() => generateAI("metaDescription")}
                      disabled={!form.title || aiLoading === "metaDescription"}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rose-50 text-rose-brand hover:bg-rose-dark hover:text-white transition-colors disabled:opacity-40 font-medium"
                    >
                      {aiLoading === "metaDescription" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      AI 精靈
                    </button>
                  </div>
                </div>
                <textarea value={form.metaDescription} onChange={(e) => set("metaDescription", e.target.value)}
                  placeholder="搜尋引擎顯示的描述文字（建議 120-160 字元）" rows={3} maxLength={160}
                  className={inputCls + " resize-none"} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5">

          {/* Publish actions */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">發布設定</h3>
            <div className="space-y-3 mb-5">
              <div>
                <label className={labelCls}>文章狀態</label>
                <select value={form.status} onChange={(e) => set("status", e.target.value)}
                  className={inputCls}>
                  <option value="DRAFT">草稿</option>
                  <option value="PUBLISHED">已發布</option>
                  <option value="ARCHIVED">已封存</option>
                </select>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)}
                  className="w-4 h-4 rounded accent-rose-brand" />
                <div>
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Star size={12} className="text-amber-400" fill="currentColor" />
                    精選文章
                  </p>
                  <p className="text-xs text-gray-400">顯示於首頁精選區</p>
                </div>
              </label>
            </div>
            <div className="space-y-2">
              <button type="button" onClick={() => handleSave("PUBLISHED")} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-rose-brand text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-rose-dark transition-colors disabled:opacity-50 shadow-sm">
                <Send size={14} />
                {saving ? "儲存中..." : "儲存並發布"}
              </button>
              <button type="button" onClick={() => handleSave("DRAFT")} disabled={saving}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50">
                <Save size={14} />
                儲存草稿
              </button>
            </div>
          </div>

          {/* Featured image */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon size={14} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">封面圖片</h3>
            </div>
            <ImageUpload value={form.featuredImage} onChange={(url) => set("featuredImage", url)} label="" />
            {form.featuredImage && (
              <div className="mt-3">
                <label className={labelCls}>圖片 Alt 文字（SEO）</label>
                <input type="text" value={form.featuredImageAlt}
                  onChange={(e) => set("featuredImageAlt", e.target.value)}
                  placeholder="描述這張圖片的內容" className={inputCls} />
              </div>
            )}
          </div>

          {/* Category */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen size={14} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-800">文章分類</h3>
            </div>
            <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputCls}>
              <option value="">未分類</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TagIcon size={14} className="text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-800">文章標籤</h3>
              </div>
              <button
                type="button"
                onClick={() => generateAI("tags")}
                disabled={!form.title || aiLoading === "tags"}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rose-50 text-rose-brand hover:bg-rose-dark hover:text-white transition-colors disabled:opacity-40 font-medium"
              >
                {aiLoading === "tags" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                AI 選標籤
              </button>
            </div>

            {/* Selected tags */}
            {form.tagIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {form.tagIds.map((id: string) => {
                  const tag = tags.find((t) => t.id === id);
                  if (!tag) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 text-xs bg-rose-brand text-white px-2.5 py-1 rounded-full font-medium">
                      {tag.name}
                      <button type="button" onClick={() => toggleTag(id)} className="hover:text-rose-300 transition-colors">
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search dropdown */}
            <div className="relative">
              <input
                type="text"
                value={tagSearch}
                onChange={(e) => { setTagSearch(e.target.value); setShowTagDropdown(true); }}
                onFocus={() => setShowTagDropdown(true)}
                onBlur={() => setTimeout(() => setShowTagDropdown(false), 150)}
                placeholder="搜尋或新增標籤..."
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-rose-brand transition-all"
              />
              {showTagDropdown && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {tags
                    .filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()) && !form.tagIds.includes(t.id))
                    .slice(0, 20)
                    .map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onMouseDown={() => { toggleTag(tag.id); setTagSearch(""); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-rose-50 hover:text-rose-brand transition-colors"
                      >
                        {tag.name}
                      </button>
                    ))}
                  {tagSearch.trim() && !tags.find((t) => t.name === tagSearch.trim()) && (
                    <button
                      type="button"
                      onMouseDown={async () => {
                        await addNewTag(tagSearch.trim());
                        setTagSearch("");
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-rose-brand hover:bg-rose-50 transition-colors border-t border-gray-100"
                    >
                      ＋ 新增「{tagSearch.trim()}」
                    </button>
                  )}
                  {tags.filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()) && !form.tagIds.includes(t.id)).length === 0 && !tagSearch.trim() && (
                    <p className="px-3 py-2 text-xs text-gray-400">輸入關鍵字搜尋標籤</p>
                  )}
                </div>
              )}
            </div>
            <div className="hidden">
              <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewTag(); } }}
                placeholder="輸入新標籤..."
                className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-rose-brand transition-all" />
              <button type="button" onClick={() => addNewTag()}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
