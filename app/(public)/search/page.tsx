import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import ArticleCard from "@/components/public/ArticleCard";
import SearchInput from "@/components/public/SearchInput";

interface Props { searchParams: Promise<{ q?: string; tag?: string; page?: string }> }

export const metadata: Metadata = {
  title: "搜尋文章",
  description: "搜尋 MIFASO 迷髮所所有美髮美妝時尚相關文章",
};

export const dynamic = "force-dynamic";
const PAGE_SIZE = 12;

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const tag = sp.tag?.trim() ?? "";
  const page = Number(sp.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    status: "PUBLISHED" as const,
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { excerpt: { contains: q, mode: "insensitive" as const } },
        { content: { contains: q, mode: "insensitive" as const } },
      ],
    }),
    ...(tag && { tags: { some: { tag: { slug: tag } } } }),
  };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: { author: { select: { id: true, name: true, avatar: true } }, category: true, tags: { include: { tag: true } } },
      orderBy: { publishedAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.article.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const displayTerm = q || (tag ? `#${tag}` : "");

  return (
    <div className="max-w-screen-xl mx-auto px-6">
      <header className="text-center py-16 border-b border-gray-100 mb-16">
        <p className="text-xs uppercase tracking-widest text-rose-brand mb-4">Search</p>
        <h1 className="font-serif text-4xl md:text-5xl font-bold mb-8">搜尋文章</h1>
        <div className="max-w-lg mx-auto">
          <SearchInput defaultValue={q} />
        </div>
      </header>

      {displayTerm && (
        <p className="text-sm text-gray-500 mb-8">
          搜尋「<span className="text-rose-brand font-medium">{displayTerm}</span>」，共找到 {total} 篇文章
        </p>
      )}

      {articles.length > 0 ? (
        <>
          <div className="article-grid mb-16">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="flex justify-center gap-2 mb-20">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={`?q=${q}&page=${p}`}
                  className={`w-10 h-10 flex items-center justify-center text-sm border transition-colors ${
                    p === page ? "bg-black text-white border-black" : "border-gray-200 text-gray-500 hover:border-rose-brand hover:text-rose-brand"
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
          <p className="font-serif text-3xl text-gray-200 mb-4">
            {displayTerm ? "找不到相關文章" : "輸入關鍵字開始搜尋"}
          </p>
          <p className="text-gray-400 text-sm">試試看其他關鍵字</p>
        </div>
      )}
    </div>
  );
}
