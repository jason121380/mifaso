import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("admin123456", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@mifaso.com" },
    update: {},
    create: {
      name: "mifaso 管理員",
      email: "admin@mifaso.com",
      password,
      role: "ADMIN",
      bio: "mifaso 迷髮所主編",
    },
  });

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "makeup" },
      update: {},
      create: { name: "彩妝", slug: "makeup", description: "最新彩妝趨勢與教學", color: "#C9A84C", sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: "skincare" },
      update: {},
      create: { name: "保養", slug: "skincare", description: "護膚秘訣與產品評測", color: "#9A7A2E", sortOrder: 2 },
    }),
    prisma.category.upsert({
      where: { slug: "fashion" },
      update: {},
      create: { name: "時尚", slug: "fashion", description: "國際時裝週與趨勢報導", color: "#1A1A1A", sortOrder: 3 },
    }),
    prisma.category.upsert({
      where: { slug: "lifestyle" },
      update: {},
      create: { name: "生活", slug: "lifestyle", description: "精緻生活美學", color: "#6B6B6B", sortOrder: 4 },
    }),
    prisma.category.upsert({
      where: { slug: "fragrance" },
      update: {},
      create: { name: "香氛", slug: "fragrance", description: "香水與香氛世界", color: "#8B7355", sortOrder: 5 },
    }),
  ]);

  const tags = await Promise.all(
    ["夏季彩妝", "必買清單", "韓系", "法式", "抗老", "保濕", "極簡", "奢華"].map((name) =>
      prisma.tag.upsert({
        where: { slug: name },
        update: {},
        create: { name, slug: name },
      })
    )
  );

  await prisma.article.upsert({
    where: { slug: "2025-summer-makeup-trends" },
    update: {},
    create: {
      title: "2025 年夏季彩妝趨勢：裸感光澤肌統治全場",
      slug: "2025-summer-makeup-trends",
      excerpt: "今夏，「不妝感」妝容成為主角。從頂尖時尚週到社群媒體，裸感光澤肌正在重新定義當代美麗標準。",
      content: `<h2>裸感光澤肌的回歸</h2><p>2025 年夏季，彩妝界迎來了一場革命性的轉變。頂尖設計師在米蘭時裝週上釋放的訊號明確：<strong>真實、自然的美麗才是最強大的宣言</strong>。</p><h2>必備單品</h2><p>光澤感底妝、薄透遮瑕膏、以及略帶晒感的腮紅，是打造今夏妝容的三大關鍵。記得選擇含有保濕成分的產品，讓肌膚整日維持水潤感。</p><h2>眼妝重點</h2><p>眼妝以裸棕色調為主，搭配下眼瞼淡淡的珠光打亮，製造一種睡眼惺忪卻性感的慵懶感。</p>`,
      status: "PUBLISHED",
      featured: true,
      publishedAt: new Date(),
      metaTitle: "2025 夏季彩妝趨勢｜mifaso 迷髮所",
      metaDescription: "探索 2025 年夏季最熱門彩妝趨勢，從裸感光澤肌到簡約眼妝，讓你輕鬆跟上時尚步伐。",
      authorId: admin.id,
      categoryId: categories[0].id,
      tags: { create: [{ tagId: tags[0].id }, { tagId: tags[6].id }] },
    },
  });

  await prisma.article.upsert({
    where: { slug: "korean-skincare-layering" },
    update: {},
    create: {
      title: "韓系多層次保養法：打造玻璃肌的完整攻略",
      slug: "korean-skincare-layering",
      excerpt: "源自首爾的多層次保養法席捲全球，究竟什麼是「7層保養」？美容編輯親身實測帶你一次搞懂。",
      content: `<h2>什麼是多層次保養？</h2><p>韓系保養的核心理念是<strong>循序漸進地為肌膚補充養分</strong>。從最稀薄的質地開始，逐步疊加至最濃稠，讓每一層產品都能充分吸收。</p><h2>基本步驟</h2><ol><li>卸妝清潔</li><li>化妝水拍打</li><li>精華液</li><li>安瓶或精粹</li><li>乳液</li><li>乳霜</li><li>防曬（白天必備）</li></ol><p>關鍵在於<em>耐心等待每層吸收</em>，約 30 秒至 1 分鐘後再上下一層。</p>`,
      status: "PUBLISHED",
      featured: true,
      publishedAt: new Date(Date.now() - 86400000),
      metaTitle: "韓系多層次保養法完整攻略｜mifaso 迷髮所",
      metaDescription: "韓系玻璃肌保養法詳細教學，編輯親測 7 層保養步驟，讓你輕鬆複製首爾女生的透亮肌膚。",
      authorId: admin.id,
      categoryId: categories[1].id,
      tags: { create: [{ tagId: tags[2].id }, { tagId: tags[5].id }] },
    },
  });

  for (const { key, value } of [
    { key: "site_name", value: "mifaso 迷髮所" },
    { key: "site_tagline", value: "時尚・美髮・生活美學" },
    { key: "site_description", value: "mifaso 迷髮所，提供最前沿的美髮造型趨勢、彩妝保養與生活美學內容。" },
  ]) {
    await prisma.siteSettings.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  console.log("✅ Seed 完成");
  console.log(`管理員帳號: admin@mifaso.com`);
  console.log(`管理員密碼: admin123456`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
