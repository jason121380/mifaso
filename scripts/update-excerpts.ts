import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

const prisma = new PrismaClient();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function generateExcerpt(title: string, content: string, category: string): Promise<string> {
  const plain = stripHtml(content).substring(0, 1200);

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `你是台灣時尚美髮媒體「MIFASO 迷髮所」的編輯。
根據以下文章，寫一段文章摘要，讓讀者一眼就想點進去閱讀。

規則：
- 繁體中文
- 80～120 字
- 語氣親切、有吸引力
- 點出文章核心價值或重點
- 不要用「本文」「這篇文章」開頭
- 只輸出摘要文字，不加任何說明

分類：${category}
標題：${title}
內文片段：${plain}`,
      },
    ],
  });

  return res.choices[0]?.message?.content?.trim() ?? "";
}

async function main() {
  const articles = await prisma.article.findMany({
    select: {
      id: true,
      title: true,
      content: true,
      category: { select: { name: true } },
    },
    orderBy: { publishedAt: "desc" },
  });

  console.log(`Updating excerpts for ${articles.length} articles...\n`);

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const category = a.category?.name ?? "未分類";

    try {
      const excerpt = await generateExcerpt(a.title, a.content, category);
      await prisma.article.update({ where: { id: a.id }, data: { excerpt } });
      console.log(`[${i + 1}/${articles.length}] ${a.title.substring(0, 35)}`);
      console.log(`  → ${excerpt.substring(0, 60)}…`);
    } catch (e: any) {
      console.error(`  ✗ ${a.title.substring(0, 30)}: ${e.message}`);
    }

    // Avoid rate limit
    if ((i + 1) % 5 === 0) await sleep(500);
  }

  console.log("\nDone!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
