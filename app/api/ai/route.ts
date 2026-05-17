import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";

function getClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, title, content, availableTags } = body;

  if (type === "titles") {
    if (!title && !content) {
      return NextResponse.json({ error: "需要主題或內文" }, { status: 400 });
    }
  } else if (!title) {
    return NextResponse.json({ error: "需要文章標題" }, { status: 400 });
  }

  const plainText = content
    ? content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 1500)
    : "";

  let prompt = "";

  if (type === "excerpt") {
    prompt = `你是台灣時尚美髮媒體「MIFASO 迷髮所」的編輯。
根據以下文章資訊，寫一段文章摘要（約 80～120 個繁體中文字），語氣親切、吸引人，讓讀者想繼續閱讀。
只輸出摘要文字，不要加任何說明或標題。

文章標題：${title}
文章內容片段：${plainText}`;

  } else if (type === "metaTitle") {
    prompt = `你是 SEO 專家。根據以下文章標題，生成一個適合搜尋引擎的 Meta 標題。
規則：
- 繁體中文
- 結尾加上「| MIFASO 迷髮所」
- 總長度不超過 70 字元
- 保留原標題核心關鍵字
只輸出 Meta 標題文字，不要任何說明。

文章標題：${title}`;

  } else if (type === "metaDescription") {
    prompt = `你是 SEO 專家。根據以下文章資訊，生成一段 Meta 描述。
規則：
- 繁體中文
- 120～155 字元
- 包含文章核心關鍵字
- 語氣簡潔、有吸引力，讓讀者想點擊
只輸出 Meta 描述文字，不要任何說明。

文章標題：${title}
文章內容片段：${plainText}`;

  } else if (type === "tags") {
    prompt = `你是台灣時尚美髮媒體「MIFASO 迷髮所」的編輯。
根據以下文章，從「可用標籤列表」中選出最相關的標籤（最多5個）。
只輸出標籤名稱，以逗號分隔，不要任何說明或標點（除了逗號）。

文章標題：${title}
文章內容片段：${plainText}
可用標籤列表：${availableTags}`;

  } else if (type === "titles") {
    prompt = `你是台灣時尚美髮媒體「MIFASO 迷髮所」的資深編輯與內容行銷高手。
根據以下主題與內文,寫出 6 個「高點擊率」的繁體中文文章標題。
規則:
- 繁體中文、台灣用語,符合美髮/時尚/生活美學調性
- 具體、有畫面或數字、能勾起好奇或痛點(例:數字盤點、How-to、季節時事、common mistake)
- 每個 18~32 字,不要浮誇農場標、不要加引號或書名號、不要編號
- 一行一個,只輸出 6 行標題,不要任何說明

主題 / 目前標題:${title || "(未提供,請依內文發想)"}
內文片段:${plainText || "(無)"}`;

  } else {
    return NextResponse.json({ error: "未知類型" }, { status: 400 });
  }

  const completion = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: type === "titles" ? 700 : 300,
    messages: [{ role: "user", content: prompt }],
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  return NextResponse.json({ result: text });
}
