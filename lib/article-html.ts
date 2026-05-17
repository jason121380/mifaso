/**
 * 前台渲染前處理文章 HTML：
 *  0. 先用 allowlist 消毒（移除 script 標籤、on 事件屬性、javascript 連結 等，防 stored-XSS）
 *  1. 為 H2/H3/H4 自動加上 id（供目錄錨點跳轉）
 *  2. 將編輯器插入的 <div data-toc> 佔位，換成依標題自動產生的目錄
 *
 * 注意：消毒會移除內文裡的 <script>(含 Instagram embed.js),IG 仍由
 * components/public/InstagramEmbed.tsx 載入的 embed.js 處理保留下來的
 * <blockquote class="instagram-media">,功能不受影響且更安全。
 */
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "span", "div", "section", "article", "nav",
    "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup",
    "a", "ul", "ol", "li", "blockquote", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "img", "figure", "figcaption", "picture", "source",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
    "iframe", "pre", "code",
  ],
  allowedAttributes: {
    "*": ["class", "style", "id"],
    a: ["href", "target", "rel", "name"],
    img: ["src", "alt", "width", "height", "loading", "decoding", "srcset", "sizes"],
    source: ["src", "srcset", "type", "media"],
    blockquote: [
      "class", "style",
      "data-instgrm-permalink", "data-instgrm-version", "data-instgrm-captioned",
      "cite",
    ],
    div: ["class", "style", "id", "data-toc"],
    iframe: ["src", "width", "height", "frameborder", "allow", "allowfullscreen", "loading", "title", "style"],
    table: ["class", "style", "border", "cellspacing", "cellpadding", "rules", "align", "width"],
    td: ["class", "style", "colspan", "rowspan", "align", "valign", "width"],
    th: ["class", "style", "colspan", "rowspan", "align", "valign", "width", "scope"],
    col: ["span", "width", "style"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"], source: ["http", "https"] },
  allowProtocolRelative: false,
  allowedIframeHostnames: [
    "www.youtube.com", "youtube.com", "www.youtube-nocookie.com",
    "player.vimeo.com", "www.instagram.com",
  ],
  // <script>/<style> 等標籤與其文字內容一併移除
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
  transformTags: {
    a: (tagName, attribs) => {
      // 站內錨點(#section)一律同頁滾動,不開新分頁
      if (attribs.href && attribs.href.startsWith("#")) {
        delete attribs.target;
        delete attribs.rel;
      } else if (attribs.target === "_blank") {
        attribs.rel = "noopener noreferrer";
      }
      return { tagName, attribs };
    },
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderArticleHtml(rawHtml: string): string {
  if (!rawHtml) return "";

  const html = sanitizeHtml(rawHtml, SANITIZE_OPTS);

  const headings: { level: number; id: string; text: string }[] = [];
  const used = new Set<string>();

  const slugify = (raw: string): string => {
    const base =
      raw
        .replace(/<[^>]*>/g, "")
        .trim()
        .toLowerCase()
        .replace(/[\s　]+/g, "-")
        .replace(/[^\p{L}\p{N}-]/gu, "")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || "section";
    let s = base;
    let i = 2;
    while (used.has(s)) s = `${base}-${i++}`;
    used.add(s);
    return s;
  };

  const withIds = html.replace(
    /<h([2-4])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/gi,
    (full, lvl: string, attrs: string, inner: string) => {
      const text = inner.replace(/<[^>]*>/g, "").trim();
      if (!text) return full;
      if (/\sid\s*=/.test(attrs)) {
        headings.push({ level: Number(lvl), id: "", text });
        return full;
      }
      const id = slugify(text);
      headings.push({ level: Number(lvl), id, text });
      return `<h${lvl}${attrs} id="${id}">${inner}</h${lvl}>`;
    }
  );

  const hasTocPlaceholder = /<div[^>]*\sdata-toc[^>]*>\s*<\/div>/i.test(withIds);
  const linkable = headings.filter((h) => h.id);
  if (!hasTocPlaceholder || linkable.length === 0) return withIds;

  const items = linkable
    .map(
      (h) =>
        `<li class="toc-l${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`
    )
    .join("");
  const toc = `<nav class="article-toc not-prose"><p class="toc-title">本文目錄</p><ul>${items}</ul></nav>`;

  return withIds.replace(/<div[^>]*\sdata-toc[^>]*>\s*<\/div>/i, toc);
}
