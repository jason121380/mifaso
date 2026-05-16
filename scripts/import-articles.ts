import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const SRC_IMAGES = "/Users/jasonc/Desktop/mifaso_export/images";
const DST_IMAGES = path.join(__dirname, "../public/uploads");
const JSON_FILE  = "/Users/jasonc/Desktop/mifaso_export/articles.json";

interface Paragraph { tag: string; text: string }
interface ArticleExport {
  slug: string;
  title: string;
  date: string;
  categories: string[];
  tags: string[];
  description: string;
  cover_image: string;
  paragraphs: Paragraph[];
}

function buildHtml(paragraphs: Paragraph[]): string {
  const li_buffer: string[] = [];
  const chunks: string[] = [];

  function flushList() {
    if (li_buffer.length) {
      chunks.push(`<ul>${li_buffer.map(t => `<li>${t}</li>`).join("")}</ul>`);
      li_buffer.length = 0;
    }
  }

  for (const p of paragraphs) {
    const text = p.text.trim();
    if (!text) continue;

    if (p.tag === "li") {
      li_buffer.push(text);
    } else {
      flushList();
      if (["h2","h3","h4"].includes(p.tag)) {
        chunks.push(`<${p.tag}>${text}</${p.tag}>`);
      } else {
        chunks.push(`<p>${text}</p>`);
      }
    }
  }
  flushList();
  return chunks.join("\n");
}

async function main() {
  fs.mkdirSync(DST_IMAGES, { recursive: true });

  const articles: ArticleExport[] = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));

  // Get or create admin user
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("找不到管理員帳號，請先執行 seed");

  // Upsert categories
  const catMap: Record<string, string> = {};
  const allCats = [...new Set(articles.flatMap(a => a.categories))];
  for (const name of allCats) {
    const slug = name.replace(/\s+/g, "-").toLowerCase();
    const cat = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug, sortOrder: 0 },
    });
    catMap[name] = cat.id;
  }
  console.log(`✓ 分類: ${Object.keys(catMap).join(", ")}`);

  // Upsert tags
  const tagMap: Record<string, string> = {};
  const allTags = [...new Set(articles.flatMap(a => a.tags))];
  for (const name of allTags) {
    const slug = name.replace(/\s+/g, "-").toLowerCase();
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    tagMap[name] = tag.id;
  }
  console.log(`✓ 標籤: ${allTags.length} 個`);

  // Import articles
  let imported = 0, skipped = 0;
  for (const art of articles) {
    // Copy cover image
    let featuredImage = "";
    if (art.cover_image) {
      const fname = art.cover_image.split("/").pop()!;
      const src = path.join(SRC_IMAGES, fname);
      const dst = path.join(DST_IMAGES, fname);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
      }
      featuredImage = `/uploads/${fname}`;
    }

    const content = buildHtml(art.paragraphs);
    const publishedAt = new Date(art.date);
    const categoryId = art.categories[0] ? catMap[art.categories[0]] : undefined;
    const tagIds = art.tags.map(t => tagMap[t]).filter(Boolean);

    try {
      await prisma.article.upsert({
        where: { slug: art.slug },
        update: {},
        create: {
          title: art.title,
          slug: art.slug,
          excerpt: art.description?.slice(0, 300) || "",
          content,
          featuredImage,
          status: "PUBLISHED",
          featured: false,
          publishedAt,
          authorId: admin.id,
          ...(categoryId ? { categoryId } : {}),
          ...(tagIds.length ? {
            tags: { create: tagIds.map(id => ({ tagId: id })) }
          } : {}),
        },
      });
      imported++;
    } catch (e: any) {
      console.error(`✗ ${art.title}: ${e.message}`);
      skipped++;
    }
  }

  // Copy remaining images (inline images in content)
  const allSrcFiles = fs.readdirSync(SRC_IMAGES);
  let imgCopied = 0;
  for (const fname of allSrcFiles) {
    const dst = path.join(DST_IMAGES, fname);
    if (!fs.existsSync(dst)) {
      fs.copyFileSync(path.join(SRC_IMAGES, fname), dst);
      imgCopied++;
    }
  }

  console.log(`\n✅ 完成！`);
  console.log(`   文章: ${imported} 篇匯入，${skipped} 篇跳過`);
  console.log(`   圖片: ${allSrcFiles.length} 張複製到 public/uploads/`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
