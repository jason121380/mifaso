import { Prisma } from "@prisma/client";

/**
 * 卡片（ArticleCard）需要的最小欄位集。所有「列表 / 格狀」查詢一律用這個 select，
 * 不要用 include —— include 會連整篇 content（HTML，單篇可數十 KB）與 tags 都撈回來，
 * 但卡片完全用不到，白白拖慢首頁 / 分類 / 搜尋 / 相關文章。
 */
export const articleCardSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  featuredImage: true,
  featuredImageAlt: true,
  publishedAt: true,
  viewCount: true,
  author: { select: { name: true, avatar: true } },
  category: { select: { name: true, slug: true, color: true } },
} satisfies Prisma.ArticleSelect;
