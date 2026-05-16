import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateSlug } from "@/lib/utils";
import { z } from "zod";

const UpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().min(1).optional(),
  featuredImage: z.string().nullable().optional(),
  featuredImageAlt: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  featured: z.boolean().optional(),
  categoryId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  publishedAt: z.string().nullable().optional(),
});

async function canModify(articleId: string, userId: string, role: string) {
  if (role === "ADMIN" || role === "EDITOR") return true;
  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { authorId: true } });
  return article?.authorId === userId;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
    include: { author: { select: { id: true, name: true, avatar: true } }, category: true, tags: { include: { tag: true } } },
  });
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(article);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = session.user as any;
  if (!(await canModify(id, user.id, user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  if (data.slug) {
    const conflict = await prisma.article.findFirst({ where: { slug: data.slug, id: { not: id } } });
    if (conflict) return NextResponse.json({ error: "此網址已被使用" }, { status: 409 });
  } else if (data.title) {
    data.slug = generateSlug(data.title);
  }

  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { tagIds, ...updateFields } = data;

  const article = await prisma.article.update({
    where: { id },
    data: {
      ...updateFields,
      publishedAt: data.status === "PUBLISHED" && !existing.publishedAt
        ? new Date()
        : data.publishedAt === null ? null : data.publishedAt ? new Date(data.publishedAt) : undefined,
      tags: tagIds !== undefined
        ? { deleteMany: {}, create: tagIds.map((tagId: string) => ({ tagId })) }
        : undefined,
    },
    include: { author: { select: { id: true, name: true } }, category: true, tags: { include: { tag: true } } },
  });

  return NextResponse.json(article);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = session.user as any;
  if (!(await canModify(id, user.id, user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.article.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
