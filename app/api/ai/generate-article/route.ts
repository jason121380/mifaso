import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function client() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY 未設定");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function strip(html: string, n: number) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "尚未設定 OPENAI_API_KEY,無法使用 AI 產文" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const topic = typeof body?.topic === "string" ? body.topic.trim().slice(0, 120) : "";
  if (!topic) return NextResponse.json({ error: "請提供文章主題" }, { status: 400 });
  const withImage = body?.withImage !== false;

  const [samples, categories, tags] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { title: true, excerpt: true, content: true },
      orderBy: { publishedAt: "desc" },
      take: 5,
    }),
    prisma.category.findMany({ select: { name: true, slug: true } }),
    prisma.tag.findMany({ select: { name: true }, take: 60 }),
  ]);

  const styleRef = samples
    .map((s, i) => `範例${i + 1}標題：${s.title}\n摘要：${s.excerpt ?? ""}\n內文片段：${strip(s.content, 500)}`)
    .join("\n---\n");

  const sys =
    "你是台灣時尚美髮媒體「MIFASO 迷髮所」的資深編輯,主題涵蓋美髮造型、彩妝保養、生活美學。" +
    "請完全使用繁體中文(台灣用語),語氣親切、專業、實用,風格與下列既有文章一致。" +
    "只輸出 JSON,不要任何額外文字。";

  const prompt = `請依主題撰寫一篇全新文章,風格、結構、長度需與本站既有文章一致。

主題:${topic}

既有文章風格參考:
${styleRef}

可選分類(用 slug):${categories.map((c) => `${c.name}(${c.slug})`).join("、")}
可用標籤(從中挑 3~6 個最相關的,或合理新增):${tags.map((t) => t.name).join("、")}

內文(content)要求:
- HTML;第一個元素固定是 <div data-toc="true"></div>(本站會自動產生目錄)
- 接著一段開場 <p>;之後用數個 <h2> 分段,每段 2~4 個 <p>;可用 <h3> 細分;結尾一段總結 <p>
- 純文字約 900~1600 字;標題簡短(勿把整段塞進 <h>)
- 不要放 <script>、不要捏造外部連結或 Instagram 連結、不要放圖片標籤(圖片由系統另外處理)
- 用語、段落感、實用建議的寫法要貼近上面範例

只輸出以下 JSON:
{"title":"...","excerpt":"80~120字摘要","content":"<div data-toc=\\"true\\"></div>...","categorySlug":"上面其中一個 slug 或空字串","tagNames":["..."],"metaTitle":"含 | MIFASO 迷髮所,<=70字元","metaDescription":"120~155字元","featuredImagePrompt":"一句英文,描述適合當封面的攝影風格圖(人像/髮型/生活感,無文字浮水印)"}`;

  let parsed: {
    title?: string; excerpt?: string; content?: string; categorySlug?: string;
    tagNames?: string[]; metaTitle?: string; metaDescription?: string; featuredImagePrompt?: string;
  };
  try {
    const c = await client().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: prompt },
      ],
    });
    parsed = JSON.parse(c.choices[0]?.message?.content ?? "{}");
  } catch (e) {
    return NextResponse.json({ error: "AI 產生失敗:" + String(e instanceof Error ? e.message : e) }, { status: 502 });
  }

  const title = (parsed.title ?? topic).trim().slice(0, 200);
  let content = (parsed.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "AI 未回傳內文" }, { status: 502 });
  if (!/data-toc/i.test(content)) content = '<div data-toc="true"></div>\n' + content;

  // slug 唯一
  let slug = generateSlug(title) || `ai-${Date.now().toString(36)}`;
  if (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // 封面圖(best-effort)
  let featuredImage: string | null = null;
  if (withImage && parsed.featuredImagePrompt) {
    try {
      const img = await client().images.generate({
        model: "dall-e-3",
        prompt: `${parsed.featuredImagePrompt}. Editorial fashion/hair photography, soft natural light, no text, no watermark, high quality.`,
        size: "1792x1024",
        response_format: "b64_json",
        n: 1,
      });
      const b64 = img.data?.[0]?.b64_json;
      if (b64) {
        const buf = Buffer.from(b64, "base64");
        const folder = "ai";
        const dir = join(process.cwd(), "public", "uploads", folder);
        await mkdir(dir, { recursive: true });
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
        await writeFile(join(dir, filename), buf);
        featuredImage = `/uploads/${folder}/${filename}`;
        await prisma.media.create({
          data: {
            filename,
            originalName: `${title}.png`,
            url: featuredImage,
            size: buf.length,
            mimeType: "image/png",
            userId: user.id,
          },
        });
      }
    } catch {
      /* 圖片失敗不影響文章建立 */
    }
  }

  const category = parsed.categorySlug
    ? await prisma.category.findUnique({ where: { slug: parsed.categorySlug } })
    : null;

  // 標籤:找不到就建立
  const tagIds: string[] = [];
  for (const raw of (parsed.tagNames ?? []).slice(0, 8)) {
    const name = String(raw).trim().slice(0, 40);
    if (!name) continue;
    let tag = await prisma.tag.findFirst({ where: { name } });
    if (!tag) {
      const tslug = generateSlug(name) || `tag-${Date.now().toString(36)}`;
      tag = await prisma.tag.create({ data: { name, slug: tslug } }).catch(() => null);
    }
    if (tag) tagIds.push(tag.id);
  }

  const article = await prisma.article.create({
    data: {
      title,
      slug,
      excerpt: (parsed.excerpt ?? "").trim().slice(0, 300) || null,
      content,
      featuredImage,
      featuredImageAlt: featuredImage ? title : null,
      status: "DRAFT",
      featured: false,
      categoryId: category?.id ?? null,
      authorId: user.id,
      metaTitle: (parsed.metaTitle ?? "").trim().slice(0, 120) || null,
      metaDescription: (parsed.metaDescription ?? "").trim().slice(0, 200) || null,
      tags: tagIds.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
    },
    select: { id: true },
  });

  return NextResponse.json({
    id: article.id,
    title,
    hasImage: !!featuredImage,
    note: "已建立草稿。請在編輯器檢視、補上 Instagram 嵌入(系統不會自動捏造 IG 連結)、確認後再發布。",
  });
}
