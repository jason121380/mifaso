import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createHash } from "node:crypto";
import { mkdir, writeFile, access, readdir } from "node:fs/promises";
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

  // 健檢：確認執行時的實際路徑、能否寫入、寫入後是否服務得出來
  if (req.nextUrl.searchParams.get("check") === "1") {
    const info: Record<string, unknown> = {
      cwd: process.cwd(),
      uploadDir: UPLOAD_DIR,
    };
    try {
      await mkdir(UPLOAD_DIR, { recursive: true });
      const stamp = `healthcheck ${new Date().toISOString()}`;
      await writeFile(path.join(UPLOAD_DIR, "__healthcheck.txt"), stamp);
      info.wroteTestFile = true;
      info.testFileUrl = "/uploads/__healthcheck.txt";
      const files = await readdir(UPLOAD_DIR);
      info.fileCount = files.length;
      info.sampleFiles = files.slice(0, 8);
    } catch (e) {
      info.error = String(e);
    }
    return NextResponse.json({
      check: true,
      ...info,
      note: "接著開 https://(網域)/uploads/__healthcheck.txt：能看到 healthcheck 文字 = 路徑正確且服務得出來；404 = 路徑不對或 Volume 沒生效。",
    });
  }

  // 自動版：回傳一個會自己一批批跑到完的頁面
  if (req.nextUrl.searchParams.get("auto") === "1") {
    const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>圖片在地化</title>
<style>body{font-family:system-ui,-apple-system,"PingFang TC",sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#222}
h1{font-size:20px}#log{white-space:pre-wrap;background:#f6f6f6;border-radius:8px;padding:14px;font-size:13px;line-height:1.7;max-height:60vh;overflow:auto}
.b{font-weight:700}.ok{color:#15803d}.err{color:#b91c1c}</style></head>
<body><h1>圖片在地化進行中…</h1>
<p>請<span class="b">不要關閉這個分頁</span>，它會自己一批批跑到完。完成後會顯示「全部完成」。</p>
<div id="log">啟動中…\n</div>
<script>
const log=document.getElementById('log');
let totalDl=0,totalFail=0,round=0;
function add(t,c){const s=document.createElement('span');if(c)s.className=c;s.textContent=t+"\\n";log.appendChild(s);log.scrollTop=log.scrollHeight;}
async function tick(){
  round++;
  try{
    const r=await fetch('/api/localize-images?limit=25',{cache:'no-store'});
    const j=await r.json();
    if(j.error){add('錯誤：'+j.error,'err');return;}
    totalDl+=j.filesDownloaded||0; totalFail+=j.failed||0;
    add('第 '+round+' 批：本批下載 '+j.filesDownloaded+'、跳過 '+j.filesReused+'、失敗 '+j.failed+' ｜ 累計下載 '+totalDl+' 失敗 '+totalFail);
    if(j.done){add('✅ 全部完成！累計下載 '+totalDl+' 張，失敗 '+totalFail+'。可以關閉此頁，回前台重新整理確認。','ok');return;}
    setTimeout(tick,1200);
  }catch(e){
    add('這批連線中斷（進度已存，會自動重試）…','err');
    setTimeout(tick,3000);
  }
}
tick();
</script></body></html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
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
