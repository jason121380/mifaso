import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE = "https://mifaso.co";

interface WpPost {
  title: { rendered: string };
  content: { rendered: string };
  _embedded?: { "wp:featuredmedia"?: { source_url?: string }[] };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function loose(title: string): string {
  return decodeEntities(title.replace(/<[^>]*>/g, ""))
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

async function fetchAllPosts(): Promise<WpPost[]> {
  const all: WpPost[] = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${SITE}/wp-json/wp/v2/posts?per_page=100&page=${page}&_embed=wp:featuredmedia`;
    const res = await fetch(url, { headers: { "User-Agent": "mifaso-restore" } });
    if (res.status === 400 || res.status === 404) break;
    if (!res.ok) throw new Error(`WP API ${res.status} at page ${page}`);
    const batch = (await res.json()) as WpPost[];
    if (!batch.length) break;
    all.push(...batch);
    const totalPages = Number(res.headers.get("x-wp-totalpages") ?? "1");
    if (page >= totalPages) break;
  }
  return all;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ error: "需要以管理員身分登入後台後再開此連結" }, { status: 401 });
  }

  const dry = req.nextUrl.searchParams.get("dry") === "1";

  let posts: WpPost[];
  try {
    posts = await fetchAllPosts();
  } catch (e) {
    return NextResponse.json(
      { error: "抓取 mifaso.co 失敗（WordPress REST API 可能未開放）", detail: String(e) },
      { status: 502 }
    );
  }

  const byLoose = new Map<string, { img?: string; content: string }>();
  for (const p of posts) {
    byLoose.set(loose(p.title.rendered), {
      img: p._embedded?.["wp:featuredmedia"]?.[0]?.source_url,
      content: p.content?.rendered ?? "",
    });
  }

  const articles = await prisma.article.findMany({ select: { id: true, title: true } });

  const matched: { id: string; title: string; img?: string; content?: string; hasIg: boolean }[] = [];
  const unmatched: string[] = [];
  for (const a of articles) {
    const src = byLoose.get(loose(a.title));
    if (!src) { unmatched.push(a.title); continue; }
    const content = src.content && src.content.trim().length > 0 ? src.content : undefined;
    matched.push({
      id: a.id,
      title: a.title,
      img: src.img,
      content,
      hasIg: !!content && /instagram-media|instagram\.com/.test(content),
    });
  }

  const summary = {
    dryRun: dry,
    siteposts: posts.length,
    dbArticles: articles.length,
    matched: matched.length,
    unmatched,
    willUpdateImage: matched.filter((m) => m.img).length,
    willUpdateContent: matched.filter((m) => m.content).length,
    withInstagram: matched.filter((m) => m.hasIg).length,
  };

  if (dry) {
    return NextResponse.json({ ...summary, note: "這是預覽（dry=1），未寫入。確認後拿掉 ?dry=1 再開一次即實際還原。" });
  }

  let written = 0;
  for (const m of matched) {
    const data: { featuredImage?: string; content?: string } = {};
    if (m.img) data.featuredImage = m.img;
    if (m.content) data.content = m.content;
    if (Object.keys(data).length === 0) continue;
    await prisma.article.update({ where: { id: m.id }, data });
    written++;
  }

  return NextResponse.json({
    ...summary,
    written,
    done: `已還原 ${written} 篇（圖片 + 內文，含 IG 嵌入）。重新整理前台即可看到。`,
  });
}
