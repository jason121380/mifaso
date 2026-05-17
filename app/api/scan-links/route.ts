import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugify(raw: string): string {
  return (
    raw
      .replace(/<[^>]*>/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s　]+/g, "-")
      .replace(/[^\p{L}\p{N}-]/gu, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "section"
  );
}

/** 收集文章內可作為錨點目標的 id 集合(明確 id + 標題自動 slug) */
function anchorIds(content: string): Set<string> {
  const ids = new Set<string>();
  for (const m of content.matchAll(/\sid=["']([^"']+)["']/gi)) ids.add(m[1]);
  for (const m of content.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = m[2].replace(/<[^>]*>/g, "").trim();
    if (text) ids.add(slugify(text));
  }
  return ids;
}

interface Bad {
  articleId: string;
  title: string;
  slug: string;
  href: string;
  text: string;
  type: string;
  reason: string;
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理員身分登入後台後再開此連結" }, { status: 401 });
  }

  const [articles, cats] = await Promise.all([
    prisma.article.findMany({ select: { id: true, slug: true, title: true, content: true, status: true } }),
    prisma.category.findMany({ select: { slug: true } }),
  ]);

  const articleSlugs = new Set(
    articles.filter((a) => a.status === "PUBLISHED").map((a) => a.slug)
  );
  const categorySlugs = new Set(cats.map((c) => c.slug));

  const bad: Bad[] = [];
  const counts: Record<string, number> = {};
  let totalLinks = 0;
  const LIMIT = 400;

  for (const a of articles) {
    if (!a.content) continue;
    const ids = anchorIds(a.content);
    for (const m of a.content.matchAll(/<a\b[^>]*\bhref=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      totalLinks++;
      const href = m[1].trim();
      const text = m[2].replace(/<[^>]*>/g, "").trim().slice(0, 60);
      let type = "";
      let reason = "";

      if (href === "" || href === "#") {
        type = "empty"; reason = "空連結 / 只有 #";
      } else if (/^javascript:/i.test(href)) {
        type = "javascript"; reason = "javascript: 連結";
      } else if (href.startsWith("#")) {
        const id = decodeURIComponent(href.slice(1));
        if (!ids.has(id)) { type = "anchor"; reason = `頁內錨點 #${id} 找不到對應標題`; }
      } else if (href.startsWith("//")) {
        type = "protocol-relative"; reason = "協定相對連結(//),建議改 https://";
      } else if (/^http:\/\//i.test(href)) {
        type = "insecure"; reason = "http:// 連結(混合內容,建議改 https://)";
      } else if (href.startsWith("/article/")) {
        const slug = decodeURIComponent(href.split("?")[0].split("#")[0].replace("/article/", "").replace(/\/$/, ""));
        if (!articleSlugs.has(slug)) { type = "dead-internal"; reason = `站內文章連結失效:/article/${slug}`; }
      } else if (href.startsWith("/category/")) {
        const slug = decodeURIComponent(href.split("?")[0].replace("/category/", "").replace(/\/$/, ""));
        if (!categorySlugs.has(slug)) { type = "dead-internal"; reason = `站內分類連結失效:/category/${slug}`; }
      }

      if (type) {
        counts[type] = (counts[type] ?? 0) + 1;
        if (bad.length < LIMIT) {
          bad.push({ articleId: a.id, title: (a.title ?? "").slice(0, 40), slug: a.slug, href, text, type, reason });
        }
      }
    }
  }

  return NextResponse.json({
    scanLinks: true,
    scannedArticles: articles.length,
    totalLinks,
    issues: bad.length,
    truncated: Object.values(counts).reduce((s, n) => s + n, 0) > LIMIT,
    counts,
    items: bad,
    note:
      "靜態掃描(不檢查外部站是否存活):列出空/javascript:/協定相對/http 混合內容、頁內錨點對不到標題、站內 /article、/category 連結失效。外部 https 連結不在此檢查範圍。",
  });
}
