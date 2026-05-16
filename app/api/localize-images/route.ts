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

// url -> local "/uploads/xxx" (cached within one run); downloads if needed
function makeLocalizer(stats: { downloaded: number; reused: number; failed: number; errors: string[] }) {
  const cache = new Map<string, string | null>();
  return async function localize(url: string, dry: boolean): Promise<string | null> {
    if (cache.has(url)) return cache.get(url)!;
    try {
      const head = await fetch(url, { method: "GET", headers: { "User-Agent": UA } });
      if (!head.ok) throw new Error(`HTTP ${head.status}`);
      const ct = head.headers.get("content-type");
      const name = localNameFor(url, ct);
      const dest = path.join(UPLOAD_DIR, name);
      const local = `/uploads/${name}`;
      if (await exists(dest)) {
        stats.reused++;
        cache.set(url, local);
        return local;
      }
      if (dry) {
        cache.set(url, local);
        return local;
      }
      const buf = Buffer.from(await head.arrayBuffer());
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(dest, buf);
      stats.downloaded++;
      cache.set(url, local);
      return local;
    } catch (e) {
      stats.failed++;
      if (stats.errors.length < 15) stats.errors.push(`${url} :: ${String(e)}`);
      cache.set(url, null);
      return null;
    }
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ error: "需要以管理員身分登入後台後再開此連結" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  const articles = await prisma.article.findMany({
    select: { id: true, featuredImage: true, content: true },
  });

  const stats = { downloaded: 0, reused: 0, failed: 0, errors: [] as string[] };
  const localize = makeLocalizer(stats);

  let articlesTouched = 0;
  let featuredFixed = 0;
  let contentImgFixed = 0;

  for (const a of articles) {
    const data: { featuredImage?: string; content?: string } = {};

    if (isExternal(a.featuredImage)) {
      const local = await localize(a.featuredImage, dry);
      if (local) {
        data.featuredImage = local;
        featuredFixed++;
      }
    }

    if (a.content && /<img[^>]+src=["']https?:\/\//i.test(a.content)) {
      const srcs = new Set<string>();
      const re = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(a.content)) !== null) srcs.add(m[1]);

      let newContent = a.content;
      for (const src of srcs) {
        const local = await localize(src, dry);
        if (local) {
          newContent = newContent.split(src).join(local);
          contentImgFixed++;
        }
      }
      if (newContent !== a.content) data.content = newContent;
    }

    if (Object.keys(data).length > 0) {
      articlesTouched++;
      if (!dry) await prisma.article.update({ where: { id: a.id }, data });
    }
  }

  return NextResponse.json({
    dryRun: dry,
    dbArticles: articles.length,
    articlesTouched,
    featuredImagesLocalized: featuredFixed,
    contentImagesLocalized: contentImgFixed,
    filesDownloaded: stats.downloaded,
    filesReused: stats.reused,
    failed: stats.failed,
    errorsSample: stats.errors,
    note: dry
      ? "預覽（dry=1），未下載也未寫入。確認後拿掉 ?dry=1 再開一次即實際在地化。"
      : "完成。圖片已存到 public/uploads，DB 已改指向本地路徑。若未掛持久 Volume，重新部署會遺失，請先掛 Volume。",
  });
}
