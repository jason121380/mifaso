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
- `MAINT_TOOLS` — **平時不設**。設 `1` 才會開啟下方一次性維運路由(否則一律 404)。用完移除。
- `GOOGLE_SITE_VERIFICATION` — 選用,Google Search Console 驗證碼(設了才輸出 meta)。

**勿把任何密碼/金鑰寫進 repo。**

## 資安 / SEO（本輪強化,改動前先知道）

- 文章內文一律經 `lib/article-html.ts` 的 `sanitize-html` allowlist 消毒(移除
  `<script>`/`on*`/`javascript:`,保留 IG `blockquote`、表格、目錄)。IG 由
  `components/public/InstagramEmbed.tsx` 載入的 embed.js 處理,**勿在內文塞 script**。
- `next.config.ts` 有全站安全標頭(HSTS、nosniff、X-Frame-Options、Referrer-Policy、
  CSP `upgrade-insecure-requests`)。`/api/ai` 需登入。登入 `callbackUrl` 僅限同站路徑。
- SEO 集中在 `lib/seo.ts`(Organization/WebSite/Article/Breadcrumb JSON-LD + canonical);
  `app/sitemap.ts`、`app/robots.ts`、RSS `app/feed.xml/route.ts` 皆依 `SITE_URL`。
- 後台流量分析:`PageView` model + `/api/track`(公開輕量)+ `components/public/Tracker.tsx`
  + `app/admin/analytics`。新資料表 migration 由 `prisma migrate deploy` 自動套用。

## 一次性管理工具（瀏覽器觸發,需 ADMIN 登入 + `MAINT_TOOLS=1`,否則 404）

- `GET /api/restore-from-mifaso` — 從 mifaso.co WordPress REST API 用標題比對,還原 88 篇的
  `featuredImage` + 原始 `content`(含 IG 嵌入)。`?dry=1` 預覽、`?diag=1` 診斷來源。
  **依賴舊 WP 站存活;網域 cut over 到新站後此工具失效。**
- `GET /api/localize-images` — 把外部圖片下載到 `/src/public/uploads` 並改 DB 為本地路徑：
  - `?dry=1` 只算數量(秒回)
  - `?auto=1` 自動分批跑到完(HTML 進度頁,放著別關)
  - `?check=1` 路徑/Volume 健檢(寫 `__healthcheck.txt`)
  - `?media=1` 把 uploads 內圖片登錄進「媒體庫」(`?media=1&dry=1` 預覽)
- `GET /api/fix-updated-at` — 把 88 篇 `updatedAt` 設為其真實 `publishedAt`
  (seed 的 updatedAt/createdAt 皆匯入當天,無意義)。`?dry=1` 預覽。**後台列表/總覽
  現已直接顯示/排序 `publishedAt`,此工具僅在需要修正 DB 值時才用。**
- `GET /api/strip-related-reading` — 移除所有文章內文的「延伸閱讀」段落
  (整個 `<p>…延伸閱讀…</p>`,含其中連結),raw SQL 更新不動 `updatedAt`。
  **只需 ADMIN 登入(不需 `MAINT_TOOLS`)**;預設只預覽,加 `?run=1` 才實際寫入
  (重跑為 no-op)。流量分析的 `page_views` 表改為首次使用時自動建立
  (`lib/page-views.ts`),不再依賴 `prisma migrate deploy`。

## 內容/資料

88 篇文章由 `scripts/seed-production.ts` 從 `scripts/seed-data/*.json` 匯入(原始來自
mifaso.co WordPress)。圖片已在地化到持久 Volume。登入帳號見 `scripts/seed-data/users.json`
(`admin` = M編 ADMIN、`jason` = AUTHOR,密碼為原站匯出值)。

詳見 `DEPLOY.md`(部署步驟)與 `memory.md`(當前狀態與待辦)。
