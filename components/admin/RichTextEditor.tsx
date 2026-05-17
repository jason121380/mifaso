"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { InstagramEmbed, TableOfContents, HeadingId } from "./tiptap-nodes";
import MediaPicker from "./MediaPicker";

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const ToolbarButton = ({ onClick, active, title, children }: any) => (
  <button
    type="button"
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    title={title}
    className={cn(
      "px-2.5 py-1.5 text-sm border transition-colors rounded-sm",
      active ? "bg-black text-white border-black" : "border-gray-200 text-gray-600 hover:border-black hover:text-black"
    )}
  >
    {children}
  </button>
);

function slugify(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[\s　]+/g, "-")
      .replace(/[^\p{L}\p{N}-]/gu, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "section"
  );
}

interface HeadingItem {
  pos: number;
  level: number;
  text: string;
  id: string | null;
}

type ModalKind = null | "link" | "anchor" | "image" | "instagram";

const inputCls =
  "w-full border border-gray-200 focus:border-rose-brand focus:ring-2 focus:ring-rose-light outline-none px-3 py-2 text-sm rounded-md transition-all";

export default function RichTextEditor({ content, onChange, placeholder = "開始撰寫內容..." }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-rose-brand underline" } }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      InstagramEmbed,
      TableOfContents,
      HeadingId,
    ],
    content,
    editorProps: {
      attributes: { class: "ProseMirror focus:outline-none" },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  // ---- 自建彈窗狀態 ----
  const [modal, setModal] = useState<ModalKind>(null);
  const [linkTab, setLinkTab] = useState<"url" | "anchor">("url");
  const [linkUrl, setLinkUrl] = useState("");
  const [anchorPos, setAnchorPos] = useState<string>("");
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [anchorId, setAnchorId] = useState("");
  const [anchorErr, setAnchorErr] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [imgTab, setImgTab] = useState<"media" | "upload" | "url">("media");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [igUrl, setIgUrl] = useState("");
  const [igErr, setIgErr] = useState("");

  const collectHeadings = useCallback((): HeadingItem[] => {
    if (!editor) return [];
    const out: HeadingItem[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        const text = node.textContent.trim();
        if (text) out.push({ pos, level: node.attrs.level, text, id: node.attrs.id ?? null });
      }
      return true;
    });
    return out;
  }, [editor]);

  const closeModal = () => {
    setModal(null);
    setAnchorErr("");
    setIgErr("");
  };

  const openLink = useCallback(() => {
    if (!editor) return;
    const existing = editor.getAttributes("link")?.href ?? "";
    const isAnchor = typeof existing === "string" && existing.startsWith("#");
    const hs = collectHeadings();
    setHeadings(hs);
    setLinkTab(isAnchor ? "anchor" : "url");
    setLinkUrl(isAnchor ? "" : existing);
    setAnchorPos("");
    setModal("link");
  }, [editor, collectHeadings]);

  const applyLink = () => {
    if (!editor) return;
    if (linkTab === "url") {
      const url = linkUrl.trim();
      if (!url) {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      }
      closeModal();
      return;
    }
    // 段落錨點
    if (!anchorPos) { setAnchorErr("請選擇要連到的段落標題"); return; }
    const pos = Number(anchorPos);
    const h = headings.find((x) => x.pos === pos);
    if (!h) { setAnchorErr("找不到該標題"); return; }
    let id = h.id;
    if (!id) {
      const used = new Set(headings.map((x) => x.id).filter(Boolean) as string[]);
      let base = slugify(h.text);
      let s = base, i = 2;
      while (used.has(s)) s = `${base}-${i++}`;
      id = s;
      editor.chain().command(({ tr }) => { tr.setNodeAttribute(pos, "id", id); return true; }).run();
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: `#${id}` }).run();
    closeModal();
  };

  const openAnchor = useCallback(() => {
    if (!editor) return;
    if (!editor.isActive("heading")) {
      setAnchorErr("錨點一定要設在標題上。請先把游標點進 H1 / H2 / H3 標題那一行,再開此視窗。");
      setAnchorId("");
      setModal("anchor");
      return;
    }
    const node = editor.state.selection.$from.parent;
    const current = (node.attrs.id as string | null) || "";
    setAnchorId(current || slugify(node.textContent || ""));
    setAnchorErr("");
    setModal("anchor");
  }, [editor]);

  const applyAnchor = () => {
    if (!editor) return;
    if (!editor.isActive("heading")) { closeModal(); return; }
    editor.chain().focus().updateAttributes("heading", { id: anchorId.trim() || null }).run();
    closeModal();
  };

  const openImage = useCallback(() => {
    setImgUrl(""); setUploadErr(""); setImgTab("media"); setModal("image");
  }, []);
  const insertImage = useCallback((url: string) => {
    if (url && editor) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);
  const applyImageUrl = () => {
    const url = imgUrl.trim();
    if (url) insertImage(url);
    closeModal();
  };
  const pickFromMedia = () => {
    setModal(null);
    setShowPicker(true);
  };
  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        setUploadErr(data?.error ?? "上傳失敗");
        return;
      }
      insertImage(data.url);
      closeModal();
    } catch {
      setUploadErr("上傳失敗,請稍後再試。");
    } finally {
      setUploading(false);
    }
  };

  const openInstagram = useCallback(() => { setIgUrl(""); setIgErr(""); setModal("instagram"); }, []);
  const applyInstagram = () => {
    if (!editor) return;
    const match = igUrl.trim().match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
    if (!match) { setIgErr("無效的 Instagram 貼文網址"); return; }
    editor.chain().focus().insertContent({
      type: "instagramEmbed",
      attrs: { url: `https://www.instagram.com/p/${match[1]}/` },
    }).run();
    closeModal();
  };

  const addToc = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({ type: "tableOfContents" }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-sm overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-gray-50 p-2 flex flex-wrap gap-1.5">
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="標題 1">H1</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="標題 2">H2</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="標題 3">H3</ToolbarButton>

        <div className="w-px bg-gray-200 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="粗體"><strong>B</strong></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="斜體"><em>I</em></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="底線"><span className="underline">U</span></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="刪除線"><s>S</s></ToolbarButton>

        <div className="w-px bg-gray-200 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="項目清單">≡</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="編號清單">⒈</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="引用">❝</ToolbarButton>

        <div className="w-px bg-gray-200 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="靠左">←</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="置中">↔</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="靠右">→</ToolbarButton>

        <div className="w-px bg-gray-200 mx-1" />

        <ToolbarButton onClick={openLink} active={editor.isActive("link")} title="插入連結">🔗</ToolbarButton>
        <ToolbarButton onClick={openAnchor} active={editor.isActive("heading") && !!editor.state.selection.$from.parent.attrs?.id} title="設定標題錨點（手動目錄用）">⚓</ToolbarButton>
        <ToolbarButton onClick={openImage} active={false} title="插入圖片">🖼</ToolbarButton>
        <ToolbarButton onClick={openInstagram} active={false} title="插入 Instagram 貼文">IG</ToolbarButton>
        <ToolbarButton onClick={addToc} active={false} title="插入本文目錄（前台依標題自動產生）">目錄</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="分隔線">—</ToolbarButton>

        <div className="w-px bg-gray-200 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} active={false} title="復原">↩</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} active={false} title="取消復原">↪</ToolbarButton>
      </div>

      {/* Editor */}
      <div className="min-h-[500px] max-h-[800px] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* ---- 自建彈窗 ---- */}
      {modal && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
            {modal === "link" && (
              <>
                <h3 className="text-base font-semibold text-gray-900 mb-4">插入 / 編輯連結</h3>
                <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-md">
                  <button type="button" onClick={() => setLinkTab("url")}
                    className={cn("flex-1 py-1.5 text-sm rounded transition-colors", linkTab === "url" ? "bg-white shadow-sm font-medium text-gray-900" : "text-gray-500")}>
                    外部連結
                  </button>
                  <button type="button" onClick={() => setLinkTab("anchor")}
                    className={cn("flex-1 py-1.5 text-sm rounded transition-colors", linkTab === "anchor" ? "bg-white shadow-sm font-medium text-gray-900" : "text-gray-500")}>
                    段落錨點
                  </button>
                </div>

                {linkTab === "url" ? (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">連結網址</label>
                    <input autoFocus type="text" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") applyLink(); }}
                      placeholder="https://example.com" className={inputCls} />
                    <p className="text-xs text-gray-400 mt-1.5">清空並確定可移除連結。</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">連到本文段落（標題）</label>
                    <select value={anchorPos} onChange={(e) => { setAnchorPos(e.target.value); setAnchorErr(""); }} className={inputCls}>
                      <option value="">— 請選擇段落 —</option>
                      {headings.map((h) => (
                        <option key={h.pos} value={h.pos}>
                          {"　".repeat(Math.max(0, h.level - 1))}{h.text}
                        </option>
                      ))}
                    </select>
                    {headings.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1.5">內文目前沒有標題;請先用 H1/H2/H3 建立段落標題。</p>
                    )}
                    {anchorErr && <p className="text-xs text-red-500 mt-1.5">{anchorErr}</p>}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-5">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">取消</button>
                  <button type="button" onClick={applyLink} className="px-4 py-2 text-sm bg-rose-brand text-white rounded-md hover:bg-rose-dark transition-colors">確定</button>
                </div>
              </>
            )}

            {modal === "anchor" && (
              <>
                <h3 className="text-base font-semibold text-gray-900 mb-4">設定標題錨點</h3>
                {anchorErr ? (
                  <p className="text-sm text-gray-500">{anchorErr}</p>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">錨點 ID（目錄用 #ID 跳轉；留空清除）</label>
                    <input autoFocus type="text" value={anchorId} onChange={(e) => setAnchorId(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") applyAnchor(); }}
                      placeholder="section-1" className={inputCls} />
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                      ※ 錨點只能設在 <b>H1 / H2 / H3</b> 標題上。設好後,在「目錄」或文字選取後用 🔗 →「段落錨點」連到此標題即可同頁跳轉。
                    </p>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-5">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">取消</button>
                  {!anchorErr && (
                    <button type="button" onClick={applyAnchor} className="px-4 py-2 text-sm bg-rose-brand text-white rounded-md hover:bg-rose-dark transition-colors">確定</button>
                  )}
                </div>
              </>
            )}

            {modal === "image" && (
              <>
                <h3 className="text-base font-semibold text-gray-900 mb-4">插入圖片</h3>
                <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-md">
                  {([["media", "媒體庫"], ["upload", "本機上傳"], ["url", "外部網址"]] as const).map(([k, label]) => (
                    <button key={k} type="button" onClick={() => { setImgTab(k); setUploadErr(""); }}
                      className={cn("flex-1 py-1.5 text-sm rounded transition-colors", imgTab === k ? "bg-white shadow-sm font-medium text-gray-900" : "text-gray-500")}>
                      {label}
                    </button>
                  ))}
                </div>

                {imgTab === "media" && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-3">從已上傳的媒體庫挑選圖片。</p>
                    <button type="button" onClick={pickFromMedia}
                      className="px-4 py-2 text-sm bg-rose-brand text-white rounded-lg hover:bg-rose-dark transition-colors">
                      開啟媒體庫
                    </button>
                  </div>
                )}

                {imgTab === "upload" && (
                  <div className="text-center py-4">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => handleUpload(e.target.files?.[0])} />
                    <p className="text-sm text-gray-500 mb-3">從這台裝置選一張圖片上傳。</p>
                    <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
                      className="px-4 py-2 text-sm bg-rose-brand text-white rounded-lg hover:bg-rose-dark transition-colors disabled:opacity-40">
                      {uploading ? "上傳中…" : "選擇檔案上傳"}
                    </button>
                    {uploadErr && <p className="text-xs text-red-500 mt-2">{uploadErr}</p>}
                  </div>
                )}

                {imgTab === "url" && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">圖片網址</label>
                    <input autoFocus type="text" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") applyImageUrl(); }}
                      placeholder="https://.../image.jpg" className={inputCls} />
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-5">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">取消</button>
                  {imgTab === "url" && (
                    <button type="button" onClick={applyImageUrl} className="px-4 py-2 text-sm bg-rose-brand text-white rounded-md hover:bg-rose-dark transition-colors">插入</button>
                  )}
                </div>
              </>
            )}

            {modal === "instagram" && (
              <>
                <h3 className="text-base font-semibold text-gray-900 mb-4">插入 Instagram 貼文</h3>
                <label className="block text-xs text-gray-500 mb-1.5">貼文網址</label>
                <input autoFocus type="text" value={igUrl} onChange={(e) => { setIgUrl(e.target.value); setIgErr(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") applyInstagram(); }}
                  placeholder="https://www.instagram.com/p/xxxxx/" className={inputCls} />
                {igErr && <p className="text-xs text-red-500 mt-1.5">{igErr}</p>}
                <div className="flex justify-end gap-2 mt-5">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">取消</button>
                  <button type="button" onClick={applyInstagram} className="px-4 py-2 text-sm bg-rose-brand text-white rounded-md hover:bg-rose-dark transition-colors">插入</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showPicker && (
        <MediaPicker
          onSelect={(url) => insertImage(url)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
