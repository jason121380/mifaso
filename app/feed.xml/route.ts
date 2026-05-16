import prisma from "@/lib/prisma";
import { SITE_URL, SITE_NAME, SITE_DESC } from "@/lib/seo";
import { stripHtml, truncate } from "@/lib/utils";

export const revalidate = 3600;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  let articles: {
    slug: string;
    title: string;
    excerpt: string | null;
    content: string;
    publishedAt: Date | null;
    updatedAt: Date;
  }[] = [];
  try {
    articles = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        publishedAt: true,
        updatedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 30,
    });
  } catch {
    // db unavailable during build
  }

  const items = articles
    .map((a) => {
      const url = `${SITE_URL}/article/${a.slug}`;
      const desc = truncate(stripHtml(a.excerpt ?? a.content), 300);
      const date = (a.publishedAt ?? a.updatedAt).toUTCString();
      return `<item><title>${esc(a.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${date}</pubDate><description>${esc(desc)}</description></item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(SITE_NAME)}</title><link>${SITE_URL}</link><description>${esc(SITE_DESC)}</description><language>zh-TW</language><atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
