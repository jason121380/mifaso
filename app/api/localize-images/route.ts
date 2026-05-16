import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createHash } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const DEFAULT_LIMIT = 20; // 每次請求最多下載這麼多張新圖（避免閘道 timeout / OOM）

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
};

function isExternal(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

function contentImageUrls(html: string | null): string[] {
  if (!html) return [];
  const out = new Set<string>();
  const re = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.add(m[1]);
  return [...out];
}

function localNameFor(url: string, contentType: string | null): string {
  const hash = createHash("md5").update(url).digest("hex").slice(0, 10);
  let base = "img";
  try {
    base = decodeURIComponent(path.basename(new URL(url).pathname)) || "img";
  } catch {
    /* keep default */
  }
  base = base.replace(/[^\w.\-]+/g, "_").replace(/_{2,}/g, "_").slice(-60);
  let ext = path.extname(base).toLowerCase();
  if (!ext && contentType) ext = EXT_BY_TYPE[contentType.split(";")[0].trim()] ?? "";
  if (!ext) ext = ".jpg";
  if (path.extname(base).toLowerCase() !== ext) base += ext;
  return `${hash}_${base}`;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ error: "需要以管理員身分登入後台後再開此連結" }, { status: 401 });
  }

  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const limit = Math.max(
    1,
    Math.min(100, Number(req.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT))
  );

  const articles = await prisma.article.findMany({
    select: { id: true, featuredImage: true, content: true },
    orderBy: { id: "asc" },
  });

  // 預覽：只算數量，不連網，秒回
  if (dry) {
    let extFeatured = 0;
    const extUrls = new Set<string>();
    for (const a of articles) {
      if (isExternal(a.featuredImage)) {
        extFeatured++;
        extUrls.add(a.featuredImage);
      }
      for (const u of contentImageUrls(a.content)) extUrls.add(u);
    }
    return NextResponse.json({
      dryRun: true,
      dbArticles: articles.length,
      externalFeaturedImages: extFeatured,
      uniqueExternalImageUrls: extUrls.size,
      note: `共約 ${extUrls.size} 張外部圖要在地化。實際執行請拿掉 ?dry=1，每次最多處理 ${DEFAULT_LIMIT} 張，重複開同一網址直到 done:true。`,
    });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  let downloaded = 0;
  let reused = 0;
  let failed = 0;
  const errors: string[] = [];
  let articlesUpdated = 0;
  let budgetLeft = limit;
  let moreRemaining = false;

  for (const a of articles) {
    if (budgetLeft <= 0) {
      // 還有文章沒檢查 → 仍可能有未處理的圖
      moreRemaining = true;
      break;
    }

    const data: { featuredImage?: string; content?: string } = {};
    let newContent = a.content ?? "";

    const jobs: { url: string; kind: "featured" | "content" }[] = [];
    if (isExternal(a.featuredImage)) jobs.push({ url: a.featuredImage, kind: "featured" });
    for (const u of contentImageUrls(a.content)) jobs.push({ url: u, kind: "content" });

    for (const job of jobs) {
      if (budgetLeft <= 0) {
        moreRemaining = true;
        break;
      }
      try {
        const probe = await fetch(job.url, { method: "GET", headers: { "User-Agent": UA } });
        if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
        const ct = probe.headers.get("content-type");
        const name = localNameFor(job.url, ct);
        const dest = path.join(UPLOAD_DIR, name);
        const local = `/uploads/${name}`;

        if (await exists(dest)) {
          reused++;
        } else {
          const buf = Buffer.from(await probe.arrayBuffer());
          await writeFile(dest, buf);
          downloaded++;
          budgetLeft--;
        }

        if (job.kind === "featured") data.featuredImage = local;
        else newContent = newContent.split(job.url).join(local);
      } catch (e) {
        failed++;
        if (errors.length < 15) errors.push(`${job.url} :: ${String(e)}`);
      }
    }

    if (newContent !== (a.content ?? "")) data.content = newContent;
    if (Object.keys(data).length > 0) {
      await prisma.article.update({ where: { id: a.id }, data });
      articlesUpdated++;
    }
  }

  // 若沒提早 break，再確認是否真的全部處理完
  if (!moreRemaining) {
    const stillExternal = await prisma.article.count({
      where: { featuredImage: { startsWith: "http" } },
    });
    moreRemaining = stillExternal > 0;
  }

  return NextResponse.json({
    dryRun: false,
    batchLimit: limit,
    filesDownloaded: downloaded,
    filesReused: reused,
    failed,
    errorsSample: errors,
    articlesUpdated,
    done: !moreRemaining,
    note: moreRemaining
      ? "這批完成，還有圖沒處理完 → 再開一次「同一個網址」繼續（可重複多次，已下載的會跳過）。"
      : "全部完成！圖片已在地化到 /uploads。重新整理前台確認，確認 OK 後 mifaso.co 才可安全刪除。",
  });
}
