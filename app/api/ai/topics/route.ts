import { NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FALLBACK = [
  "2025 秋冬最顯白的染髮色推薦",
  "細軟髮也能蓬鬆一整天的吹整技巧",
  "換季頭皮敏感的正確保養步驟",
  "韓系空氣瀏海自己剪的失敗重點",
  "上班族 5 分鐘快速編髮造型",
  "受損髮的居家深層護髮全攻略",
];

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ topics: FALLBACK, ai: false });
  }

  try {
    const titles = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { title: true },
      orderBy: { publishedAt: "desc" },
      take: 30,
    });
    const c = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是台灣美髮時尚媒體「MIFASO 迷髮所」的選題編輯,只輸出 JSON。",
        },
        {
          role: "user",
          content:
            `根據既有文章主題,提出 8 個全新、不重複、讀者會想點的繁體中文文章主題(每個 12~24 字,實用、具體)。\n既有標題:\n${titles
              .map((t) => t.title)
              .join("\n")}\n只輸出:{"topics":["...","..."]}`,
        },
      ],
    });
    const j = JSON.parse(c.choices[0]?.message?.content ?? "{}");
    const topics = Array.isArray(j?.topics) && j.topics.length ? j.topics.slice(0, 8) : FALLBACK;
    return NextResponse.json({ topics, ai: true });
  } catch {
    return NextResponse.json({ topics: FALLBACK, ai: false });
  }
}
