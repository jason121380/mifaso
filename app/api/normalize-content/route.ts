import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { saveBackups, restoreBackups, backupInfo } from "@/lib/content-backup";

const OP = "normalize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 全文樣式整齊 + 目錄統一:
 *  - 移除手動 / WP 舊版「本文目錄」(table / 非 data-toc 的 div / 標題+ul / p+ul / 單獨 p)
 *  - 原本有目錄者統一插入一個 <div data-toc="true">(前台自動產生目錄);多餘的 data-toc 去重
 *  - 整理:移除文字標籤(p/span/h1-6/li/a/strong/em…)的 inline style、空標籤、過多 <br>
 * 不動 IG blockquote / img / iframe / table 的 style。raw SQL 更新不動 updatedAt。
 * 需 ADMIN;預設預覽,?run=1 才寫入。
 */

const PLACEHOLDER = '<div data-toc="true"></div>';

function stripManualTocs(html: string): { html: string; removed: number } {
  let removed = 0;
  const patterns: RegExp[] = [
    /<table\b[^>]*>(?:(?!<\/table>)[\s\S])*?本文目錄[\s\S]*?<\/table>/gi,
    /<h[1-6]\b[^>]*>(?:(?!<\/h[1-6]>)[\s\S])*?本文目錄[\s\S]*?<\/h[1-6]>\s*<ul\b[\s\S]*?<\/ul>/gi,
    /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?本文目錄[\s\S]*?<\/p>\s*<ul\b[\s\S]*?<\/ul>/gi,
    // 安全版:不可有巢狀 div、長度有上限,只吃真正的 TOC 小區塊(不會吃到內文容器)
    /<div\b(?![^>]*\bdata-toc)[^>]*>(?:(?!<\/?div\b)[\s\S]){0,1200}?本文目錄(?:(?!<\/?div\b)[\s\S]){0,2500}?<\/div>/gi,
    /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?本文目錄[\s\S]*?<\/p>/gi,
  ];
  for (const re of patterns) {
    html = html.replace(re, () => {
      removed++;
      return "";
    });
  }
  return { html, removed };
}

function tidy(html: string): string {
  // 文字級標籤移除 inline style(保留 img/iframe/table/figure/blockquote 的 style)
  html = html.replace(
    /<(p|span|li|strong|em|u|s|a|h[1-6])\b([^>]*?)\sstyle=("[^"]*"|'[^']*')([^>]*)>/gi,
    "<$1$2$4>"
  );
  html = html.replace(
    /<div\b(?![^>]*\bdata-toc)([^>]*?)\sstyle=("[^"]*"|'[^']*')([^>]*)>/gi,
    "<div$1$3>"
  );
  // class 殘留(對齊 class 留著,前台已 RWD 中和;這裡只清空 style 後留下的雙空白)
  html = html.replace(/<([a-z0-9]+)\s{2,}/gi, "<$1 ").replace(/\s+>/g, ">");
  // 空的內聯/段落標籤
  for (let i = 0; i < 3; i++) {
    html = html
      .replace(/<(p|span|strong|em|b|i|u|s)>\s*(?:&nbsp;| |\s)*<\/\1>/gi, "")
      .replace(/<p\b[^>]*>\s*(?:&nbsp;| |<br\s*\/?>|\s)*<\/p>/gi, "");
  }
  // 過多換行
  html = html.replace(/(?:\s*<br\s*\/?>\s*){3,}/gi, "<br><br>");
  return html.trim();
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理員身分登入後台後再開此連結" }, { status: 401 });
  }
  const run = req.nextUrl.searchParams.get("run") === "1";
  const restore = req.nextUrl.searchParams.get("restore") === "1";

  if (restore) {
    const n = await restoreBackups(OP);
    if (n > 0) revalidatePath("/", "layout");
    return NextResponse.json({
      restored: true,
      restoredArticles: n,
      note: n > 0 ? `已復原 ${n} 篇文章到整理前的內容。已清快取。` : "沒有可復原的備份。",
    });
  }

  const articles = await prisma.article.findMany({
    select: { id: true, title: true, content: true },
  });

  let tocsRemoved = 0;
  const sample: { title: string; tocRemoved: number; bytesBefore: number; bytesAfter: number }[] = [];
  const edits: { id: string; before: string; next: string }[] = [];

  for (const a of articles) {
    if (!a.content) continue;
    const before = a.content;

    const { html: noToc, removed } = stripManualTocs(before);
    let next = noToc;

    const placeholders = (next.match(/<div\b[^>]*\bdata-toc[^>]*>\s*<\/div>/gi) || []).length;
    const hadAnyToc = removed > 0 || placeholders > 0;

    // 去除所有既有 placeholder,稍後若需要再補一個乾淨的
    next = next.replace(/<div\b[^>]*\bdata-toc[^>]*>\s*<\/div>/gi, "");

    next = tidy(next);

    if (hadAnyToc) {
      next = PLACEHOLDER + "\n" + next;
    }

    if (next !== before) {
      tocsRemoved += removed;
      edits.push({ id: a.id, before, next });
      if (sample.length < 5) {
        sample.push({
          title: (a.title ?? "").slice(0, 36),
          tocRemoved: removed,
          bytesBefore: before.length,
          bytesAfter: next.length,
        });
      }
    }
  }

  if (run && edits.length > 0) {
    // 先整批備份原始內容(可一鍵復原),再寫入
    await saveBackups(OP, edits.map((e) => ({ articleId: e.id, content: e.before })));
    for (const e of edits) {
      await prisma.$executeRaw`UPDATE "articles" SET "content" = ${e.next} WHERE "id" = ${e.id}`;
    }
    revalidatePath("/", "layout");
  }

  const backup = await backupInfo(OP);

  return NextResponse.json({
    normalizeContent: true,
    executed: run,
    revalidated: run && edits.length > 0,
    totalArticles: articles.length,
    articlesChanged: edits.length,
    manualTocsRemoved: tocsRemoved,
    sample,
    backup,
    note: run
      ? `完成:整理了 ${edits.length} 篇,移除 ${tocsRemoved} 個手動目錄並統一為自動目錄。已備份原內容(可一鍵復原)、已清快取。`
      : "預覽模式(未寫入)。確認 sample 後按「確認整理」即執行;執行後可用「復原上次整理」還原。",
  });
}
