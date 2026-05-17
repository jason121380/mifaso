/**
 * 文章內容結構整理(不改文字內容,只整理 HTML 結構/樣式/連結/間距)。
 * 純函式、確定性,供 /api/tidy-articles 使用;搭配備份可一鍵復原。
 */

const PLACEHOLDER = '<div data-toc="true"></div>';
const MAX_HEADING_LEN = 80;

function stripText(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

// 1. 過長(被誤包成標題)的 <h1~6> 降級為 <p>
function demoteLongHeadings(html: string): { html: string; n: number } {
  let n = 0;
  const out = html.replace(
    /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (full, _lvl, attrs: string, inner: string) => {
      if (stripText(inner).length > MAX_HEADING_LEN) {
        n++;
        return `<p${attrs}>${inner}</p>`;
      }
      return full;
    }
  );
  return { html: out, n };
}

// 2. 移除手動 / WP 舊版「本文目錄」
function stripManualTocs(html: string): { html: string; n: number } {
  let n = 0;
  const pats: RegExp[] = [
    /<table\b[^>]*>(?:(?!<\/table>)[\s\S])*?本文目錄[\s\S]*?<\/table>/gi,
    /<h[1-6]\b[^>]*>(?:(?!<\/h[1-6]>)[\s\S])*?本文目錄[\s\S]*?<\/h[1-6]>\s*<ul\b[\s\S]*?<\/ul>/gi,
    /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?本文目錄[\s\S]*?<\/p>\s*<ul\b[\s\S]*?<\/ul>/gi,
    /<div\b(?![^>]*\bdata-toc)[^>]*>(?:(?!<\/?div\b)[\s\S]){0,1200}?本文目錄(?:(?!<\/?div\b)[\s\S]){0,2500}?<\/div>/gi,
    /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?本文目錄[\s\S]*?<\/p>/gi,
  ];
  for (const re of pats) html = html.replace(re, () => { n++; return ""; });
  return { html, n };
}

// 3. 移除「延伸閱讀」段落(含其後僅含連結的段落)
function stripRelatedReading(html: string): { html: string; n: number } {
  let n = 0;
  const re =
    /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?延伸閱讀[\s\S]*?<\/p>(?:\s*<p\b[^>]*>(?:\s|<strong>|<em>|<b>|<i>)*<a\b[\s\S]*?<\/a>(?:\s|<\/strong>|<\/em>|<\/b>|<\/i>)*<\/p>)?/gi;
  const out = html.replace(re, () => { n++; return ""; });
  return { html: out, n };
}

// 4. 清雜亂 inline style / 空標籤 / 多餘 br / 空段落(不動 img/iframe/table/blockquote)
function tidyStyles(html: string): string {
  html = html.replace(
    /<(p|span|li|strong|em|u|s|a|h[1-6])\b([^>]*?)\sstyle=("[^"]*"|'[^']*')([^>]*)>/gi,
    "<$1$2$4>"
  );
  html = html.replace(
    /<div\b(?![^>]*\bdata-toc)([^>]*?)\sstyle=("[^"]*"|'[^']*')([^>]*)>/gi,
    "<div$1$3>"
  );
  html = html.replace(/<([a-z0-9]+)\s{2,}/gi, "<$1 ").replace(/\s+>/g, ">");
  for (let i = 0; i < 3; i++) {
    html = html
      .replace(/<(p|span|strong|em|b|i|u|s)>\s*(?:&nbsp;|\s)*<\/\1>/gi, "")
      .replace(/<p\b[^>]*>\s*(?:&nbsp;|<br\s*\/?>|\s)*<\/p>/gi, "");
  }
  html = html.replace(/(?:\s*<br\s*\/?>\s*){3,}/gi, "<br><br>");
  return html;
}

// 5. 連結正規化:站內絕對網址→相對;#錨點移除 target/rel(同頁滾動、不開新分頁)
function normalizeLinks(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (full, attrStr: string) => {
    const m = attrStr.match(/\bhref=(?:"([^"]*)"|'([^']*)')/i);
    if (!m) return full;
    const orig = m[1] ?? m[2] ?? "";
    let href = orig.replace(/^https?:\/\/(www\.)?(mifaso\.co|mifaso\.zeabur\.app)/i, "");
    if (href === "" && /^https?:\/\//i.test(orig)) href = "/";
    let rest = attrStr.replace(/\bhref=(?:"[^"]*"|'[^']*')/i, "");
    if (href.startsWith("#")) {
      rest = rest
        .replace(/\btarget=(?:"[^"]*"|'[^']*')/gi, "")
        .replace(/\brel=(?:"[^"]*"|'[^']*')/gi, "");
    }
    rest = rest.replace(/\s{2,}/g, " ").trim();
    return `<a href="${href}"${rest ? " " + rest : ""}>`;
  });
}

export interface TidyResult {
  html: string;
  fixedHeadings: number;
  removedTocs: number;
  removedRelated: number;
  changed: boolean;
}

export function tidyArticleContent(input: string): TidyResult {
  if (!input) return { html: input, fixedHeadings: 0, removedTocs: 0, removedRelated: 0, changed: false };

  const h = demoteLongHeadings(input);
  let html = h.html;

  const t = stripManualTocs(html);
  html = t.html;

  const r = stripRelatedReading(html);
  html = r.html;

  // 去掉既有 data-toc placeholder,稍後若原本有目錄再補一個乾淨的
  const hadPlaceholder = /<div\b[^>]*\bdata-toc[^>]*>\s*<\/div>/i.test(html);
  html = html.replace(/<div\b[^>]*\bdata-toc[^>]*>\s*<\/div>/gi, "");

  html = tidyStyles(html);
  html = normalizeLinks(html);

  if (t.n > 0 || hadPlaceholder) {
    html = PLACEHOLDER + "\n" + html;
  }
  html = html.trim();

  return {
    html,
    fixedHeadings: h.n,
    removedTocs: t.n,
    removedRelated: r.n,
    changed: html !== input,
  };
}
