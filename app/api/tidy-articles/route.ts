import { NextRequest, NextResponse } from "next/server";
import { flushFront } from "@/lib/flush-cache";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { tidyArticleContent } from "@/lib/article-tidy";
import { saveBackups, restoreBackups, backupInfo } from "@/lib/content-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OP = "tidy";

// 整段只有一個失效 /article/<slug> 連結的 <p> → 移除(slug 不在已發布清單)
function stripDeadRelatedLinks(html: string, valid: Set<string>): { html: string; n: number } {
  let n = 0;
  const re =
    /<p\b[^>]*>\s*(?:<(?:strong|em|b|i)>\s*)*<a\b[^>]*\bhref="(\/article\/[^"]+)"[^>]*>[\s\S]*?<\/a>\s*(?:<\/(?:strong|em|b|i)>\s*)*<\/p>/gi;
  const out = html.replace(re, (full, href: string) => {
    const slug = decodeURIComponent(
      href.split("?")[0].split("#")[0].replace("/article/", "").replace(/\/$/, "")
    );
    if (!valid.has(slug)) { n++; return ""; }
    return full;
  });
  return { html: out, n };
}

interface Edit {
  id: string;
  title: string;
  before: string;
  next: string;
  fixedHeadings: number;
  removedTocs: number;
  removedRelated: number;
  removedDeadLinks: number;
}

async function collectEdits(): Promise<{ edits: Edit[]; total: number }> {
  const articles = await prisma.article.findMany({
    select: { id: true, title: true, content: true, slug: true, status: true },
  });
  const validSlugs = new Set(
    articles.filter((a) => a.status === "PUBLISHED").map((a) => a.slug)
  );
  const edits: Edit[] = [];
  for (const a of articles) {
    if (!a.content) continue;
    const r = tidyArticleContent(a.content);
    const dl = stripDeadRelatedLinks(r.html, validSlugs);
    const next = dl.html;
    if (next !== a.content) {
      edits.push({
        id: a.id,
        title: a.title ?? "",
        before: a.content,
        next,
        fixedHeadings: r.fixedHeadings,
        removedTocs: r.removedTocs,
        removedRelated: r.removedRelated,
        removedDeadLinks: dl.n,
      });
    }
  }
  return { edits, total: articles.length };
}

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return !!session?.user && role === "ADMIN";
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
  const { edits, total } = await collectEdits();
  const backup = await backupInfo(OP);
  return NextResponse.json({
    totalArticles: total,
    articlesChanged: edits.length,
    items: edits.map((e) => ({
      id: e.id,
      title: e.title.slice(0, 60),
      fixedHeadings: e.fixedHeadings,
      removedTocs: e.removedTocs,
      removedRelated: e.removedRelated,
      removedDeadLinks: e.removedDeadLinks,
      bytesBefore: e.before.length,
      bytesAfter: e.next.length,
    })),
    backup,
    note: "預覽(未寫入)。整理項目:修正異常標題、移除手動目錄統一自動目錄、移除延伸閱讀、清雜亂 inline style/空白/多餘 br、連結正規化。不改文字內容;勾選要整理的文章後按確認;可一鍵復原。",
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "需要管理員身分" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown) => typeof x === "string")
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "未選擇任何文章" }, { status: 400 });
  }
  const idSet = new Set(ids);
  const { edits } = await collectEdits();
  const sel = edits.filter((e) => idSet.has(e.id));
  if (sel.length > 0) {
    await saveBackups(OP, sel.map((e) => ({ articleId: e.id, content: e.before })));
    for (const e of sel) {
      await prisma.$executeRaw`UPDATE "articles" SET "content" = ${e.next} WHERE "id" = ${e.id}`;
    }
    await flushFront();
  }
  const backup = await backupInfo(OP);
  return NextResponse.json({
    executed: true,
    articlesChanged: sel.length,
    backup,
    note: `完成:整理了 ${sel.length} 篇。已備份原內容(可一鍵復原)、已清快取。`,
  });
}
