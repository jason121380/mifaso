# memory.md

跨 session 的工作記憶:目前狀態與待辦。新 session 先讀這份 + `CLAUDE.md`。

## 目前狀態（2026-05）

- 已部署 Zeabur,所有修正皆已合併進 `main`。
- 資料庫:Zeabur PostgreSQL,88 篇文章 + 分類 + 標籤已 seed。
- 圖片:已在地化到持久 Volume(掛在 `/src/public/uploads`,約 ~192MB),
  由 `app/uploads/[...path]/route.ts` 串流服務,重新部署不會再消失。
- 後台 NextAuth 已可登入(`lib/auth.config.ts` 有 `trustHost: true`)。
- 自訂網域 `mifaso.co`:cut over 進行中(Cloudflare DNS)。

## 進行中 / 待辦

1. **網域 cut over**:Cloudflare 兩筆紀錄需設**灰雲(僅 DNS)**;
   舊 WP A 紀錄 `45.77.30.246` 需刪除;只留
   `A mifaso.co → 54.168.143.169`(灰)、`CNAME www → mifaso.co`(灰)。
   Zeabur:`mifaso.co` 為主、`www.mifaso.co` 設轉址到 `mifaso.co`。
   等 Zeabur 自動簽 Let's Encrypt SSL(灰雲+乾淨 DNS 後 5~30 分)。
   完成後 `NEXTAUTH_URL`/`SITE_URL` = `https://mifaso.co` 並重新部署。
2. **媒體庫**:跑 `GET /api/localize-images?media=1` 把已在地化圖片登錄進後台媒體庫
   (匯入流程不會自動建 Media 紀錄,所以媒體庫原本是空的)。
3. **安全**:Zeabur PostgreSQL 密碼曾在對話中外流,需到 Zeabur **rotate 密碼**
   並更新 `DATABASE_URL`。
4. **已知無解破圖**:有 1 張內文圖 hotlink 自 `www.mlgroup.io`(外部、已刪),
   非 mifaso.co,無法在地化,屬可接受。
5. **暫停的功能**:後台「進站流量分析」尚未實作(使用者要求後因處理網域/圖片而擱置)。

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

## 帳號

- 正式:`admin`(M編,ADMIN)、`jason`(AUTHOR)— 密碼為原站匯出值。
- demo seed:`admin@mifaso.com` / `admin123456`(僅 `npm run db:seed:demo`)。

> 不要把任何密碼、`AUTH_SECRET`、`DATABASE_URL` 值寫進此檔或任何 commit。
