import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 移除文章內文中的「延伸閱讀」段落(整個 <p>...延伸閱讀...</p>,含其中連結;
 * 若推薦連結被放在「延伸閱讀:」的下一個 <p>,也一併移除)。
 * 用 raw SQL 更新 content,不動 Prisma @updatedAt。
 * 需 ADMIN 登入。預設只預覽;加 ?run=1 才實際寫入(重跑為 no-op,安全)。
 */
const RE =
  /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?延伸閱讀[\s\S]*?<\/p>(?:\s*<p\b[^>]*>(?:\s|<strong>|<em>|<b>|<i>)*<a\b[\s\S]*?<\/a>(?:\s|<\/strong>|<\/em>|<\/b>|<\/i>)*<\/p>)?/gi;

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理員身分登入後台後再開此連結" }, { status: 401 });
  }

  const run = req.nextUrl.searchParams.get("run") === "1";

  const articles = await prisma.article.findMany({
    select: { id: true, title: true, content: true },
  });

  let changed = 0;
  let removedParagraphs = 0;
  const sample: { title: string; removed: string[] }[] = [];

  for (const a of articles) {
    if (!a.content) continue;
    const matches = a.content.match(RE);
    if (!matches || matches.length === 0) continue;

    removedParagraphs += matches.length;
    const next = a.content.replace(RE, "").replace(/(\s*<p>\s*<\/p>\s*)+/gi, "");

    if (sample.length < 5) {
      sample.push({
        title: (a.title ?? "").slice(0, 30),
        removed: matches.map((m) => m.replace(/<[^>]+>/g, "").trim().slice(0, 80)),
      });
    }

    if (run) {
      await prisma.$executeRaw`UPDATE "articles" SET "content" = ${next} WHERE "id" = ${a.id}`;
    }
    changed++;
  }

  if (run && changed > 0) {
    // 文章頁是 ISR(revalidate=300),改完要主動清快取才會即時更新
    revalidatePath("/", "layout");
  }

  return NextResponse.json({
    stripRelatedReading: true,
    executed: run,
    revalidated: run && changed > 0,
    totalArticles: articles.length,
    articlesAffected: changed,
    paragraphsRemoved: removedParagraphs,
    sample,
    note: run
      ? `完成:已從 ${changed} 篇移除 ${removedParagraphs} 個「延伸閱讀」段落。已清快取,前台稍候(或強制重整)即更新。`
      : "預覽模式(未寫入)。確認上方 sample 是要刪的內容後,在網址後面加 ?run=1 再開一次即實際移除。",
  });
}
