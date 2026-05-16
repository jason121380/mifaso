import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Instagram 嵌入：以原子節點存放，輸出前台 embed.js 需要的 blockquote。
 * 同時能解析既有匯入內容中的 blockquote.instagram-media（編輯時不會被清掉）。
 */
export const InstagramEmbed = Node.create({
  name: "instagramEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: null as string | null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "blockquote.instagram-media",
        priority: 100,
        getAttrs: (el) => ({
          url: (el as HTMLElement).getAttribute("data-instgrm-permalink") || null,
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const url: string = HTMLAttributes.url || "";
    return [
      "blockquote",
      mergeAttributes({
        class: "instagram-media",
        "data-instgrm-permalink": url,
        "data-instgrm-version": "14",
        style: "width:100%;max-width:540px;margin:1em auto;",
      }),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.contentEditable = "false";
      dom.style.cssText =
        "border:1px dashed #C4837A;border-radius:8px;padding:14px;margin:12px 0;background:#FBF4F3;color:#A3635B;font-size:13px;text-align:center;";
      const url = node.attrs.url || "(未設定網址)";
      dom.textContent = `📷 Instagram 貼文：${url}`;
      return { dom };
    };
  },
});

/**
 * 目錄佔位：輸出 <div data-toc="true">，前台依文章 H2/H3 自動產生實際目錄。
 */
export const TableOfContents = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,
  draggable: true,

  parseHTML() {
    return [{ tag: "div[data-toc]", priority: 100 }];
  },

  renderHTML() {
    return ["div", mergeAttributes({ "data-toc": "true" })];
  },

  addNodeView() {
    return () => {
      const dom = document.createElement("div");
      dom.contentEditable = "false";
      dom.style.cssText =
        "border:1px dashed #999;border-radius:8px;padding:14px;margin:12px 0;background:#f6f6f6;color:#555;font-size:13px;text-align:center;";
      dom.textContent = "📑 本文目錄（發佈後依文章標題自動產生）";
      return { dom };
    };
  },
});
