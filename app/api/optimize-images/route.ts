import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * 一次性維運工具：把本機 /uploads 的 jpg/png 原圖「縮到 1600px + 轉 webp」,
 * 並改寫 DB（featuredImage / 內文 <img> / 媒體庫 url）指向新 .webp。
 *
 * 為什麼不用 next/image 即時最佳化：機器記憶體小,runtime 用 sharp 即時壓會 OOM
 * （next.config.ts images.unoptimized=true 就是這個原因）。改成「離線批次壓好存起來」,
 * 一次一張循序處理,記憶體峰值低,不會 OOM。原圖保留不刪（安全,可隨時回退）。
 *
 * 必要條件：ADMIN 登入 + MAINT_TOOLS=1。
 *   ?dry=1   只統計要壓幾張,不動檔。
 *   ?auto=1  回傳會自己一批批跑到完的進度頁（放著別關）。
 *   ?limit   單批最多壓幾張（預設 12,上限 40;sharp 吃 CPU,別調太高）。
 *
 * 用完務必移除 MAINT_TOOLS。
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_WIDTH = 1600;
const QUALITY = 80;
const DEFAULT_LIMIT = 12;
const RASTER = /\.(jpe?g|png)$/i;

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// /uploads/<rel> → 本機磁碟絕對路徑（含解碼 + 防目錄穿越）
function destFor(uploadPath: string): string | null {
  const rel = uploadPath.replace(/^\/uploads\//, "");
  let decoded = rel;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    /* 保留原樣 */
  }
  const base = path.resolve(UPLOAD_DIR);
  const target = path.resolve(base, decoded);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

function isConvertible(p: string | null | undefined): p is string {
  return !!p && p.startsWith("/uploads/") && RASTER.test(p);
}

function webpPathFor(uploadPath: string): string {
  return uploadPath.replace(RASTER, ".webp");
}

function contentImagePaths(html: string | null): string[] {
  if (!html) return [];
  const out = new Set<string>();
  const re = /\/uploads\/[^\s"'<>)]+?\.(?:jpe?g|png)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.add(m[0]);
  return [...out];
}

async function toWebp(srcAbs: string, outAbs: string): Promise<void> {
  await sharp(srcAbs)
    .rotate() // 依 EXIF 方向修正後再去掉方位資訊
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(outAbs);
}

export async function GET(req: NextRequest) {
  if (process.env.MAINT_TOOLS !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json(
      { error: "需要以管理員身分登入後台後再開此連結" },
      { status: 401 }
    );
  }

  // 預覽：算數量,不壓圖
  if (req.nextUrl.searchParams.get("dry") === "1") {
    const articles = await prisma.article.findMany({
      select: { featuredImage: true, content: true },
    });
    const media = await prisma.media.findMany({ select: { url: true } });
    const sources = new Set<string>();
    for (const a of articles) {
      if (isConvertible(a.featuredImage)) sources.add(a.featuredImage);
      for (const u of contentImagePaths(a.content)) sources.add(u);
    }
    for (const md of media) if (isConvertible(md.url)) sources.add(md.url);

    let onDisk = 0;
    let webpReady = 0;
    for (const s of sources) {
      const src = destFor(s);
      if (src && (await exists(src))) onDisk++;
      const out = destFor(webpPathFor(s));
      if (out && (await exists(out))) webpReady++;
    }
    return NextResponse.json({
      dryRun: true,
      convertibleSources: sources.size,
      sourcesOnDisk: onDisk,
      webpAlreadyDone: webpReady,
      toEncode: onDisk - webpReady,
      note: `共 ${sources.size} 張 jpg/png（磁碟上 ${onDisk} 張）,已轉 webp ${webpReady} 張,待轉 ${
        onDisk - webpReady
      } 張。實際執行：?auto=1`,
    });
  }

  // 自動版：回傳會自己一批批跑到完的頁面
  if (req.nextUrl.searchParams.get("auto") === "1") {
    const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>圖片最佳化（轉 webp）</title>
<style>body{font-family:system-ui,-apple-system,"PingFang TC",sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#222}
h1{font-size:20px}#log{white-space:pre-wrap;background:#f6f6f6;border-radius:8px;padding:14px;font-size:13px;line-height:1.7;max-height:60vh;overflow:auto}
.b{font-weight:700}.ok{color:#15803d}.err{color:#b91c1c}</style></head>
<body><h1>圖片最佳化中（縮 1600px + 轉 webp）…</h1>
<p>請<span class="b">不要關閉這個分頁</span>，它會自己一批批跑到完。完成後會顯示「全部完成」。</p>
<div id="log">啟動中…\n</div>
<script>
const log=document.getElementById('log');
let totalEnc=0,totalFail=0,round=0;
function add(t,c){const s=document.createElement('span');if(c)s.className=c;s.textContent=t+"\\n";log.appendChild(s);log.scrollTop=log.scrollHeight;}
async function tick(){
  round++;
  try{
    const r=await fetch('/api/optimize-images?limit=12',{cache:'no-store'});
    const j=await r.json();
    if(j.error){add('錯誤：'+j.error,'err');return;}
    totalEnc+=j.encoded||0; totalFail+=j.failed||0;
    add('第 '+round+' 批：本批轉檔 '+j.encoded+'、改寫文章/媒體 '+j.dbUpdated+'、失敗 '+j.failed+' ｜ 累計轉檔 '+totalEnc+' 失敗 '+totalFail);
    if(j.errorsSample&&j.errorsSample.length){j.errorsSample.forEach(e=>add('  ✗ '+e,'err'));}
    if(j.done){add('✅ 全部完成！累計轉檔 '+totalEnc+' 張，失敗 '+totalFail+'。回前台重新整理確認（圖會明顯變快），確認 OK 後記得移除 MAINT_TOOLS。','ok');return;}
    setTimeout(tick,500);
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

  const limit = Math.max(
    1,
    Math.min(40, Number(req.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT))
  );

  let encoded = 0;
  let dbUpdated = 0;
  let failed = 0;
  const errors: string[] = [];
  let budget = limit;
  let hitBudget = false;

  // 確保某張原圖已轉成 webp（已存在則跳過,不重壓）。回傳是否成功（可改寫 DB 指向它）。
  async function ensureWebp(srcPath: string): Promise<boolean> {
    const src = destFor(srcPath);
    const out = destFor(webpPathFor(srcPath));
    if (!src || !out) return false;
    if (!(await exists(src))) return false; // 原圖不在磁碟（死連結）→ 不動
    if (await exists(out)) return true; // 已轉過 → 直接用
    if (budget <= 0) {
      hitBudget = true;
      return false;
    }
    try {
      await toWebp(src, out);
      encoded++;
      budget--;
      return true;
    } catch (e) {
      failed++;
      if (errors.length < 15) errors.push(`${srcPath} :: ${String(e)}`);
      return false;
    }
  }

  // 1) 文章：featuredImage + 內文 <img>
  const articles = await prisma.article.findMany({
    select: { id: true, featuredImage: true, content: true },
  });
  for (const a of articles) {
    if (budget <= 0) {
      hitBudget = true;
      break;
    }
    const data: { featuredImage?: string; content?: string } = {};
    let newContent = a.content ?? "";

    if (isConvertible(a.featuredImage)) {
      if (await ensureWebp(a.featuredImage)) data.featuredImage = webpPathFor(a.featuredImage);
    }
    for (const u of contentImagePaths(a.content)) {
      if (budget <= 0) {
        hitBudget = true;
        break;
      }
      if (await ensureWebp(u)) newContent = newContent.split(u).join(webpPathFor(u));
    }
    if (newContent !== (a.content ?? "")) data.content = newContent;
    if (Object.keys(data).length > 0) {
      await prisma.article.update({ where: { id: a.id }, data });
      dbUpdated++;
    }
  }

  // 2) 媒體庫
  if (!hitBudget) {
    const media = await prisma.media.findMany({
      select: { id: true, url: true },
    });
    for (const m of media) {
      if (budget <= 0) {
        hitBudget = true;
        break;
      }
      if (!isConvertible(m.url)) continue;
      if (await ensureWebp(m.url)) {
        const newUrl = webpPathFor(m.url);
        await prisma.media.update({
          where: { id: m.id },
          data: { url: newUrl, filename: path.basename(newUrl), mimeType: "image/webp" },
        });
        dbUpdated++;
      }
    }
  }

  return NextResponse.json({
    dryRun: false,
    batchLimit: limit,
    encoded,
    dbUpdated,
    failed,
    errorsSample: errors,
    done: !hitBudget,
    note: hitBudget
      ? "這批完成,還有圖沒轉完 → 再開一次同一個網址繼續（已轉過的會跳過）。"
      : "全部完成！圖片已縮小並轉 webp,DB 已改指向新檔。重新整理前台確認,確認 OK 後移除 MAINT_TOOLS。原 jpg/png 仍保留在 Volume,可隨時回退。",
  });
}
