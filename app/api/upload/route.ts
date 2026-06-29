import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { rateLimit, tooMany } from "@/lib/rate-limit";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_WIDTH = 1600;
const QUALITY = 80;

export async function POST(req: NextRequest) {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // 上傳寫磁碟,限速以保護 Volume 容量與 CPU
  const rl = rateLimit(`upload:${u.id}`, { limit: 60, windowMs: 60 * 60_000 });
  if (!rl.ok) return tooMany(rl.retryAfter, "上傳太頻繁,請稍後再試");

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "未選擇檔案" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "不支援此檔案類型" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "檔案大小不得超過 10MB" }, { status: 400 });

  const original = Buffer.from(await file.arrayBuffer());

  // jpeg/png 一律縮到 1600px + 轉 webp（與 /api/optimize-images 同規格,讓新上傳不再是大原圖）。
  // gif 可能是動圖、avif/webp 已壓過 → 維持原樣不重壓,避免破壞動畫或無謂放大。
  // 型別用 Uint8Array：sharp().toBuffer() 是 Buffer<ArrayBufferLike>，
  // 與 Buffer.from(arrayBuffer) 的 Buffer<ArrayBuffer> 在新版 @types/node 不相容，
  // 統一成兩者都可指派的 Uint8Array（writeFile / .length 皆可吃）。
  let buffer: Uint8Array = original;
  let ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  let mimeType = file.type;
  if (file.type === "image/jpeg" || file.type === "image/png") {
    try {
      buffer = await sharp(original)
        .rotate() // 依 EXIF 方向修正後去掉方位資訊
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();
      ext = "webp";
      mimeType = "image/webp";
    } catch {
      // 轉檔失敗就存原檔,不擋上傳
      buffer = original;
    }
  }

  // Create year/month folder
  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const uploadPath = join(UPLOAD_DIR, folder);
  await mkdir(uploadPath, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(join(uploadPath, filename), buffer);

  const url = `/uploads/${folder}/${filename}`;

  const media = await prisma.media.create({
    data: {
      filename,
      originalName: file.name,
      url,
      size: buffer.length,
      mimeType,
      userId: u.id,
    },
  });

  return NextResponse.json({ id: media.id, url, filename: media.originalName }, { status: 201 });
}
