/**
 * 從原站 mifaso.co (WordPress) 用「標題」比對回資料庫的 88 篇，還原：
 *   1. featuredImage   → mifaso.co 上的真實精選圖片網址
 *   2. content         → 原站原始 HTML（含內嵌圖片與 Instagram 貼文）
 *
 * 文章頁已載入 https://www.instagram.com/embed.js，content 內若含
 * <blockquote class="instagram-media"> 就會自動渲染成 IG 貼文。
 * next.config.ts 已允許任意 https 圖源，無需改設定。
 *
 * 在「能連到 mifaso.co 且能連到資料庫」的環境執行（建議 Zeabur 該服務的 Terminal）：
 *
 *   預覽不寫入：      npx tsx scripts/fix-images-from-mifaso.ts --dry-run
 *   還原圖片+內文：    npx tsx scripts/fix-images-from-mifaso.ts
 *   同時更新 seed：    npx tsx scripts/fix-images-from-mifaso.ts --write-seed
 *   只還原圖片：       npx tsx scripts/fix-images-from-mifaso.ts --images-only
 *   只還原內文：       npx tsx scripts/fix-images-from-mifaso.ts --content-only
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const SITE = "https://mifaso.co";
const DRY_RUN = process.argv.includes("--dry-run");
const WRITE_SEED = process.argv.includes("--write-seed");
const IMAGES_ONLY = process.argv.includes("--images-only");
const CONTENT_ONLY = process.argv.includes("--content-only");
const DO_IMAGE = !CONTENT_ONLY;
const DO_CONTENT = !IMAGES_ONLY;

interface WpPost {
  title: { rendered: string };
  content: { rendered: string };
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
    const res = await fetch(url, { headers: { "User-Agent": "mifaso-restore" } });
    if (res.status === 400 || res.status === 404) break; // 超過頁數 WP 回 400
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
  console.log(`抓取 ${SITE} 文章（標題 / 精選圖 / 原始內文）…`);
  const posts = await fetchAllPosts();
  console.log(`原站文章數: ${posts.length}`);

  const byLoose = new Map<string, { img?: string; content: string }>();
  let igCount = 0;
  for (const p of posts) {
    const content = p.content?.rendered ?? "";
    if (/instagram-media|instagram\.com/.test(content)) igCount++;
    byLoose.set(loose(p.title.rendered), {
      img: p._embedded?.["wp:featuredmedia"]?.[0]?.source_url,
      content,
    });
  }
  console.log(`原站含 Instagram 嵌入的文章: ${igCount}`);

  const articles = await prisma.article.findMany({ select: { id: true, title: true } });
  console.log(`資料庫文章數: ${articles.length}`);

  const updates: { id: string; title: string; img?: string; content?: string; hasIg: boolean }[] = [];
  const unmatched: string[] = [];

  for (const a of articles) {
    const src = byLoose.get(loose(a.title));
    if (!src) { unmatched.push(a.title); continue; }
    const content = src.content && src.content.trim().length > 0 ? src.content : undefined;
    updates.push({
      id: a.id,
      title: a.title,
      img: DO_IMAGE ? src.img : undefined,
      content: DO_CONTENT ? content : undefined,
      hasIg: !!content && /instagram-media|instagram\.com/.test(content),
    });
  }

  const imgN = updates.filter((u) => u.img).length;
  const contentN = updates.filter((u) => u.content).length;
  const igN = updates.filter((u) => u.hasIg).length;
  console.log(
    `\n比對: 對到 ${updates.length}/${articles.length}，未對到 ${unmatched.length}` +
      `\n  將更新 featuredImage: ${imgN} 篇` +
      `\n  將還原 content:      ${contentN} 篇（其中含 IG 嵌入: ${igN} 篇）`
  );
  if (unmatched.length) {
    console.log("未對到的標題（需人工處理）:");
    unmatched.forEach((t) => console.log("  - " + t));
  }

  if (DRY_RUN) {
    console.log("\n[--dry-run] 不寫入。範例前 3 筆:");
    updates.slice(0, 3).forEach((u) =>
      console.log(`  ${u.title.slice(0, 22)} | img=${u.img ? "Y" : "-"} content=${u.content ? "Y" : "-"} ig=${u.hasIg ? "Y" : "-"}`)
    );
    return;
  }

  let written = 0;
  for (const u of updates) {
    const data: { featuredImage?: string; content?: string } = {};
    if (u.img) data.featuredImage = u.img;
    if (u.content) data.content = u.content;
    if (Object.keys(data).length === 0) continue;
    await prisma.article.update({ where: { id: u.id }, data });
    written++;
  }
  console.log(`\n✅ 已更新資料庫 ${written} 篇（featuredImage: ${imgN}，content: ${contentN}）`);
  console.log("   IG 貼文：文章頁已載入 instagram embed.js，重新整理即會渲染。");

  if (WRITE_SEED) {
    const seedPath = path.join(__dirname, "seed-data", "articles.json");
    const seed = JSON.parse(fs.readFileSync(seedPath, "utf-8")) as {
      id: string;
      featuredImage: string | null;
      content: string;
    }[];
    const map = new Map(updates.map((u) => [u.id, u]));
    let n = 0;
    for (const s of seed) {
      const u = map.get(s.id);
      if (!u) continue;
      if (u.img) s.featuredImage = u.img;
      if (u.content) s.content = u.content;
      if (u.img || u.content) n++;
    }
    fs.writeFileSync(seedPath, JSON.stringify(seed) + "\n");
    console.log(`✅ 已同步更新 scripts/seed-data/articles.json（${n} 筆），未來重新 seed 也正確`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
