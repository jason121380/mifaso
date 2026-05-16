import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let path: unknown = body?.path;

    if (typeof path !== "string") return new NextResponse(null, { status: 204 });
    // 只收同站、合理長度的路徑;略過後台與資產
    if (!path.startsWith("/") || path.startsWith("//") || path.length > 512) {
      return new NextResponse(null, { status: 204 });
    }
    if (path.startsWith("/admin") || path.startsWith("/api") || path.startsWith("/_next")) {
      return new NextResponse(null, { status: 204 });
    }
    path = path.split("#")[0].slice(0, 512);

    const articleId =
      typeof body?.articleId === "string" ? body.articleId.slice(0, 64) : null;
    const ref = req.headers.get("referer");
    const referrer = ref ? ref.slice(0, 512) : null;

    await prisma.pageView.create({
      data: { path: path as string, articleId, referrer },
    });
  } catch {
    // 追蹤失敗不可影響使用者
  }
  return new NextResponse(null, { status: 204 });
}
