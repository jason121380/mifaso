import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE = "https://mifaso.co";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

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

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url} :: ${text.slice(0, 120)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`非 JSON 回應 @ ${url} (status ${res.status}) :: ${text.slice(0, 120)}`);
  }
}

async function fetchAllPosts(): Promise<WpPost[]> {
  const bases = [
    (p: number) => `${SITE}/wp-json/wp/v2/posts?per_page=100&page=${p}&_embed=wp:featuredmedia`,
    (p: number) => `${SITE}/?rest_route=/wp/v2/posts&per_page=100&page=${p}&_embed=wp:featuredmedia`,
  ];
  let lastErr: unknown;
  for (const mk of bases) {
    try {
      const all: WpPost[] = [];
      for (let page = 1; page <= 20; page++) {
        const res = await fetch(mk(page), { headers: { "User-Agent": UA, Accept: "application/json" } });
        if (res.status === 400 || res.status === 404) break;
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status} :: ${text.slice(0, 120)}`);
        const batch = JSON.parse(text) as WpPost[];
        if (!batch.length) break;
        all.push(...batch);
        const totalPages = Number(res.headers.get("x-wp-totalpages") ?? "1");
        if (page >= totalPages) break;
      }
      if (all.length) return all;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("WP REST 兩種寫法都失敗");
}

async function probe(url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    const body = await res.text();
    return {
      url,
      status: res.status,
      contentType: res.headers.get("content-type"),
      finalUrl: res.url,
      length: body.length,
      snippet: body.slice(0, 300),
    };
  } catch (e) {
    return { url, error: String(e) };
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ error: "需要以管理員身分登入後台後再開此連結" }, { status: 401 });
  }

  // 診斷模式：回報各候選來源實際拿到什麼
  if (req.nextUrl.searchParams.get("diag") === "1") {
    const targets = [
      `${SITE}/wp-json/wp/v2/posts?per_page=1`,
      `${SITE}/?rest_route=/wp/v2/posts&per_page=1`,
      `${SITE}/wp-json/`,
      `${SITE}/feed/?paged=1`,
      `${SITE}/wp-sitemap.xml`,
      `${SITE}/sitemap_index.xml`,
      `${SITE}/sitemap.xml`,
      `${SITE}/`,
    ];
    const results = [];
    for (const t of targets) results.push(await probe(t));
    return NextResponse.json({ diag: true, results }, { status: 200 });
  }

  const dry = req.nextUrl.searchParams.get("dry") === "1";

  let posts: WpPost[];
  try {
    posts = await fetchAllPosts();
  } catch (e) {
    return NextResponse.json(
      {
        error: "抓取 mifaso.co 失敗",
        detail: String(e),
        hint: "在這個網址後面改成 ?diag=1 重開一次，把回傳結果貼給我，我再換抓法。",
      },
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
    return NextResponse.json({ ...summary, note: "預覽（dry=1），未寫入。確認後拿掉 ?dry=1 再開一次即實際還原。" });
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
