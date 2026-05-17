import prisma from "@/lib/prisma";
import { randomUUID } from "node:crypto";

let ensured = false;

/** 自動建立 content_backups 表(idempotent),不依賴 migration。 */
async function ensureTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "content_backups" (
      "id" TEXT NOT NULL,
      "articleId" TEXT NOT NULL,
      "op" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "content_backups_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "content_backups_op_idx" ON "content_backups"("op");`
  );
  ensured = true;
}

/**
 * 備份一批文章原始內容(單層 undo:同一 op 只保留最近一次,先清掉舊的)。
 */
export async function saveBackups(
  op: string,
  rows: { articleId: string; content: string }[]
): Promise<void> {
  await ensureTable();
  await prisma.$executeRaw`DELETE FROM "content_backups" WHERE "op" = ${op}`;
  for (const r of rows) {
    await prisma.$executeRaw`
      INSERT INTO "content_backups" ("id","articleId","op","content","createdAt")
      VALUES (${randomUUID()}, ${r.articleId}, ${op}, ${r.content}, ${new Date()})`;
  }
}

/** 還原某 op 的備份(把文章內容寫回),回傳還原篇數;還原後清掉該批備份。 */
export async function restoreBackups(op: string): Promise<number> {
  await ensureTable();
  const cnt = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "content_backups" WHERE "op" = ${op}`;
  const n = cnt[0]?.n ?? 0;
  if (n > 0) {
    await prisma.$executeRaw`
      UPDATE "articles" a SET "content" = b."content"
      FROM "content_backups" b
      WHERE b."articleId" = a."id" AND b."op" = ${op}`;
    await prisma.$executeRaw`DELETE FROM "content_backups" WHERE "op" = ${op}`;
  }
  return n;
}

/** 查詢某 op 目前有幾筆可還原的備份與時間。 */
export async function backupInfo(
  op: string
): Promise<{ count: number; at: string | null }> {
  await ensureTable();
  const rows = await prisma.$queryRaw<{ n: number; at: Date | null }[]>`
    SELECT COUNT(*)::int AS n, MAX("createdAt") AS at
    FROM "content_backups" WHERE "op" = ${op}`;
  return { count: rows[0]?.n ?? 0, at: rows[0]?.at ? rows[0].at.toISOString() : null };
}
