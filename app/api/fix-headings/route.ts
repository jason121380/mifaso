import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { saveBackups, restoreBackups, backupInfo } from "@/lib/content-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OP = "fixheadings";
// 標題正常很短;純文字超過此長度幾乎都是「內文被誤包成標題」(匯入/編輯出錯)
const MAX_HEADING_LEN = 80;
const RE = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;

function stripText(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

interface Edit { id: string; title: string; before: string; next: string; fixed: number; sample: string }

async function collectEdits(): Promise<{ edits: Edit[]; total: number }> {
  const articles = await prisma.article.findMany({ select: { id: true, title: true, content: true } });
  const edits: Edit[] = [];
  for (const a of articles) {
    if (!a.content) continue;
    let fixed = 0;
    let sample = "";
    const next = a.content.replace(RE, (full, lvl: string, attrs: string, inner: string) => {
      const t = stripText(inner);
      if (t.length > MAX_HEADING_LEN) {
        fixed++;
        if (!sample) sample = t.slice(0, 80);
        return `<p${attrs}>${inner}</p>`;
      }
      return full;
    });
    if (fixed > 0 && next !== a.content) {
      edits.push({ id: a.id, title: a.title ?? "", before: a.content, next, fixed, sample });
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
    if (n > 0) revalidatePath("/", "layout");
    return NextResponse.json({
      restored: true,
      restoredArticles: n,
      note: n > 0 ? `已復原 ${n} 篇文章。已清快取。` : "沒有可復原的備份。",
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
      fixed: e.fixed,
      sample: e.sample,
      bytesBefore: e.before.length,
      bytesAfter: e.next.length,
    })),
    backup,
    note: "預覽(未寫入)。把「純文字過長(>80字)的標題」降級為段落,讓它不再被當標題/目錄。勾選要修的文章後按確認;只改這些異常標題,其他不動;可一鍵復原。",
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
  let fixed = 0;
  if (sel.length > 0) {
    await saveBackups(OP, sel.map((e) => ({ articleId: e.id, content: e.before })));
    for (const e of sel) {
      await prisma.$executeRaw`UPDATE "articles" SET "content" = ${e.next} WHERE "id" = ${e.id}`;
      fixed += e.fixed;
    }
    revalidatePath("/", "layout");
  }
  const backup = await backupInfo(OP);
  return NextResponse.json({
    executed: true,
    articlesChanged: sel.length,
    headingsFixed: fixed,
    backup,
    note: `完成:修正 ${sel.length} 篇、${fixed} 個異常標題(降級為段落)。已備份(可一鍵復原)、已清快取。`,
  });
}
