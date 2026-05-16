import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function load(filename: string) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "seed-data", filename), "utf-8"));
}

async function main() {
  const users = load("users.json");
  const categories = load("categories.json");
  const tags = load("tags.json");
  const articles = load("articles.json");
  const articleTags = load("article_tags.json");

  console.log("Seeding users...");
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id: u.id, name: u.name, email: u.email, password: u.password,
        role: u.role, avatar: u.avatar ?? null, bio: u.bio ?? null,
        active: u.active === 1 || u.active === true,
        createdAt: new Date(u.createdAt), updatedAt: new Date(u.updatedAt),
      },
    });
  }

  console.log("Seeding categories...");
  for (const c of categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id, name: c.name, slug: c.slug,
        description: c.description ?? null, coverImage: c.coverImage ?? null,
        color: c.color ?? "#C9A84C", sortOrder: c.sortOrder ?? 0,
        createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt),
      },
    });
  }

  console.log("Seeding tags...");
  for (const t of tags) {
    await prisma.tag.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id, name: t.name, slug: t.slug,
        createdAt: new Date(t.createdAt),
      },
    });
  }

  console.log("Seeding articles...");
  for (const a of articles) {
    await prisma.article.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id, title: a.title, slug: a.slug,
        excerpt: a.excerpt ?? null, content: a.content,
        featuredImage: a.featuredImage ?? null, featuredImageAlt: a.featuredImageAlt ?? null,
        status: a.status, featured: a.featured === 1 || a.featured === true,
        viewCount: a.viewCount ?? 0,
        publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
        metaTitle: a.metaTitle ?? null, metaDescription: a.metaDescription ?? null,
        authorId: a.authorId, categoryId: a.categoryId ?? null,
        createdAt: new Date(a.createdAt), updatedAt: new Date(a.updatedAt),
      },
    });
  }

  console.log("Seeding article tags...");
  for (const at of articleTags) {
    await prisma.articleTag.upsert({
      where: { articleId_tagId: { articleId: at.articleId, tagId: at.tagId } },
      update: {},
      create: { articleId: at.articleId, tagId: at.tagId },
    });
  }

  console.log(`\nDone! Seeded: ${users.length} users, ${categories.length} categories, ${tags.length} tags, ${articles.length} articles`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
