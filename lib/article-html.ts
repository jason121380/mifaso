/**
 * 前台渲染前處理文章 HTML：
 *  1. 為 H2/H3/H4 自動加上 id（供目錄錨點跳轉）
 *  2. 將編輯器插入的 <div data-toc> 佔位，換成依標題自動產生的目錄
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderArticleHtml(html: string): string {
  if (!html) return "";

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
