import { Article, Category, Tag, User, Media } from "@prisma/client";

export type ArticleWithRelations = Article & {
  author: Pick<User, "id" | "name" | "avatar">;
  category: Category | null;
  tags: { tag: Tag }[];
};

export type ArticleCardProps = Pick<
  Article,
  "id" | "title" | "slug" | "excerpt" | "featuredImage" | "featuredImageAlt" | "publishedAt" | "viewCount"
> & {
  author: Pick<User, "name" | "avatar">;
  category: Pick<Category, "name" | "slug" | "color"> | null;
  tags?: { tag: Pick<Tag, "name" | "slug"> }[];
};

export type CategoryWithCount = Category & { _count: { articles: number } };

export type MediaItem = Media & { uploadedBy: Pick<User, "name"> };

export type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
