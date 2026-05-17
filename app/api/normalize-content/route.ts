import { NextRequest, NextResponse } from "next/server";
import { flushFront } from "@/lib/flush-cache";
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
async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return !!session?.user && role === "ADMIN";
}

interface Edit { id: string; title: string; before: string; next: string; removed: number }

async function collectEdits(): Promise<{ edits: Edit[]; tocsRemoved: number; total: number }> {
  const articles = await prisma.article.findMany({
    select: { id: true, title: true, content: true },
  });
  const edits: Edit[] = [];
  let tocsRemoved = 0;
  for (const a of articles) {
    if (!a.content) continue;
    const before = a.content;
    const { html: noToc, removed } = stripManualTocs(before);
    let next = noToc;
    const placeholders = (next.match(/<div\b[^>]*\bdata-toc[^>]*>\s*<\/div>/gi) || []).length;
    const hadAnyToc = removed > 0 || placeholders > 0;
    next = next.replace(/<div\b[^>]*\bdata-toc[^>]*>\s*<\/div>/gi, "");
    if (hadAnyToc) next = PLACEHOLDER + "\n" + next;
    if (next !== before) {
      tocsRemoved += removed;
      edits.push({ id: a.id, title: a.title ?? "", before, next, removed });
    }
  }
  return { edits, tocsRemoved, total: articles.length };
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員身分登入後台後再開此連結" }, { status: 401 });
  }

  if (req.nextUrl.searchParams.get("restore") === "1") {
    const n = await restoreBackups(OP);
    if (n > 0) await flushFront();
    return NextResponse.json({
      restored: true,
      restoredArticles: n,
      note: n > 0 ? `已復原 ${n} 篇文章到整理前的內容。已清快取。` : "沒有可復原的備份。",
    });
  }

  const { edits, tocsRemoved, total } = await collectEdits();
  const backup = await backupInfo(OP);
  return NextResponse.json({
    normalizeContent: true,
    executed: false,
    totalArticles: total,
    articlesChanged: edits.length,
    manualTocsRemoved: tocsRemoved,
    items: edits.map((e) => ({
      id: e.id,
      title: e.title.slice(0, 60),
      tocRemoved: e.removed,
      bytesBefore: e.before.length,
      bytesAfter: e.next.length,
    })),
    backup,
    note: "預覽模式(未寫入)。勾選要重做目錄的文章後按「確認整理」;只動目錄、不改其他內容;執行後可用「復原上次整理」還原。",
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員身分" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "未選擇任何文章" }, { status: 400 });
  }
  const idSet = new Set(ids);
  const { edits } = await collectEdits();
  const sel = edits.filter((e) => idSet.has(e.id));
  let removed = 0;
  if (sel.length > 0) {
    await saveBackups(OP, sel.map((e) => ({ articleId: e.id, content: e.before })));
    for (const e of sel) {
      await prisma.$executeRaw`UPDATE "articles" SET "content" = ${e.next} WHERE "id" = ${e.id}`;
      removed += e.removed;
    }
    await flushFront();
  }
  const backup = await backupInfo(OP);
  return NextResponse.json({
    executed: true,
    articlesChanged: sel.length,
    manualTocsRemoved: removed,
    backup,
    note: `完成:重做了 ${sel.length} 篇的目錄(移除 ${removed} 個手動目錄)。內文其他內容未變。已備份(可一鍵復原)、已清快取。`,
  });
}
