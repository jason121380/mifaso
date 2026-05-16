"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, Search, Check } from "lucide-react";

interface MediaItem {
  id: string;
  url: string;
  originalName: string;
  alt?: string;
}

interface Props {
  onSelect: (url: string) => void;
  onClose: () => void;
}

export default function MediaPicker({ onSelect, onClose }: Props) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchMedia = useCallback(async (p: number) => {
    setLoading(true);
    const res = await fetch(`/api/media?page=${p}&pageSize=30`);
    const data = await res.json();
    setMedia(data.media ?? []);
    setTotalPages(data.meta?.totalPages ?? 1);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMedia(page); }, [fetchMedia, page]);

  const filtered = media.filter((m) =>
    m.originalName.toLowerCase().includes(search.toLowerCase())
  );

  function handleConfirm() {
    if (selected) { onSelect(selected); onClose(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">從媒體庫選取圖片</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋圖片..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-rose-brand w-48"
              />
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-rose-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2.5">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item.url === selected ? null : item.url)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selected === item.url
                      ? "border-rose-brand ring-2 ring-rose-brand/30"
                      : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <Image src={item.url} alt={item.alt ?? item.originalName} fill className="object-cover" />
                  {selected === item.url && (
                    <div className="absolute inset-0 bg-rose-brand/20 flex items-center justify-center">
                      <div className="w-6 h-6 bg-rose-brand rounded-full flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="col-span-6 text-center text-gray-400 py-16 text-sm">找不到圖片</p>
              )}
            </div>
          )}
        </div>

        {/* Pagination + footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {totalPages > 1 && (
              <>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:border-gray-400 transition-colors">
                  上一頁
                </button>
                <span className="text-xs text-gray-400">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:border-gray-400 transition-colors">
                  下一頁
                </button>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-5 py-2 text-sm border border-gray-200 rounded-lg hover:border-gray-400 text-gray-600 transition-colors">
              取消
            </button>
            <button onClick={handleConfirm} disabled={!selected}
              className="px-5 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-rose-brand transition-colors disabled:opacity-40">
              選取圖片
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
