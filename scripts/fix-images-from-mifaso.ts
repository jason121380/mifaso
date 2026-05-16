/**
 * 從原站 mifaso.co (WordPress) 抓每篇的精選圖片，用「標題」比對回資料庫的 88 篇，
 * 把 featuredImage 從無效的 /uploads/... 改成 mifaso.co 上的真實圖片網址。
 *
 * 在「能連到 mifaso.co 且能連到資料庫」的環境執行（建議 Zeabur 該服務的 Terminal）：
 *
 *   預覽不寫入：   npx tsx scripts/fix-images-from-mifaso.ts --dry-run
 *   實際更新 DB：  npx tsx scripts/fix-images-from-mifaso.ts
 *   同時更新 seed： npx tsx scripts/fix-images-from-mifaso.ts --write-seed
 *
 * next.config.ts 已允許任意 https 圖源，無需改設定。
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const SITE = "https://mifaso.co";
const DRY_RUN = process.argv.includes("--dry-run");
const WRITE_SEED = process.argv.includes("--write-seed");

interface WpPost {
  title: { rendered: string };
  date: string;
  link: string;
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

/** 寬鬆比對鍵：去 HTML、解 entity、去所有非中英數字元、轉小寫 */
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
    const res = await fetch(url, { headers: { "User-Agent": "mifaso-image-fix" } });
    if (res.status === 400 || res.status === 404) break; // 超過頁數 WP 會回 400
    if (!res.ok) throw new Error(`WP API ${res.status} at page ${page}: ${await res.text()}`);
    const batch = (await res.json()) as WpPost[];
    if (!batch.length) break;
    all.push(...batch);
    const totalPages = Number(res.headers.get("x-wp-totalpages") ?? "1");
    if (page >= totalPages) break;
  }
  return all;
}

async function main() {
  console.log(`抓取 ${SITE} 文章清單…`);
  const posts = await fetchAllPosts();
  console.log(`原站文章數: ${posts.length}`);

  const byLoose = new Map<string, string>();
  for (const p of posts) {
    const img = p._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
    if (img) byLoose.set(loose(p.title.rendered), img);
  }
  console.log(`其中有精選圖片的: ${byLoose.size}`);

  const articles = await prisma.article.findMany({ select: { id: true, slug: true, title: true } });
  console.log(`資料庫文章數: ${articles.length}`);

  const updates: { id: string; title: string; url: string }[] = [];
  const unmatched: string[] = [];

  for (const a of articles) {
    const url = byLoose.get(loose(a.title));
    if (url) updates.push({ id: a.id, title: a.title, url });
    else unmatched.push(a.title);
  }

  console.log(`\n比對結果: 對到 ${updates.length} / ${articles.length}，未對到 ${unmatched.length}`);
  if (unmatched.length) {
    console.log("未對到的標題（需人工處理）:");
    unmatched.forEach((t) => console.log("  - " + t));
  }

  if (DRY_RUN) {
    console.log("\n[--dry-run] 不寫入。範例前 5 筆:");
    updates.slice(0, 5).forEach((u) => console.log(`  ${u.title.slice(0, 24)} -> ${u.url}`));
    return;
  }

  for (const u of updates) {
    await prisma.article.update({ where: { id: u.id }, data: { featuredImage: u.url } });
  }
  console.log(`\n✅ 已更新資料庫 ${updates.length} 篇的 featuredImage`);

  if (WRITE_SEED) {
    const seedPath = path.join(__dirname, "seed-data", "articles.json");
    const seed = JSON.parse(fs.readFileSync(seedPath, "utf-8")) as { id: string; featuredImage: string | null }[];
    const map = new Map(updates.map((u) => [u.id, u.url]));
    let n = 0;
    for (const s of seed) {
      const url = map.get(s.id);
      if (url) { s.featuredImage = url; n++; }
    }
    fs.writeFileSync(seedPath, JSON.stringify(seed) + "\n");
    console.log(`✅ 已同步更新 scripts/seed-data/articles.json（${n} 筆），未來重新 seed 也會正確`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
