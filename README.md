# MIFASO 迷髮所

時尚・美髮・生活美學內容網站與後台 CMS。

- **前台**:Next.js 15 (App Router) + React 19,文章 / 分類 / 搜尋
- **後台**:`/admin`,NextAuth v5(Credentials + JWT),Tiptap 編輯器,AI 輔助(OpenAI)
- **資料**:Prisma + PostgreSQL
- **部署**:Zeabur,正式網域 `https://mifaso.co`

## 本機開發

```bash
cp .env.example .env.local      # 填 DATABASE_URL、AUTH_SECRET 等
npm install
npx prisma generate
npm run db:push                 # 或 npm run db:migrate
npm run db:seed                 # 灌正式 88 篇內容（或 db:seed:demo 灌 2 篇示範）
npm run dev
```

- 前台:http://localhost:3000
- 後台:http://localhost:3000/admin

## 常用指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發伺服器 |
| `npm run build` | `prisma generate && next build` |
| `npm run start` | 正式啟動 |
| `npm run db:seed` | 灌正式 88 篇(`scripts/seed-production.ts`) |
| `npm run db:seed:demo` | 灌 2 篇示範(`admin@mifaso.com` / `admin123456`) |

## 文件

- **`CLAUDE.md`** — Zeabur 平台特有的坑、一次性管理工具、必要環境變數(動程式前必讀)
- **`memory.md`** — 目前部署狀態與待辦
- **`DEPLOY.md`** — Zeabur 部署步驟

## 注意

- 圖片由 `app/uploads/[...path]/route.ts` 串流服務(Zeabur 不服務 runtime 寫入的 `public/`)。
- 持久 Volume 必須掛在 `/src/public/uploads`。
- 切勿把密碼 / `AUTH_SECRET` / `DATABASE_URL` 值寫進版控。
