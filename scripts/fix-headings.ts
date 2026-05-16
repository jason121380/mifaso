import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function downgradeHeadings(html: string): string {
  return html
    .replace(/<h1(\s[^>]*)?>/gi, "<h2$1>")
    .replace(/<\/h1>/gi, "</h2>")
    .replace(/<h2(\s[^>]*)?>/gi, "<h3$1>")
    .replace(/<\/h2>/gi, "</h3>");
}

async function main() {
  const articles = await prisma.article.findMany({ select: { id: true, title: true, content: true } });
  let updated = 0;

  for (const a of articles) {
    if (!/<h1[\s>]/i.test(a.content) && !/<h2[\s>]/i.test(a.content)) continue;
    const fixed = downgradeHeadings(a.content);
    await prisma.article.update({ where: { id: a.id }, data: { content: fixed } });
    console.log(`Fixed: ${a.title.substring(0, 50)}`);
    updated++;
  }

  console.log(`\nDone! Updated ${updated}/${articles.length} articles`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
