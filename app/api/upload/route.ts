import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { rateLimit, tooMany } from "@/lib/rate-limit";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

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

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Create year/month folder
  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const uploadPath = join(UPLOAD_DIR, folder);
  await mkdir(uploadPath, { recursive: true });

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(join(uploadPath, filename), buffer);

  const url = `/uploads/${folder}/${filename}`;

  const media = await prisma.media.create({
    data: {
      filename,
      originalName: file.name,
      url,
      size: file.size,
      mimeType: file.type,
      userId: u.id,
    },
  });

  return NextResponse.json({ id: media.id, url, filename: media.originalName }, { status: 201 });
}
