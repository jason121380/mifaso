import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 清除前台 Next 快取(ISR / route cache)。
 * 文章頁是 ISR(revalidate=300),DB 內容改了不會即時反映,呼叫此端點即清掉。
 * 需 ADMIN。注意:若 Cloudflare 有快取 HTML,另需在 Cloudflare 端 purge。
 */
export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理員身分" }, { status: 401 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({
    revalidated: true,
    note: "已清除前台快取。前台稍候或強制重整即更新(若仍是舊的,可能是 Cloudflare 快取,需另行 purge)。",
  });
}
