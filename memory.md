# memory.md

跨 session 的工作記憶:目前狀態與待辦。新 session 先讀這份 + `CLAUDE.md`。

## 目前狀態（2026-05）

- 資料庫:Zeabur PostgreSQL,88 篇文章 + 分類 + 標籤已 seed。
- 圖片:已在地化到持久 Volume(掛在 `/src/public/uploads`),由
  `app/uploads/[...path]/route.ts` 串流服務,重新部署不會再消失。媒體庫已登錄 391 張。
- 後台 NextAuth 已可登入;`NEXTAUTH_URL`/`SITE_URL` 已設 `https://mifaso.co`。
- 網域 cut over 已完成,`https://mifaso.co` 上線。
- **分支 `claude/read-repo-chinese-response-xTdlH`** 累積本輪所有修正(資安/debug/SEO/
  流量分析/UI),**尚未合併進 `main`**;合併後 Zeabur 自動部署、`page_views`
  migration 會自動套用。

## 進行中 / 待辦

1. **合併部署**:把 `claude/read-repo-chinese-response-xTdlH` 合併進 `main` → Zeabur 重新部署。
2. **rotate DB 密碼**:Zeabur PostgreSQL 密碼曾外流。步驟見 `DEPLOY.md`「資料庫密碼輪替」
   (先 `ALTER USER` 改真實密碼,再同步 env,最後 `mifaso-tal` 重新部署)。
3. **(選用)修 updatedAt**:後台已直接顯示/排序 `publishedAt`,通常不需要;若仍要把 DB
   的 `updatedAt` 改成 `publishedAt`,暫設 `MAINT_TOOLS=1` 後開 `/api/fix-updated-at?dry=1`
   預覽再正式跑,用完移除 `MAINT_TOOLS`。
4. **(選用)Search Console**:設 `GOOGLE_SITE_VERIFICATION` 後重新部署,送出 sitemap。
5. **已知無解破圖**:1 張內文圖 hotlink 自 `www.mlgroup.io`(外部、已刪),無法在地化,可接受。

## 已完成的關鍵修正（歷史,避免重蹈覆轍）

- 首頁 500 根因:缺 `migration_lock.toml` + `binaryTargets` 為 musl + Zeabur 沒設
  `DATABASE_URL`(`Digest 2606544078` 即此)。皆已修。
- OOM 502:`images.unoptimized: true`。
- 後台側欄消失:NextAuth 需 `trustHost: true` + 一致網域登入。
- 圖片 404 根因:cwd=`/src` 非 `/app`、Volume 掛錯路徑、且 Next 不服務 runtime
  寫入的 public 檔 → 新增 `app/uploads/[...path]/route.ts` 串流路由 + Volume
  改掛 `/src/public/uploads`。
- 編輯器:新增 `components/admin/tiptap-nodes.ts`(InstagramEmbed / TableOfContents
  正規節點)、`components/public/InstagramEmbed.tsx`(載入後 + 換頁重跑 IG embed)、
  `lib/article-html.ts`(前台自動產生目錄 + 標題錨點)。上線後需於正式站抽驗。

### 本輪（資安 / debug / SEO / 流量分析 / UI）

- **資安**:`sanitize-html` 消毒文章(防 stored-XSS)、`/api/ai` 加登入驗證、
  `next.config.ts` 安全標頭、維運路由改 `MAINT_TOOLS` gate、登入 `callbackUrl`
  防 open-redirect、JSON-LD 跳脫、`metadataBase` https。移除未用 `@anthropic-ai/sdk`。
- **debug**:登入後側欄需重整才出現 → 改全頁導向修正;自訂響應式 404;前台 `.prose`
  手機 RWD(表格/圖/WP 對齊/目錄);media PATCH 限 ADMIN/EDITOR。
- **SEO**:`lib/seo.ts`(JSON-LD/canonical)、Org+WebSite+Article+Breadcrumb、
  RSS `/feed.xml`、sitemap/robots 用 https `SITE_URL`、分類標題重複後綴 bug 修正。
- **流量分析**:`PageView` + migration `20260517000000_page_views` + `/api/track`
  + `Tracker` + `/admin/analytics` + 側欄。
- **UI**:header 搜尋移右、去上方細條、配色對齊 footer(rose-brand)、logo 全黑、
  黑 favicon/app icon、手機 hero 4:5、後台主題色、側欄 active 白 icon、媒體庫
  載入更多、精選排序最前、後台日期改 publishedAt、footer 移除「編輯後台」。

## 帳號

- 正式:`admin`(M編,ADMIN)、`jason`(AUTHOR)— 密碼為原站匯出值。
- demo seed:`admin@mifaso.com` / `admin123456`(僅 `npm run db:seed:demo`)。

> 不要把任何密碼、`AUTH_SECRET`、`DATABASE_URL` 值寫進此檔或任何 commit。
