import prisma from "@/lib/prisma";

let ensured = false;

/**
 * 自動建立 page_views 表(idempotent)。
 * 讓流量分析不依賴 prisma migrate deploy / Zeabur build command —
 * 部署後第一次 track 或開分析頁時自動建好。
 * SQL 為固定字串(無使用者輸入),用 executeRawUnsafe 跑 DDL。
 */
export async function ensurePageViewsTable(): Promise<boolean> {
  if (ensured) return true;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "page_views" (
        "id" TEXT NOT NULL,
        "path" TEXT NOT NULL,
        "articleId" TEXT,
        "referrer" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "page_views_createdAt_idx" ON "page_views"("createdAt");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "page_views_path_idx" ON "page_views"("path");`
    );
    ensured = true;
    return true;
  } catch {
    return false;
  }
}
