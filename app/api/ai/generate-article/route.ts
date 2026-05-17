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
  const userId: string = user.id;
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

  // 蒐集站內既有文章用過的「真實」 Instagram 貼文網址(供模型挑選嵌入,絕不捏造)
  const igSource = await prisma.article.findMany({
    where: { status: "PUBLISHED", content: { contains: "instagram-media" } },
    select: { content: true },
    take: 60,
  });
  const igSet = new Set<string>();
  for (const r of igSource) {
    for (const m of r.content.matchAll(/data-instgrm-permalink="([^"]+)"/gi)) {
      const u = m[1].split("?")[0];
      if (/^https:\/\/www\.instagram\.com\/(p|reel|tv)\//i.test(u)) igSet.add(u);
    }
  }
  const igAllowed = [...igSet].slice(0, 12);

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
- 不要放 <script>、不要捏造外部連結、不要放圖片標籤(圖片由系統另外處理)
- Instagram:可在「相關且合適」的段落後嵌入 1~2 則,格式固定為
  <blockquote class="instagram-media" data-instgrm-permalink="網址" data-instgrm-version="14"></blockquote>
  網址**只能**從下方清單挑選,**嚴禁自行編造或修改**;若清單都不相關就完全不要放
  可用 Instagram 網址清單:${igAllowed.length ? igAllowed.join(" 、 ") : "(無,請勿放 IG)"}
- 用語、段落感、實用建議的寫法要貼近上面範例

內文配圖(bodyImages):提供 2~3 張要插入內文的圖片;每張一句英文攝影風格描述(prompt),
並指定 afterHeading = 內文中某個 <h2> 的「完整文字」(系統會把圖插在那個 <h2> 之後)、alt 為繁中說明。

只輸出以下 JSON:
{"title":"...","excerpt":"80~120字摘要","content":"<div data-toc=\\"true\\"></div>...","categorySlug":"上面其中一個 slug 或空字串","tagNames":["..."],"metaTitle":"含 | MIFASO 迷髮所,<=70字元","metaDescription":"120~155字元","featuredImagePrompt":"一句英文,描述適合當封面的攝影風格圖(人像/髮型/生活感,無文字浮水印)","bodyImages":[{"prompt":"english photo desc","afterHeading":"內文某個 h2 的完整文字","alt":"繁中說明"}]}`;

  let parsed: {
    title?: string; excerpt?: string; content?: string; categorySlug?: string;
    tagNames?: string[]; metaTitle?: string; metaDescription?: string; featuredImagePrompt?: string;
    bodyImages?: { prompt?: string; afterHeading?: string; alt?: string }[];
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

  // 安全:移除任何「不在站內既有真實清單」的 Instagram 嵌入(防模型捏造)
  content = content.replace(
    /<blockquote\b[^>]*class="[^"]*instagram-media[^"]*"[^>]*>[\s\S]*?<\/blockquote>/gi,
    (bq) => {
      const m = bq.match(/data-instgrm-permalink="([^"]+)"/i);
      const u = m ? m[1].split("?")[0] : "";
      return u && igSet.has(u)
        ? `<blockquote class="instagram-media" data-instgrm-permalink="${u}" data-instgrm-version="14"></blockquote>`
        : "";
    }
  );

  // slug 唯一
  let slug = generateSlug(title) || `ai-${Date.now().toString(36)}`;
  if (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // 產生並存檔一張圖,回傳 URL(失敗回 null,不影響文章建立)
  async function genImage(p: string, size: "1792x1024" | "1024x1024"): Promise<string | null> {
    try {
      const img = await client().images.generate({
        model: "dall-e-3",
        prompt: `${p}. Editorial fashion / hair / lifestyle photography, soft natural light, realistic, no text, no watermark, high quality.`,
        size,
        response_format: "b64_json",
        n: 1,
      });
      const b64 = img.data?.[0]?.b64_json;
      if (!b64) return null;
      const buf = Buffer.from(b64, "base64");
      const dir = join(process.cwd(), "public", "uploads", "ai");
      await mkdir(dir, { recursive: true });
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      await writeFile(join(dir, filename), buf);
      const url = `/uploads/ai/${filename}`;
      await prisma.media.create({
        data: {
          filename,
          originalName: `${title}.png`,
          url,
          size: buf.length,
          mimeType: "image/png",
          userId,
        },
      });
      return url;
    } catch {
      return null;
    }
  }

  let featuredImage: string | null = null;
  if (withImage && parsed.featuredImagePrompt) {
    featuredImage = await genImage(parsed.featuredImagePrompt, "1792x1024");
  }

  // 內文配圖(最多 3 張),插在指定 <h2> 之後
  if (withImage) {
    const imgs = (parsed.bodyImages ?? []).filter((b) => b?.prompt).slice(0, 3);
    for (const bi of imgs) {
      const url = await genImage(String(bi.prompt), "1024x1024");
      if (!url) continue;
      const alt = (bi.alt ?? title).toString().replace(/"/g, "").slice(0, 120);
      const fig = `\n<figure><img src="${url}" alt="${alt}" /><figcaption>${alt}</figcaption></figure>\n`;
      const want = (bi.afterHeading ?? "").replace(/<[^>]*>/g, "").trim();
      let inserted = false;
      if (want) {
        const re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content))) {
          if (m[1].replace(/<[^>]*>/g, "").trim().includes(want.slice(0, 12))) {
            const at = m.index + m[0].length;
            content = content.slice(0, at) + fig + content.slice(at);
            inserted = true;
            break;
          }
        }
      }
      if (!inserted) {
        const firstClose = content.indexOf("</h2>");
        if (firstClose !== -1) {
          const at = firstClose + 5;
          content = content.slice(0, at) + fig + content.slice(at);
        } else {
          content += fig;
        }
      }
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
      authorId: userId,
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
