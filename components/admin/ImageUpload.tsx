"use client";

import { useState, useRef, DragEvent } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Images } from "lucide-react";

const MediaPicker = dynamic(() => import("./MediaPicker"), { ssr: false });

interface Props {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}

export default function ImageUpload({ value, onChange, label = "封面圖片" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) { setError("請上傳圖片檔案"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("圖片大小不得超過 10MB"); return; }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "上傳失敗");
      onChange(data.url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  return (
    <div>
      {label && <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">{label}</label>}

      {value ? (
        <div className="relative group">
          <div className="relative aspect-video w-full overflow-hidden bg-gray-100 rounded-lg">
            <Image src={value} alt="封面圖片" fill className="object-cover" />
          </div>
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 rounded-lg">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="text-white text-xs uppercase tracking-widest border border-white px-4 py-2 hover:bg-white hover:text-black transition-colors rounded">
              上傳新圖
            </button>
            <button type="button" onClick={() => setShowPicker(true)}
              className="text-white text-xs uppercase tracking-widest border border-white px-4 py-2 hover:bg-white hover:text-black transition-colors rounded">
              媒體庫
            </button>
            <button type="button" onClick={() => onChange("")}
              className="text-white text-xs uppercase tracking-widest border border-white px-4 py-2 hover:bg-red-600 hover:border-red-600 transition-colors rounded">
              移除
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed cursor-pointer transition-colors aspect-video flex flex-col items-center justify-center gap-3 rounded-lg ${
              isDragging ? "border-rose-brand bg-rose-brand/5" : "border-gray-200 hover:border-rose-brand"
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-rose-brand border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-gray-400">上傳中...</p>
              </div>
            ) : (
              <>
                <div className="text-3xl text-gray-200">⊞</div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">點擊或拖拽上傳圖片</p>
                  <p className="text-xs text-gray-300 mt-1">JPG、PNG、WebP，最大 10MB</p>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:border-rose-brand hover:text-rose-brand transition-colors"
          >
            <Images size={14} />
            從媒體庫選取
          </button>
        </div>
      )}

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
      />

      {showPicker && (
        <MediaPicker
          onSelect={(url) => { onChange(url); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
