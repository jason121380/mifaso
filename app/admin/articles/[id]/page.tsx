import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import ArticleForm from "@/components/admin/ArticleForm";

interface Props { params: Promise<{ id: string }> }

export default async function EditArticlePage({ params }: Props) {
  const { id } = await params;
  const [article, categories, tags] = await Promise.all([
    prisma.article.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!article) notFound();

  const formData = {
    ...article,
    tags: article.tags.map((t) => ({ tagId: t.tagId, tag: t.tag })),
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/articles" className="text-gray-400 hover:text-black transition-colors text-sm">
          ← 文章列表
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="font-serif text-2xl font-bold text-gray-900 line-clamp-1">{article.title}</h1>
        {article.status === "PUBLISHED" && (
          <Link
            href={`/article/${article.slug}`}
            target="_blank"
            className="ml-auto text-xs text-rose-brand uppercase tracking-widest hover:underline"
          >
            前台預覽 →
          </Link>
        )}
      </div>
      <ArticleForm initialData={formData} categories={categories} allTags={tags} mode="edit" />
    </div>
  );
}
