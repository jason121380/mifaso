"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { InstagramEmbed, TableOfContents } from "./tiptap-nodes";

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

  const addImage = useCallback(() => {
    const url = window.prompt("請輸入圖片網址：");
    if (url && editor) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const addInstagram = useCallback(() => {
    const url = window.prompt("請貼上 Instagram 貼文網址（例：https://www.instagram.com/p/xxxxx/）：");
    if (!url || !editor) return;
    const match = url.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
    if (!match) { alert("無效的 Instagram 網址"); return; }
    const postId = match[1];
    editor
      .chain()
      .focus()
      .insertContent({
        type: "instagramEmbed",
        attrs: { url: `https://www.instagram.com/p/${postId}/` },
      })
      .run();
  }, [editor]);

  const addToc = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({ type: "tableOfContents" }).run();
  }, [editor]);

  const setLink = useCallback(() => {
    const url = window.prompt("請輸入連結網址：");
    if (url === null) return;
    if (url === "") { editor?.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
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

        <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="插入連結">🔗</ToolbarButton>
        <ToolbarButton onClick={addImage} active={false} title="插入圖片">🖼</ToolbarButton>
        <ToolbarButton onClick={addInstagram} active={false} title="插入 Instagram 貼文">IG</ToolbarButton>
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
    </div>
  );
}
