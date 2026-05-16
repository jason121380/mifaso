import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateSlug } from "@/lib/utils";
import { z } from "zod";

const ArticleSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  featuredImage: z.string().optional(),
  featuredImageAlt: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  featured: z.boolean().default(false),
  categoryId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  publishedAt: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 20);
  const status = searchParams.get("status");
  const search = searchParams.get("search") ?? "";
  const categoryId = searchParams.get("categoryId");

  const where: any = {};
  if (status) where.status = status;
  if (search) where.OR = [
    { title: { contains: search, mode: "insensitive" } },
    { excerpt: { contains: search, mode: "insensitive" } },
  ];
  if (categoryId) where.categoryId = categoryId;

  // Non-admin/editor users only see their own articles
  const user = session.user as any;
  if (user.role === "AUTHOR") where.authorId = user.id;

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: true,
        tags: { include: { tag: true } },
      },
      orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.article.count({ where }),
  ]);

  return NextResponse.json({ articles, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = ArticleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const slug = data.slug || generateSlug(data.title) || `article-${Date.now()}`;
  const user = session.user as any;

  const existing = await prisma.article.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "此網址已被使用" }, { status: 409 });

  const article = await prisma.article.create({
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt,
      content: data.content,
      featuredImage: data.featuredImage,
      featuredImageAlt: data.featuredImageAlt,
      status: data.status,
      featured: data.featured,
      categoryId: data.categoryId || null,
      authorId: user.id,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      publishedAt: data.status === "PUBLISHED" ? (data.publishedAt ? new Date(data.publishedAt) : new Date()) : null,
      tags: data.tagIds?.length
        ? { create: data.tagIds.map((tagId: string) => ({ tagId })) }
        : undefined,
    },
    include: { author: { select: { id: true, name: true } }, category: true, tags: { include: { tag: true } } },
  });

  return NextResponse.json(article, { status: 201 });
}
