import prisma from "@/lib/prisma";
import ArticleForm from "@/components/admin/ArticleForm";
import Link from "next/link";

export default async function NewArticlePage() {
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/articles" className="text-gray-400 hover:text-black transition-colors text-sm">
          ← 文章列表
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="font-serif text-2xl font-bold text-gray-900">新增文章</h1>
      </div>
      <ArticleForm categories={categories} allTags={tags} mode="create" />
    </div>
  );
}
