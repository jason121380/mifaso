import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

const SITE_NAME = "MIFASO 迷髮所";
const JUNK_PATTERNS = [
  /在 Instagram 查看這則貼文[\s\S]*?分享的貼文/g,
  /本文目錄[\s\S]*?(?=[一-鿿])/g,
  /延伸閱讀：[^\n]*/g,
];

function cleanText(text: string): string {
  let t = text;
  for (const p of JUNK_PATTERNS) t = t.replace(p, " ");
  return t.replace(/\s+/g, " ").trim();
}

function makeMetaTitle(title: string): string {
  if (title.length <= 45) return `${title} | ${SITE_NAME}`;
  return `${title.substring(0, 43)}… | ${SITE_NAME}`;
}

function makeMetaDesc(raw: string, maxLen = 155): string {
  const text = cleanText(raw);
  // Split on Chinese sentence endings
  const sentences = text.split(/(?<=[。！？；])/);
  let result = "";
  for (const s of sentences) {
    if ((result + s).length <= maxLen) result += s;
    else break;
  }
  if (!result) result = text.substring(0, maxLen);
  if (result.length < text.length && !result.match(/[。！？]$/)) result = result.trimEnd() + "…";
  return result;
}

async function main() {
  const articles = JSON.parse(
    fs.readFileSync("/Users/jasonc/Desktop/mifaso_export/articles.json", "utf8")
  );

  let updated = 0;
  let notFound = 0;

  for (const a of articles) {
    const metaTitle = makeMetaTitle(a.title);
    const metaDescription = makeMetaDesc(a.description || a.title);

    const slug = a.slug;
    const existing = await prisma.article.findFirst({ where: { slug } });
    if (!existing) {
      notFound++;
      console.log("NOT FOUND:", slug);
      continue;
    }

    await prisma.article.update({
      where: { id: existing.id },
      data: { metaTitle, metaDescription },
    });

    updated++;
    console.log(`[${updated}] ${a.title.substring(0, 30)}`);
    console.log(`  → title: ${metaTitle}`);
    console.log(`  → desc:  ${metaDescription.substring(0, 80)}…`);
  }

  console.log(`\nDone: ${updated} updated, ${notFound} not found`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
