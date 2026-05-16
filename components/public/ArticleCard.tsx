import Image from "next/image";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { ArticleCardProps } from "@/types";

interface Props {
  article: ArticleCardProps;
  variant?: "default" | "horizontal" | "featured";
}

export default function ArticleCard({ article, variant = "default" }: Props) {
  if (variant === "featured") {
    return (
      <article className="group relative overflow-hidden bg-black md:rounded-lg">
        <div className="aspect-[4/5] sm:aspect-[16/10] md:aspect-[16/9] relative">
          {article.featuredImage ? (
            <Image
              src={article.featuredImage}
              alt={article.featuredImageAlt ?? article.title}
              fill
              sizes="(max-width: 768px) 100vw, 1200px"
              className="object-cover opacity-80 group-hover:opacity-70 group-hover:scale-105 transition-all duration-700"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 md:p-12">
          {article.category && (
            <Link
              href={`/category/${article.category.slug}`}
              className="category-badge mb-3 md:mb-4 w-fit"
            >
              {article.category.name}
            </Link>
          )}
          <Link href={`/article/${article.slug}`}>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white font-bold leading-tight mb-3 md:mb-4 group-hover:text-rose-brand-light transition-colors">
              {article.title}
            </h2>
          </Link>
          {article.excerpt && (
            <p className="text-gray-300 text-sm md:text-base max-w-2xl line-clamp-2 mb-4">
              {article.excerpt}
            </p>
          )}
          <div className="flex items-center gap-3 text-gray-400 text-xs uppercase tracking-widest">
            <span>{article.author.name}</span>
            <span className="text-rose-brand">·</span>
            {article.publishedAt && <span>{formatDate(article.publishedAt)}</span>}
          </div>
        </div>
      </article>
    );
  }

  if (variant === "horizontal") {
    return (
      <article className="group flex gap-6 items-start">
        <Link href={`/article/${article.slug}`} className="flex-shrink-0 relative w-32 h-24 overflow-hidden bg-gray-100">
          {article.featuredImage ? (
            <Image
              src={article.featuredImage}
              alt={article.featuredImageAlt ?? article.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gray-200" />
          )}
        </Link>
        <div className="flex-1 min-w-0">
          {article.category && (
            <Link href={`/category/${article.category.slug}`} className="text-rose-brand text-xs uppercase tracking-widest">
              {article.category.name}
            </Link>
          )}
          <Link href={`/article/${article.slug}`}>
            <h3 className="font-serif text-base font-semibold mt-1 mb-2 line-clamp-2 group-hover:text-rose-brand transition-colors leading-snug">
              {article.title}
            </h3>
          </Link>
          {article.publishedAt && (
            <p className="text-xs text-gray-400">{formatDate(article.publishedAt)}</p>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="group">
      <Link href={`/article/${article.slug}`} className="block relative aspect-[4/3] overflow-hidden bg-gray-100 mb-4">
        {article.featuredImage ? (
          <Image
            src={article.featuredImage}
            alt={article.featuredImageAlt ?? article.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <span className="font-serif text-4xl text-gray-300">L</span>
          </div>
        )}
      </Link>
      {article.category && (
        <Link href={`/category/${article.category.slug}`} className="text-rose-brand text-xs uppercase tracking-widest">
          {article.category.name}
        </Link>
      )}
      <Link href={`/article/${article.slug}`}>
        <h3 className="font-serif text-xl font-semibold mt-2 mb-3 line-clamp-2 group-hover:text-rose-brand transition-colors leading-snug">
          {article.title}
        </h3>
      </Link>
      {article.excerpt && (
        <p className="text-gray-500 text-sm line-clamp-2 mb-3 leading-relaxed">
          {article.excerpt}
        </p>
      )}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>{article.author.name}</span>
        {article.publishedAt && (
          <>
            <span className="text-rose-brand">·</span>
            <span>{formatDate(article.publishedAt)}</span>
          </>
        )}
      </div>
    </article>
  );
}
