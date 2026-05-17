import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { formatDate, stripHtml, truncate } from "@/lib/utils";
import { renderArticleHtml } from "@/lib/article-html";
import { jsonLdGraph, articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import ArticleCard from "@/components/public/ArticleCard";
import InstagramEmbed from "@/components/public/InstagramEmbed";

interface Props { params: Promise<{ slug: string }> }

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const articles = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true },
    });
    return articles.map((a) => ({ slug: a.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.article.findUnique({
    where: { slug, status: "PUBLISHED" },
    include: { author: true, category: true, tags: { include: { tag: true } } },
  });
  if (!article) return { title: "文章不存在" };

  const description = article.metaDescription ?? truncate(stripHtml(article.excerpt ?? article.content), 160);
  const path = `/article/${article.slug}`;
  const tagNames = article.tags.map((t) => t.tag.name);
  const keywords = [
    ...tagNames,
    article.category?.name,
    "MIFASO",
    "迷髮所",
  ].filter(Boolean) as string[];
  return {
    title: article.metaTitle ?? article.title,
    description,
    keywords,
    authors: [{ name: article.author.name }],
    alternates: { canonical: path },
    openGraph: {
      url: path,
      title: article.title,
      description,
      images: article.featuredImage
        ? [{ url: article.featuredImage, alt: article.featuredImageAlt ?? article.title }]
        : [],
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      section: article.category?.name,
      authors: [article.author.name],
      tags: tagNames,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: article.featuredImage ? [article.featuredImage] : [],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await prisma.article.findUnique({
    where: { slug, status: "PUBLISHED" },
    include: {
      author: { select: { id: true, name: true, avatar: true, bio: true } },
      category: true,
      tags: { include: { tag: true } },
    },
  });

  if (!article) notFound();

  // Related articles
  const related = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      id: { not: article.id },
      OR: [
        { categoryId: article.categoryId ?? undefined },
        { tags: { some: { tagId: { in: article.tags.map((t) => t.tagId) } } } },
      ],
    },
    include: { author: { select: { id: true, name: true, avatar: true } }, category: true, tags: { include: { tag: true } } },
    take: 3,
    orderBy: { publishedAt: "desc" },
  });

  const seoDescription =
    article.metaDescription ?? truncate(stripHtml(article.excerpt ?? article.content), 160);

  const jsonLd = jsonLdGraph(
    articleJsonLd({
      title: article.title,
      slug: article.slug,
      description: seoDescription,
      image: article.featuredImage,
      imageAlt: article.featuredImageAlt,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      authorName: article.author.name,
      categoryName: article.category?.name,
      tags: article.tags.map((t) => t.tag.name),
    }),
    breadcrumbJsonLd([
      { name: "首頁", path: "/" },
      ...(article.category
        ? [{ name: article.category.name, path: `/category/${article.category.slug}` }]
        : []),
      { name: article.title, path: `/article/${article.slug}` },
    ])
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <InstagramEmbed />

      <article className="max-w-screen-xl mx-auto px-6">
        {/* Article header */}
        <header className="max-w-3xl mx-auto text-center py-12 md:py-16">
          {article.category && (
            <Link href={`/category/${article.category.slug}`} className="category-badge mb-6 inline-block">
              {article.category.name}
            </Link>
          )}
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            {article.title}
          </h1>
          {article.excerpt && (
            <p className="text-gray-500 text-lg md:text-xl leading-relaxed mb-8">
              {article.excerpt}
            </p>
          )}
          <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
            {article.author.avatar ? (
              <Image src={article.author.avatar} alt={article.author.name} width={36} height={36} className="rounded-full" />
            ) : (
              <div className="w-9 h-9 bg-black rounded-full flex items-center justify-center text-white text-xs font-serif">
                {article.author.name[0]}
              </div>
            )}
            <span className="text-black font-medium">{article.author.name}</span>
            {article.publishedAt && (
              <>
                <span className="text-rose-brand">·</span>
                <span>{formatDate(article.publishedAt)}</span>
              </>
            )}
          </div>
        </header>

        {/* Featured image */}
        {article.featuredImage && (
          <figure className="mb-12 -mx-6 md:mx-0">
            <div className="relative aspect-[16/9] w-full overflow-hidden">
              <Image
                src={article.featuredImage}
                alt={article.featuredImageAlt ?? article.title}
                fill
                className="object-cover"
                priority
              />
            </div>
            {article.featuredImageAlt && (
              <figcaption className="text-xs text-gray-400 text-center mt-3 italic">
                {article.featuredImageAlt}
              </figcaption>
            )}
          </figure>
        )}

        {/* Article content */}
        <div className="max-w-3xl mx-auto">
          <div
            className="prose prose-lg prose-headings:font-serif prose-headings:font-bold prose-a:text-rose-brand prose-blockquote:border-l-rose-brand prose-img:rounded-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderArticleHtml(article.content) }}
          />

          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="mt-12 pt-8 border-t border-gray-100">
              <div className="flex flex-wrap gap-3">
                {article.tags.map(({ tag }) => (
                  <Link
                    key={tag.id}
                    href={`/search?tag=${tag.slug}`}
                    className="text-xs uppercase tracking-widest border border-gray-200 px-4 py-2 text-gray-500 hover:border-rose-brand hover:text-rose-brand transition-colors"
                  >
                    {tag.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Author bio */}
          {article.author.bio && (
            <div className="mt-12 p-8 bg-gray-50 border-l-2 border-rose-brand">
              <div className="flex items-start gap-4">
                {article.author.avatar ? (
                  <Image src={article.author.avatar} alt={article.author.name} width={56} height={56} className="rounded-full flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center text-white font-serif text-xl flex-shrink-0">
                    {article.author.name[0]}
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-widest text-rose-brand mb-1">作者</p>
                  <p className="font-serif text-lg font-bold mb-2">{article.author.name}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{article.author.bio}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </article>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="max-w-screen-xl mx-auto px-6 mt-20 pt-16 border-t border-gray-100">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-widest text-rose-brand mb-2">More Stories</p>
            <h2 className="font-serif text-2xl font-bold">相關文章</h2>
          </div>
          <div className="article-grid">
            {related.map((r) => (
              <ArticleCard key={r.id} article={r} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
