# STYLE.md — MIFASO 迷髮所 設計規範（前台 / 後台）

本檔定義整站視覺與元件規範。**新增 / 修改 UI 前先讀本檔,並沿用既有 token 與樣式類別,不要自創黑底按鈕、`rounded-sm` 卡片或 `font-serif text-3xl` 標題。**

技術：Tailwind CSS 3 + `@tailwindcss/typography`。token 在 `tailwind.config.ts`,全站基底與元件類別在 `app/globals.css`。

---

## 1. 設計 Token

### 1.1 色彩（`tailwind.config.ts`）

| Token | 值 | 用途 |
|---|---|---|
| `rose-brand` | `#C4837A` | **主題色**。前台 Header/Footer 底色、後台主要按鈕、連結、active、focus ring 基礎、頭像 |
| `rose-light` | `#EDD5D2` | focus ring（`focus:ring-rose-light`）、淡底 |
| `rose-dark` | `#A3635B` | 主要按鈕 hover（`hover:bg-rose-dark`） |
| `gold` `DEFAULT/light/dark` | `#C9A84C` / `#E8D5A3` / `#9A7A2E` | 少量點綴（保留,目前主視覺以 rose 為主） |
| 中性色 | Tailwind `gray-*`、`black`、`white` | 文字 `text-gray-900/700/600/500/400`、邊線 `border-gray-100/200`、底 `bg-gray-50/100` |
| 語意色 | `emerald-*`（成功/已發布）、`amber-*`（草稿）、`red-*`（刪除/危險）、`blue-*`（預覽） | 狀態與動作 |

> 主題色一律用 `rose-brand`。**禁止**新的 `bg-black` 按鈕(品牌色才是主要動作色)。

### 1.2 字體

- `--font-sans`：由 `next/font` 注入的 **Noto Sans TC**（300/400/500/600/700）。`body` 預設 `font-sans`。
- `--font-serif`：`"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`(`app/globals.css :root`)。
- `font-serif` 用於**前台**標題（文章 H1、卡片標題、區塊標題）營造雜誌感；`@tailwindcss/typography` 已設定 `.prose` 的 `h1/h2/h3` 用 serif。
- **後台**一律 `font-sans`（不要用 `font-serif`）。

### 1.3 全站基底（`@layer base`）

- `html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased }`
- `body { @apply font-sans text-black bg-white }`
- `::selection { @apply bg-rose-brand text-white }`
- 捲軸：寬 `4px`,track `gray-100`,thumb `gray-400` → hover `rose-brand`。
- 動畫：`animate-fade-in`(0.6s)、`animate-slide-up`(0.5s)。

---

## 2. 前台（Public）

容器統一：`max-w-screen-xl mx-auto px-6`(hero 區手機可全寬,見下)。

### 2.1 Header（`components/public/Header.tsx`）

- `fixed top-0 inset-x-0 z-50`,**底色 = 主題色**：
  - 未捲動：`bg-rose-brand/95 backdrop-blur-sm`
  - 已捲動：`bg-rose-brand border-b border-white/20 shadow-sm`
- Logo：`/logo.png` + `brightness-0 invert`(白色 logo);**不是連結**(後台版亦然,純展示)。
- 導覽連結：`text-xs uppercase tracking-widest text-white/80 hover:text-white font-medium`。
- 搜尋：右側**只放放大鏡 icon**(`text-white/80 hover:text-white`),連到 `/search`。
- 手機:左漢堡(三條 `bg-white` 線)、中 logo、右搜尋;選單為整頁 `bg-rose-brand`,連結 `text-white/90 hover:text-white border-b border-white/20`。
- Header 下方 spacer：`h-[60px] md:h-[88px]`(改 Header 高度時同步調整)。

### 2.2 Footer（`components/public/Footer.tsx`）

`bg-rose-brand text-white`;白 logo(`brightness-0 invert`);標題 `text-white/50 uppercase tracking-widest`;連結 `text-white/80 hover:text-white`;分隔線 `border-white/20`。**不放後台連結**。

### 2.3 ArticleCard（`components/public/ArticleCard.tsx`）三種變體

- `featured`(首頁 hero)：`bg-black` + 圖 `opacity-80` + 底部漸層 `bg-gradient-to-t from-black/85 via-black/30 to-transparent`;比例 **手機 `aspect-[4/5]` → `sm:16/10` → `md:16/9`**;手機近全寬(外層 `<section className="max-w-screen-xl mx-auto md:px-6">`,手機不留左右 padding);標題 `font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white`;`priority` + `sizes`。
- `default`：圖 `aspect-[4/3]`、`group-hover:scale-105`;標題 `font-serif text-xl line-clamp-2`;摘要 `text-gray-500 text-sm line-clamp-2`;meta `text-xs text-gray-400`。
- `horizontal`(側欄)：縮圖 `w-32 h-24`,標題 `font-serif text-base line-clamp-2`。

### 2.4 元件類別（`@layer components`）

| 類別 | 用途 |
|---|---|
| `.category-badge` | 分類標籤：`inline-block text-xs uppercase tracking-widest text-rose-brand border border-rose-brand px-3 py-1 rounded` |
| `.btn-primary` | `bg-black text-white px-8 py-3 text-sm uppercase tracking-widest rounded-lg hover:bg-rose-brand`（前台 CTA;後台勿用） |
| `.btn-outline` | 邊框按鈕,hover 反白成 rose-brand |
| `.luxury-divider` | 左右細線中夾標題的分隔 |
| `.gold-line` | `w-12 h-0.5 bg-rose-brand mx-auto` 裝飾短線 |
| `.article-grid` | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8` |

### 2.5 文章內文 `.prose`（Tailwind typography + RWD 覆寫）

- 基底由 typography plugin 提供;`h1-h3` 用 serif;連結 rose-brand。
- 圖片/figure/video：`max-width:100% !important; height:auto`。
- **Instagram**：`blockquote.instagram-media`、`iframe.instagram-media` **只設 `max-width:100%`,不可設 `height`/`aspect-ratio`**(高度交給 `embed.js`,否則貼文被裁切)。內文中的 `<script>` 一律被 `lib/article-html.ts` 的 sanitize 移除,IG 由 `components/public/InstagramEmbed.tsx` 載入 embed.js 處理。
- 影片 iframe(`iframe:not(.instagram-media)`,YouTube/Vimeo)：`width:100%; aspect-ratio:16/9`。
- WordPress 對齊類 `.alignleft/.alignright/.aligncenter`：手機中和 `float:none; margin:auto; max-width:100%`。
- 寬表格：`display:block; overflow-x:auto`(含 WP 舊版表格目錄)。
- 標題錨點:`.prose :is(h1,h2,h3,h4)[id] { scroll-margin-top: 6rem }`(避免被固定 Header 蓋住)。
- `.prose { overflow-wrap: anywhere }` 防長字串溢出。

### 2.6 文章目錄 `.article-toc`

緊湊、**透明底**(非灰底)、**無逐列分隔線**：外框 `1px #ececec` + `rounded-lg` + `padding .75rem 1rem`;標題 `font-weight:700; font-size:.95rem`;連結 `display:block; padding:.28rem 0; font-size:.9rem; color:#C4837A`,`toc-l3/l4` 階層縮排。可手動(編輯器⚓設標題 id + 連結 `#id`)或自動(插入「目錄」區塊,`lib/article-html.ts` 依 H2-H4 產生)。

### 2.7 404（`app/not-found.tsx`）

置中、響應式;`text-rose-brand` 標記 + serif 標題 + 兩顆按鈕(深色「回首頁」/ 邊框「搜尋文章」)。

---

## 3. 後台（Admin）

外殼：`AdminShell` → `Sidebar` + `AdminHeader` + `<main className="flex-1 p-4 md:p-8">`,整體 `bg-gray-50`。**全部 `font-sans`**。

### 3.1 Sidebar（`components/admin/Sidebar.tsx`）

- `fixed left-0 top-0 h-dvh w-64 bg-white border-r border-gray-100`;桌機可收合(漢堡 toggle,localStorage 記憶),收合時 `md:-translate-x-full` + 內容區 `md:ml-0`。
- Logo 區:黑 logo(`brightness-0`,白底),**非連結**;旁有 ExternalLink(開前台)與手機關閉 X。
- 導覽項 active：`bg-rose-brand text-white shadow-sm`,icon `text-white`,尾端 `ChevronRight text-white/70`;未選 `text-gray-600 hover:bg-gray-50`,icon `text-gray-400`。
- `adminOnly` 項目(如「工程工具」)僅 `userRole === "ADMIN"` 顯示。
- 底部使用者區:**無灰底**;頭像 `bg-rose-brand` 圓、姓名/角色、**右側登出 icon 按鈕**(`LogOut`,hover 紅);`flex-shrink-0` + `pb-[calc(1rem+env(safe-area-inset-bottom))]`(避免被手機瀏覽器列/home indicator 蓋住)。

### 3.2 AdminHeader（`components/admin/AdminHeader.tsx`）

`h-14 bg-white border-b border-gray-100 sticky top-0 z-20`;左側麵包屑(`breadcrumbMap` 中文化 slug,新增頁面要補對應);手機漢堡開 Sidebar、桌機漢堡收合 Sidebar。**右上不放「新增」按鈕與頭像**(已移除)。

### 3.3 後台標準元件（所有頁面務必一致）

```txt
頁標題      h1  text-2xl font-bold text-gray-900   （副標 p text-sm text-gray-400 mt-1）
卡片        div bg-white rounded-xl border border-gray-100  （內距 p-5 或 p-6）
主要按鈕    bg-rose-brand text-white px-5 py-2.5 text-sm font-medium rounded-lg
            hover:bg-rose-dark transition-colors shadow-sm   （前置 icon 用 <span className="text-base leading-none">＋</span>）
次要/邊框   border border-gray-200 text-gray-500 px-... py-2.5 text-sm rounded-lg
            hover:border-gray-400 hover:text-gray-700 transition-colors
危險動作    bg-red-600 text-white rounded-lg hover:bg-red-700   或  border border-red-100 text-red-500 hover:bg-red-50
輸入/下拉   w-full border border-gray-200 focus:border-rose-brand
            focus:ring-2 focus:ring-rose-light outline-none px-3 py-2.5 text-sm rounded-lg transition-all
分段/Tab    容器 bg-gray-100 p-1 rounded-md；active 子項 bg-white shadow-sm font-medium，未選 text-gray-500
徽章        inline-flex px-2.5 py-0.5 text-xs rounded-full font-medium
            已發布 emerald-50/700・草稿 amber-50/700・封存 gray-100/500
頭像        w-8~9 h-8~9 rounded-full bg-rose-brand text-white text-xs font-semibold
表格        table w-full；thead bg-gray-50 text-xs text-gray-500 uppercase tracking-wider；
            tbody divide-y divide-gray-50；次要欄 hidden md:/lg:/xl:table-cell；
            非標題欄 whitespace-nowrap；標題欄吃滿(w-full)、其餘固定寬(w-28~36)
分頁        方塊按鈕 rounded-lg；當前頁 bg-rose-brand text-white，其餘 border border-gray-200
列內動作    手機可見、桌機 hover 顯示：opacity-100 md:opacity-0 md:group-hover:opacity-100
載入中      div w-7~8 h-7~8 border-2 border-rose-brand border-t-transparent rounded-full animate-spin
空狀態      置中 lucide icon(text-gray-200) + text-gray-400 文案
```

### 3.4 自建彈窗（Modal）— **禁用原生 `window.prompt/alert/confirm`**

```txt
遮罩  fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4
      （onMouseDown：點遮罩本身才關閉）
卡片  bg-white rounded-lg shadow-xl w-full max-w-sm/md p-5
標題  h3 text-base font-semibold text-gray-900 mb-4
動作  右下：取消(text-gray-500 hover:text-gray-800) + 主要(rose-brand) / 危險(red-600)
```

範例：編輯器超連結彈窗分頁「外部連結 / 段落錨點(下拉選文內標題,缺 id 自動補)」;`/admin/tools` 的「確認刪除」二次確認;圖片/IG 插入。

### 3.5 編輯器（`components/admin/RichTextEditor.tsx`）

外框 `border border-gray-200 rounded-sm`;工具列 `bg-gray-50 p-2 flex flex-wrap gap-1.5`,`ToolbarButton` active 為 `bg-black text-white`(編輯器內部既有風格,維持)。⚓ 設標題錨點、🔗 連結(外部/錨點)、🖼 圖片、IG、目錄、— 分隔線,皆走自建彈窗。

### 3.6 圖示與 PWA

- 前台 favicon/app icon(`app/icon.png`、`app/apple-icon.png`)＋ `app/manifest.ts`：**主題色底 + 白 logo**,`start_url:"/"`。
- 後台(`/admin/*`)：`app/admin/manifest.webmanifest`(`start_url`/`scope` = `/admin`,standalone)＋ `public/admin-icon.png`/`admin-apple-icon.png`：**白底 + 黑 logo**;後台 `robots noindex`。

---

## 4. 約定（Do / Don't）

**Do**
- 主要動作一律 `bg-rose-brand` → hover `bg-rose-dark`,`rounded-lg`。
- 卡片 `rounded-xl border border-gray-100`;控制項 `rounded-lg`;徽章 `rounded-full`。
- 後台頁標題 `text-2xl font-bold text-gray-900`。
- 行動優先;全高側欄用 `h-dvh` + safe-area;表格次要欄用 `hidden md:/lg:/xl:table-cell`。
- 內容改動後若前台沒更新 → 用 `/admin/tools` 的「清除前台快取」(文章頁是 ISR `revalidate=300`;Cloudflare 另需 purge)。

**Don't**
- 不要 `bg-black` 主要按鈕、`rounded-sm` 卡片、`font-serif text-3xl` 後台標題、`uppercase tracking-widest` 後台按鈕。
- 不要在後台用 `font-serif`;不要用原生 `prompt/alert/confirm`。
- 不要對 Instagram iframe 設 `height`/`aspect-ratio`;不要在文章內文塞 `<script>`(會被消毒)。
- 不要把後台連結放進前台 Footer;不要讓後台 logo 變成超連結。

> 視覺改動請同步更新本檔與 `CLAUDE.md`,保持後台各頁一致。
