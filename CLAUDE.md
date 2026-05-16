# CLAUDE.md

專案給 Claude / 開發者的重點說明。**部署在 Zeabur,踩過很多平台特有的坑,動之前先讀完本檔。**

## 專案

MIFASO 迷髮所 — Next.js 15 (App Router) + React 19 + Prisma + PostgreSQL 的內容網站 / 後台 CMS。
- 前台：`app/(public)/`(首頁、文章、分類、搜尋)
- 後台：`app/admin/`(NextAuth v5 + Credentials,JWT session)
- 部署：Zeabur(Node 服務 `mifaso-tal` + PostgreSQL 服務）
- 正式網域：`https://mifaso.co`(Cloudflare 管 DNS,www 301 轉址到非 www)

## 指令

```
npm run dev            # 本機開發
npm run build          # prisma generate && next build
npm run db:seed        # 灌正式 88 篇（scripts/seed-production.ts）
npm run db:seed:demo   # 只灌 2 篇示範（prisma/seed.ts，admin@mifaso.com / admin123456）
```

## Zeabur 平台特有的坑（重要，務必遵守）

1. **runtime 工作目錄是 `/src`,不是 `/app`。** 上傳目錄 = `process.cwd()/public/uploads` = `/src/public/uploads`。
   持久 **Volume 必須掛在 `/src/public/uploads`**(掛 `/app/...` 會完全無效,檔案落在暫存碟、重新部署即消失)。
2. **Next.js 在 Zeabur 不會服務 runtime 才寫進 `public/` 的檔案。** 因此 `/uploads/*` 由
   `app/uploads/[...path]/route.ts`(串流路由)服務。**不要刪這支**,刪了所有上傳/在地化圖片會 404。
3. **`prisma/migrations/migration_lock.toml` 必須存在**(`provider = "postgresql"`),否則
   `prisma migrate deploy` 不會套用 migration,資料表不會建立 → 全站 500。
4. **`prisma/schema.prisma` 的 `binaryTargets`** 要含 Debian/glibc(`debian-openssl-3.0.x` 等),
   不可只有 musl,否則 Prisma 引擎在 Zeabur 跑不起來。
5. **NextAuth v5 在 Zeabur 反向代理後**:`lib/auth.config.ts` 已設 `trustHost: true`;
   仍須設 `AUTH_SECRET`,且**用與 `NEXTAUTH_URL` 一致的網域登入**,否則 `app/admin/layout.tsx`
   讀不到 session → 左側欄消失。
6. **`next.config.ts` 設 `images.unoptimized: true`**:機器記憶體小(2GB 與 Postgres 共用),
   sharp 即時最佳化會 OOM。圖片量大時記憶體很敏感。

## Zeabur 必要環境變數（`mifaso-tal` 服務）

`DATABASE_URL`(綁 PostgreSQL 服務)、`AUTH_SECRET`、`NEXTAUTH_URL`、`SITE_URL`
(皆 = `https://mifaso.co`)、`NODE_ENV=production`、`OPENAI_API_KEY`(選用,AI 功能)。
**勿把任何密碼/金鑰寫進 repo。**

## 一次性管理工具（瀏覽器觸發,需 ADMIN 登入）

- `GET /api/restore-from-mifaso` — 從 mifaso.co WordPress REST API 用標題比對,還原 88 篇的
  `featuredImage` + 原始 `content`(含 IG 嵌入)。`?dry=1` 預覽、`?diag=1` 診斷來源。
  **依賴舊 WP 站存活;網域 cut over 到新站後此工具失效。**
- `GET /api/localize-images` — 把外部圖片下載到 `/src/public/uploads` 並改 DB 為本地路徑：
  - `?dry=1` 只算數量(秒回)
  - `?auto=1` 自動分批跑到完(HTML 進度頁,放著別關)
  - `?check=1` 路徑/Volume 健檢(寫 `__healthcheck.txt`)
  - `?media=1` 把 uploads 內圖片登錄進「媒體庫」(`?media=1&dry=1` 預覽)

## 內容/資料

88 篇文章由 `scripts/seed-production.ts` 從 `scripts/seed-data/*.json` 匯入(原始來自
mifaso.co WordPress)。圖片已在地化到持久 Volume。登入帳號見 `scripts/seed-data/users.json`
(`admin` = M編 ADMIN、`jason` = AUTHOR,密碼為原站匯出值)。

詳見 `DEPLOY.md`(部署步驟)與 `memory.md`(當前狀態與待辦)。
