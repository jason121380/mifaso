import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import ArticleCard from "@/components/public/ArticleCard";
import prisma from "@/lib/prisma";

export const metadata: Metadata = {
  title: { absolute: "MIFASO 迷髮所 — 時尚・美髮・生活美學" },
  description: "MIFASO 迷髮所，提供最前沿的美髮造型趨勢、彩妝保養與生活美學內容。",
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: "MIFASO 迷髮所 — 時尚・美髮・生活美學",
    description: "MIFASO 迷髮所，提供最前沿的美髮造型趨勢、彩妝保養與生活美學內容。",
  },
};

export const revalidate = 60;

async function getHomeData() {
  const [featuredArticles, recentArticles, categories] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED", featured: true },
      include: { author: { select: { id: true, name: true, avatar: true } }, category: true, tags: { include: { tag: true } } },
      orderBy: { publishedAt: "desc" },
      take: 3,
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      include: { author: { select: { id: true, name: true, avatar: true } }, category: true, tags: { include: { tag: true } } },
      orderBy: { publishedAt: "desc" },
      take: 9,
    }),
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { articles: { where: { status: "PUBLISHED" } } } } },
    }),
  ]);

  return { featuredArticles, recentArticles, categories };
}

export default async function HomePage() {
  const { featuredArticles, recentArticles, categories } = await getHomeData();

  const hero = featuredArticles[0];
  const subFeatured = featuredArticles.slice(1, 3);

  return (
    <>
      {/* Hero Section */}
      {hero && (
        <section className="max-w-screen-xl mx-auto md:px-6 mb-12 md:mb-16">
          <ArticleCard article={hero} variant="featured" />
        </section>
      )}


      {/* Sub-featured + Sidebar */}
      <section className="max-w-screen-xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main content */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-4 mb-10">
              <h2 className="font-serif text-2xl font-bold">精選報導</h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {subFeatured.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </div>

          {/* Sidebar: recent */}
          <div className="lg:border-l lg:border-gray-100 lg:pl-12">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="font-serif text-lg font-bold whitespace-nowrap">最新文章</h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="flex flex-col gap-8">
              {recentArticles.slice(0, 5).map((article) => (
                <ArticleCard key={article.id} article={article} variant="horizontal" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-screen-xl mx-auto px-6 mb-20">
        <div className="luxury-divider">
          <span className="font-serif text-sm tracking-widest text-rose-brand uppercase">Latest</span>
        </div>
      </div>

      {/* All recent articles grid */}
      <section className="max-w-screen-xl mx-auto px-6 mb-20">
        <div className="article-grid">
          {recentArticles.slice(3).map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
        <div className="text-center mt-16">
          <Link href="/search" className="btn-outline">
            瀏覽更多文章
          </Link>
        </div>
      </section>

      {/* Categories showcase */}
      <section className="border-t border-gray-100 py-16">
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="luxury-divider mb-10">
            <span className="font-serif text-sm tracking-widest text-rose-brand uppercase">探索主題</span>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="group px-6 py-4 border border-gray-200 hover:border-rose-brand hover:bg-rose-50 transition-all rounded-lg"
              >
                <span className="text-sm font-medium text-gray-800 group-hover:text-rose-brand transition-colors">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
