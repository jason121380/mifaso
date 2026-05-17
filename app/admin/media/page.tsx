"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { formatFileSize, formatDate } from "@/lib/utils";

interface MediaItem {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  size: number;
  mimeType: string;
  alt: string | null;
  createdAt: string;
  uploadedBy: { name: string };
}

export default function MediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [altText, setAltText] = useState("");
  const [copied, setCopied] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function fetchMedia(p = 1) {
    if (p > 1) setLoadingMore(true);
    const res = await fetch(`/api/media?page=${p}&pageSize=48`);
    const data = await res.json();
    setMedia((prev) => (p === 1 ? data.media ?? [] : [...prev, ...(data.media ?? [])]));
    setTotal(data.meta?.total ?? 0);
    setPage(p);
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => { fetchMedia(1); }, []);

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      await fetch("/api/upload", { method: "POST", body: formData });
    }

    fetchMedia();
    setUploading(false);
  }

  async function saveAlt() {
    if (!selected) return;
    await fetch(`/api/media/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt: altText }),
    });
    setMedia((prev) => prev.map((m) => m.id === selected.id ? { ...m, alt: altText } : m));
    setSelected((prev) => prev ? { ...prev, alt: altText } : prev);
  }

  async function deleteMedia(id: string) {
    if (!confirm("確定要刪除此圖片？")) return;
    await fetch(`/api/media/${id}`, { method: "DELETE" });
    setMedia((prev) => prev.filter((m) => m.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    if (selected?.id === id) setSelected(null);
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">媒體庫</h1>
          <p className="text-gray-400 text-sm mt-1">{media.length} / {total} 張圖片</p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 bg-rose-brand text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-rose-dark transition-colors shadow-sm disabled:opacity-50"
        >
          {uploading ? "上傳中..." : "⊞ 上傳圖片"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center mb-8 hover:border-rose-brand transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
      >
        <p className="text-gray-300 text-sm">拖拽圖片至此處或點擊上傳（支援批量上傳）</p>
      </div>

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-rose-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {media.map((item) => (
                <div
                  key={item.id}
                  onClick={() => { setSelected(item); setAltText(item.alt ?? ""); }}
                  className={`relative aspect-square cursor-pointer group overflow-hidden bg-gray-100 ${
                    selected?.id === item.id ? "ring-2 ring-gold" : ""
                  }`}
                >
                  <Image src={item.url} alt={item.alt ?? item.originalName} fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <p className="text-white text-xs line-clamp-2">{item.originalName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && media.length < total && (
            <div className="mt-6 text-center">
              <button
                onClick={() => fetchMedia(page + 1)}
                disabled={loadingMore}
                className="border border-gray-200 text-gray-600 px-6 py-2.5 text-sm rounded-lg hover:border-rose-brand hover:text-rose-brand transition-colors disabled:opacity-50"
              >
                {loadingMore ? "載入中..." : `載入更多(剩 ${total - media.length})`}
              </button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 flex-shrink-0 bg-white border border-gray-100 p-5 self-start sticky top-8">
            <div className="relative aspect-video mb-4 overflow-hidden bg-gray-50">
              <Image src={selected.url} alt={selected.alt ?? selected.originalName} fill className="object-contain" />
            </div>

            <p className="font-medium text-sm text-gray-900 mb-1 break-all">{selected.originalName}</p>
            <p className="text-xs text-gray-400 mb-4">
              {formatFileSize(selected.size)} · {formatDate(selected.createdAt)}
              <br />上傳者：{selected.uploadedBy.name}
            </p>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5">Alt 文字</label>
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                onBlur={saveAlt}
                className="w-full border border-gray-200 focus:border-rose-brand outline-none px-2 py-1.5 text-sm"
                placeholder="描述這張圖片"
              />
            </div>

            <button
              onClick={() => copyUrl(selected.url)}
              className="w-full border border-gray-200 text-gray-600 py-2 text-sm rounded-lg hover:border-rose-brand hover:text-rose-brand transition-colors mb-2"
            >
              {copied === selected.url ? "已複製！" : "複製網址"}
            </button>
            <button
              onClick={() => deleteMedia(selected.id)}
              className="w-full border border-red-100 text-red-500 py-2 text-sm rounded-lg hover:bg-red-50 transition-colors"
            >
              刪除圖片
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
