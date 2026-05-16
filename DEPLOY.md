# LUXE Magazine — Zeabur 部署指南

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
git commit -m "init: luxe magazine"
git remote add origin https://github.com/your-username/luxe-magazine.git
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
| `NEXTAUTH_URL` | 你的 Zeabur 網域，如 `https://luxe.zeabur.app` |
| `SITE_URL` | 同上 |
| `NODE_ENV` | `production` |
| `OPENAI_API_KEY` | OpenAI 金鑰（AI 摘要／SEO／標籤功能用，沒設則 AI 功能停用） |

### 6. 設定 Persistent Volume（圖片存放）
1. 點擊 Next.js 服務 → Volumes
2. 新增 Volume：Mount path = `/app/public/uploads`

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
- [ ] 後台 /admin/login 可以登入
- [ ] 文章可以新增/編輯/發布
- [ ] 圖片上傳正常（Persistent Volume 已掛載）
- [ ] Sitemap 可訪問：/sitemap.xml

---

## 帳號角色說明

| 角色 | 權限 |
|------|------|
| ADMIN | 所有功能，包含用戶管理 |
| EDITOR | 管理所有文章、分類、標籤、媒體 |
| AUTHOR | 只能管理自己的文章 |
