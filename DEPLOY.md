# MIFASO 迷髮所 — Zeabur 部署指南

## 環境需求
- Node.js 20+
- PostgreSQL（由 Zeabur 提供）

---

## 本機開發

```bash
# 1. 複製範例環境變數
cp .env.example .env.local

# 2. 編輯 .env.local，填入 DATABASE_URL 與 AUTH_SECRET
# AUTH_SECRET 產生方式：openssl rand -base64 32

# 3. 安裝依賴
npm install

# 4. 建立資料表
npm run db:push

# 5. 填入測試資料
npm run db:seed

# 6. 啟動開發伺服器
npm run dev
```

開啟 http://localhost:3000 查看前台
開啟 http://localhost:3000/admin 進入後台

**登入帳號（來自 `scripts/seed-data/users.json`）：**
- 主編：帳號 `admin`（角色 ADMIN）
- 作者：帳號 `jason`（角色 AUTHOR）
- 密碼為原網站匯出時設定的密碼（登入頁的 Account 欄位填上方帳號）

> 只想要 2 篇示範資料、用 `admin@mifaso.com` / `admin123456` 登入時，
> 改執行 `npm run db:seed:demo`。

---

## Zeabur 部署步驟

### 1. 推送到 GitHub
```bash
git init
git add .
git commit -m "init: mifaso"
git remote add origin https://github.com/jason121380/mifaso.git
git push -u origin main
```

### 2. 在 Zeabur 建立專案
1. 前往 https://zeabur.com，登入
2. 點「New Project」
3. 選「Deploy from GitHub」，選擇你的 repo
4. Zeabur 會自動偵測 Next.js

### 3. 新增 PostgreSQL 服務
1. 在同一個 Zeabur 專案點「Add Service」
2. 選「Marketplace → PostgreSQL」
3. 等待啟動（約 30 秒）

### 4. 連接資料庫
1. 點擊 Next.js 服務 → Variables
2. 點「Add Variable」
3. 輸入 key: `DATABASE_URL`
4. 點「From Other Services」→ 選 PostgreSQL → `POSTGRESQL_URI`

### 5. 設定必要環境變數
在 Variables 頁面新增：

| Key | Value |
|-----|-------|
| `AUTH_SECRET` | 執行 `openssl rand -base64 32` 取得的值 |
| `NEXTAUTH_URL` | 正式網域 `https://mifaso.co`（務必與登入用網域一致，否則後台側欄消失、登入後跳舊網域） |
| `SITE_URL` | `https://mifaso.co`（canonical / sitemap / RSS / OG 皆依此；缺值會 fallback `https://mifaso.co`） |
| `NODE_ENV` | `production` |
| `OPENAI_API_KEY` | OpenAI 金鑰（AI 摘要／SEO／標籤功能用，沒設則 AI 功能停用；`/api/ai` 已要求登入） |
| `MAINT_TOOLS` | 平時**不設**。需跑一次性維運工具時才暫設 `1`，用完移除（見下方「維運工具」） |
| `GOOGLE_SITE_VERIFICATION` | 選用，Google Search Console 驗證碼（設了才輸出 meta） |

### 6. 設定 Persistent Volume（圖片存放）
1. 點擊 Next.js 服務 → Volumes
2. 新增 Volume：Mount path = **`/src/public/uploads`**
   （**不可**用 `/app/...`；Zeabur runtime cwd 是 `/src`，掛錯路徑檔案重新部署就消失）

### 7. 設定 Build Command
在 Settings → Build Command 輸入：
```
npm install && npx prisma generate && npx prisma migrate deploy && npm run build
```

### 8. Seed 初始資料（首次部署後）
在 Zeabur 的 Terminal 執行（會匯入正式的 88 篇文章、分類、標籤與帳號）：
```bash
npm run db:seed
```
驗證雲端文章數：
```bash
npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.article.count().then(n=>{console.log('雲端文章數:',n);process.exit()})"
```

---

## 部署後確認清單
- [ ] 前台首頁正常顯示
- [ ] 後台 /admin/login 可以登入，**登入後第一次就有側邊選單**（不需重整）
- [ ] 文章可以新增/編輯/發布；前台文章已消毒（無 `<script>` 注入）、IG 嵌入正常
- [ ] 圖片上傳正常（Persistent Volume 已掛載於 `/src/public/uploads`）
- [ ] Sitemap `/sitemap.xml`、`/robots.txt`、RSS `/feed.xml` 可訪問
- [ ] `curl -I https://mifaso.co` 有安全標頭（HSTS、X-Content-Type-Options、CSP `upgrade-insecure-requests`），瀏覽器不再「Not Secure」
- [ ] 未登入 `POST /api/ai` 回 401；未設 `MAINT_TOOLS` 時維運路由回 404
- [ ] 逛幾頁前台後 `/admin/analytics` 有數據（流量分析）

---

## 維運工具（一次性，預設關閉）

`/api/restore-from-mifaso`、`/api/localize-images`、`/api/fix-updated-at` 皆受
`MAINT_TOOLS` 控管：**未設 / 非 `1` 時一律回 404**（避免會改資料的 GET 被 CSRF/SSRF）。

要用時：Zeabur `mifaso-tal` 暫設 `MAINT_TOOLS=1` → 重新部署 → 登入 ADMIN 後在瀏覽器開對應網址
（先 `?dry=1` 預覽）→ 用完**移除 `MAINT_TOOLS`** 再重新部署關閉入口。詳見 `CLAUDE.md`。

## 資料庫密碼輪替（Zeabur PostgreSQL）

只改環境變數**不會**真的換掉密碼（DB 已初始化，env 只在首次初始化生效），順序：

1. PostgreSQL 服務 →「服務狀態」→「指令」執行（帳號見 `POSTGRES_USERNAME`，多為 `root`）：
   `ALTER USER root WITH PASSWORD '<新強密碼>';`
2. PostgreSQL 服務 →「環境變數」把 `PASSWORD`、`POSTGRES_PASSWORD` 改成新密碼；
   `POSTGRES_CONNECTION_STRING`/`POSTGRES_URI` 若是 `${PASSWORD}` 參考型免動，寫死字串才換。
3. `mifaso-tal` 的 `DATABASE_URL`：參考型自動更新；寫死字串手動換密碼段。
4. `mifaso-tal` 重新部署 → `/admin` 能登入即成功（步驟間會短暫斷線，挑離峰）。

---

## 帳號角色說明

| 角色 | 權限 |
|------|------|
| ADMIN | 所有功能，包含用戶管理 |
| EDITOR | 管理所有文章、分類、標籤、媒體 |
| AUTHOR | 只能管理自己的文章 |
