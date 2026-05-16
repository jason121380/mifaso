import type { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import ArticleCard from "@/components/public/ArticleCard";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 12;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const cat = await prisma.category.findUnique({ where: { slug } });
  if (!cat) return { title: "分類不存在" };
  const description =
    cat.description ?? `探索 MIFASO 迷髮所「${cat.name}」相關的精選美髮、時尚與生活美學文章。`;
  const path = `/category/${cat.slug}`;
  return {
    title: cat.name,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", url: path, title: cat.name, description },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug: rawSlug }, sp] = await Promise.all([params, searchParams]);
  const slug = decodeURIComponent(rawSlug);
  const page = Number(sp.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;

  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) notFound();

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED", categoryId: category.id },
      include: { author: { select: { id: true, name: true, avatar: true } }, category: true, tags: { include: { tag: true } } },
      orderBy: { publishedAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.article.count({ where: { status: "PUBLISHED", categoryId: category.id } }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-screen-xl mx-auto px-6">
      {/* Header */}
      <header className="text-center py-16 md:py-20 border-b border-gray-100 mb-16">
        <p className="text-xs uppercase tracking-widest text-rose-brand mb-4">Category</p>
        <h1 className="font-serif text-5xl md:text-6xl font-bold mb-4">{category.name}</h1>
        {category.description && (
          <p className="text-gray-500 text-lg max-w-xl mx-auto">{category.description}</p>
        )}
        <div className="gold-line mt-8" />
      </header>

      {/* Articles grid */}
      {articles.length > 0 ? (
        <>
          <div className="article-grid mb-16">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex justify-center gap-2 mb-20">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={`?page=${p}`}
                  className={`w-10 h-10 flex items-center justify-center text-sm border transition-colors ${
                    p === page
                      ? "bg-black text-white border-black"
                      : "border-gray-200 text-gray-500 hover:border-rose-brand hover:text-rose-brand"
                  }`}
                >
                  {p}
                </a>
              ))}
            </nav>
          )}
        </>
      ) : (
        <div className="text-center py-24">
          <p className="font-serif text-2xl text-gray-300 mb-4">尚無文章</p>
          <p className="text-gray-400 text-sm">此分類目前沒有已發布的文章</p>
        </div>
      )}
    </div>
  );
}
