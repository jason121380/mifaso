import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// SEO-optimized tag mapping: article id slug → tag names
// Tags: real search keywords, 2-8 chars, no brand names, no generic terms
const TAG_MAP: Record<string, string[]> = {
  // 下雨天頭髮炸毛
  "cmp7yowv000bg9qetu73tfa48": ["雨天髮型", "頭髮毛躁", "髮型扁塌", "梅雨季護髮", "雨天造型"],
  // 換季頭皮癢癢
  "cmp7yowv200bi9qetzhynbqmz": ["換季頭皮", "頭皮屑改善", "頭皮保養", "頭皮搔癢", "頭皮護理"],
  // 燙髮捲度不持久
  "cmp7yowuy00be9qetno9sfs9m": ["燙髮護理", "髮色持久", "護髮重點", "燙染後護髮", "頭髮光澤"],
  // 過年禁忌
  "cmp7yowuq00b89qethfc95n9r": ["過年禁忌", "春節禁忌", "新年習俗", "農曆新年", "節日禁忌"],
  // 年底脫單男生髮型
  "cmp7yowut00ba9qetainbc0su": ["男生髮型", "秋冬髮型趨勢", "男生燙髮", "2025髮型", "韓系男髮"],
  // 不讓出油扁塌春節
  "cmp7yowuw00bc9qeteppn1cin": ["頭皮出油", "油性頭皮控油", "髮型扁塌", "頭皮護理", "春節保養"],
  // 2025秋冬髮色趨勢
  "cmp7yowuk00b49qethffkcc1m": ["2025髮色趨勢", "韓國女星髮色", "秋冬染髮", "流行髮色", "韓系髮色"],
  // 雨季衣服曬不乾
  "cmp7yowuh00b29qetbrb6eczn": ["梅雨季生活", "衣服快速乾", "室內晾衣", "雨天生活", "居家小撇步"],
  // 夏天頭皮味
  "cmp7yowue00b09qetlrrc23io": ["頭皮異味", "頭皮出油", "油臭味消除", "夏天頭皮", "頭皮清潔"],
  // 日系生甜甜圈
  "cmp7yowub00ay9qetf29eoydo": ["生甜甜圈", "日系甜點", "台北甜點推薦", "甜甜圈推薦", "台灣美食"],
  // 雨天穿搭KOL
  "cmp7yowu900aw9qett1zydg7v": ["雨天穿搭", "下雨天造型", "穿搭靈感", "時髦穿搭", "KOL穿搭"],
  // 頭皮出油梅雨季
  "cmp7yowu500au9qetq4m1w0ty": ["頭皮出油救星", "梅雨季護髮", "頭皮氣味", "扁塌髮改善", "控油洗髮"],
  // 轉運方法
  "cmp7yowu200as9qethctbzokg": ["轉運方法", "開運秘訣", "甩掉霉運", "招財方法", "改運風水"],
  // 2025短髮燙髮趨勢
  "cmp7yowun00b69qetk9z3idtq": ["短髮燙髮", "復古捲髮", "小顏髮型", "減齡髮型", "2025燙髮"],
  // 難哄白敬亭微分碎蓋
  "cmp7yowtw00am9qet5qwvv7m3": ["微分碎蓋", "白敬亭髮型", "男生蓋頭", "韓系男髮型", "韓劇男主"],
  // 矯色補色洗髮精
  "cmp7yowtz00ao9qetq3r3x73p": ["矯色洗髮精", "補色洗髮精", "染髮護色", "髮色變黃", "護色方法"],
  // 台北手作課程
  "cmp7yowtt00ak9qet7g5zha9a": ["台北手作課程", "療癒體驗活動", "閨蜜約會", "調香體驗", "銀飾手作"],
  // 2025免漂髮色
  "cmp7yowtq00ai9qethb5f7uca": ["免漂髮色", "顯白髮色推薦", "摩卡慕斯髮色", "冷茶棕", "2025染髮"],
  // 2025秋冬層次剪
  "cmp7yowtn00ag9qety9j52tz7": ["層次剪", "秋冬女生髮型", "修飾臉型", "日系捲髮", "2025髮型趨勢"],
  // 美髮禁忌穿衣服
  "cmp7yowtk00ae9qetmzht5zrm": ["美髮注意事項", "染燙禁忌", "美髮師建議", "髮廊須知", "染髮技巧"],
  // 影后楊謹華謝盈萱
  "cmp7yowti00ac9qetybl0zddj": ["長髮保養", "凍齡髮型", "頭髮護理秘訣", "台劇女星造型", "女生長髮"],
  // 赤峰街刨冰
  "cmp7yowtg00aa9qetile3hri0": ["赤峰街美食", "台北日系刨冰", "中山站甜點", "網美打卡", "台北探店"],
  // 西門拍貼機
  "cmp7yowte00a89qete4lodt4p": ["韓國拍貼機", "西門町拍貼", "台北拍貼推薦", "韓系拍貼", "人生四格"],
  // 鬼月禁忌
  "cmp7yowtd00a69qetdtmz22lx": ["農曆七月禁忌", "鬼月注意", "鬼門開", "淨化方法", "中元節習俗"],
  // 信義區復古咖啡廳
  "cmp7yowtb00a49qet4klxgzm2": ["信義區咖啡廳", "復古咖啡廳", "台北探店", "昭和風格", "台北網美咖啡"],
  // 大安區ICONI HAIR
  "cmp7yowt900a29qet6bkqd6ot": ["大安區髮廊", "台北染髮推薦", "質感髮色", "捷運旁髮廊", "大安區美髮"],
  // 淚之女王金智媛
  "cmp7yowsy009q9qetvy5fc4cp": ["金智媛髮型", "淚之女王造型", "韓劇女星髮型", "韓星同款造型", "女神長髮"],
  // 中山區縮毛矯正一刀切
  "cmp7yowsx009o9qetbcqiqbzy": ["縮毛矯正推薦", "一刀切短髮", "中山區髮廊", "幼態感短髮", "短髮燙髮"],
  // 2024春夏必買單品
  "cmp7yowsv009m9qet8zamqgoy": ["春夏必買單品", "日本服飾推薦", "流行穿搭", "2024流行", "時髦穿搭"],
  // 染燙同天生理期染髮
  "cmp7yowss009i9qetmzgy9z0o": ["染燙同天", "生理期染髮", "染髮注意事項", "美髮知識", "護髮教學"],
  // 養髮春天
  "cmp7yowsu009k9qethaelwob4": ["春天養髮", "預防掉髮", "頭皮保養", "護髮重點", "頭髮生長"],
  // 春節追劇韓劇
  "cmp7yowsr009g9qet7yzuezdu": ["韓劇推薦", "春節追劇", "2024韓劇", "好看韓劇", "追劇清單"],
  // IU Peach Fuzz
  "cmp7yowt3009w9qetyeuk75qx": ["IU髮色", "Peach Fuzz桃色", "柔和桃髮色", "2024流行髮色", "韓星髮色"],
  // 春節養髮壞習慣
  "cmp7yowsq009e9qethorhel6g": ["頭皮出油原因", "養髮壞習慣", "頭皮護理", "春節保養", "油性頭皮改善"],
  // 赤峰街牡蠣拉麵
  "cmp7yowsm009a9qetinhsv8s5": ["赤峰街美食", "台北拉麵推薦", "牡蠣拉麵", "中山站餐廳", "台北美食探店"],
  // 京城怪物朴敘俊
  "cmp7yowsl00989qet1jy3kup6": ["朴敘俊髮型", "男生韓系髮型", "韓劇男主造型", "男生燙髮", "韓星男髮"],
  // 冬季顯瘦穿搭
  "cmp7yowsj00969qety0hvvxj7": ["顯瘦穿搭", "冬季穿搭技巧", "顯腿長穿搭", "穿搭公式", "小個子穿搭"],
  // 寵物友善板橋1997's
  "cmp7yowsi00949qet7y7npvwh": ["寵物友善髮廊", "板橋髮廊推薦", "江子翠美髮", "可帶狗髮廊", "板橋燙髮"],
  // 中山站SMILE拍貼
  "cmp7yowsg00929qett5wl4whx": ["韓式拍貼店", "台北拍貼推薦", "中山站景點", "Y2K拍照", "人生四格照"],
  // 頭皮類型診斷
  "cmp7yowsf00909qetkrfvckl6": ["頭皮類型", "頭皮診斷", "健康頭皮", "頭皮保養習慣", "養出好髮質"],
  // 換季保養肌膚
  "cmp7yowt2009u9qeti2ib7t1w": ["換季保養", "肌膚保濕", "秋冬護膚", "皮膚穩定", "護膚技巧"],
  // 睫毛保養
  "cmp7yows6008o9qetbqzcuryq": ["睫毛保養", "睫毛生長", "卸妝方法", "電眼妝容", "睫毛護理"],
  // 胎毛瀏海張員瑛IU
  "cmp7yows4008m9qetwgyli38f": ["胎毛瀏海", "自己剪瀏海", "仙氣瀏海", "空氣瀏海", "IU瀏海剪法"],
  // MOVING異能高允貞
  "cmp7yowsn009c9qet3o0rurwc": ["韓國整形範本", "高允貞", "韓劇女星", "韓國美女", "整形參考臉"],
  // MOVING異能韓孝周
  "cmp7yowsz009s9qetytimt9kb": ["韓孝周髮型", "空氣瀏海", "層次長髮", "韓劇女星髮型", "減齡髮型"],
  // 板橋府中角蛋白眉控
  "cmp7yowt5009y9qetobpbrpbs": ["角蛋白睫毛燙", "睫毛捲翹", "板橋美容推薦", "府中美甲", "睫毛定型"],
  // 士林A Hair Salon
  "cmp7yowt800a09qettol91d3e": ["士林髮廊推薦", "劍潭站美髮", "韓系燙髮台北", "台北髮廊推薦", "燙髮專門"],
  // 中秋烤肉頭髮除臭
  "cmp7yows7008q9qetgj9ena33": ["烤肉頭髮除臭", "中秋烤肉", "頭髮異味去除", "除臭方法", "中秋節保養"],
  // 大安區MNEME HAIR
  "cmp7yowrp00829qetq70toepp": ["忠孝新生髮廊", "大安區燙髮", "韓系燙髮推薦", "氛圍感髮型", "台北燙髮推薦"],
  // 2025中秋節禁忌
  "cmp7yowu000aq9qethysjixgq": ["中秋節禁忌", "中秋節習俗", "中秋注意", "中秋祭拜", "節日禁忌"],
  // 父親節地雷禮物
  "cmp7yowrk007y9qet17zw1s3z": ["父親節禮物", "送爸爸禮物", "父親節禁忌", "父親節購物", "地雷禮物"],
  // 今生也請多指教申惠善茶色髮
  "cmp7yowsd008y9qetuazls6xb": ["茶棕髮色", "顯白髮色", "夏天染髮推薦", "茶色髮型", "韓星同款髮色"],
  // 圓臉小顏瀏海
  "cmp7yowrw008a9qet3po2ydj5": ["圓臉瀏海", "小顏瀏海", "修飾臉型瀏海", "圓臉髮型", "顯瘦瀏海"],
  // 2023女生髮型趨勢公主切
  "cmp7yows9008s9qetdaoqk73s": ["公主切", "層次剪", "韓系女生髮型", "修飾臉型髮型", "2023流行髮型"],
  // 女生穿搭紮襯衫
  "cmp7yowrj007w9qetv5zipnwp": ["襯衫紮法", "顯瘦穿搭技巧", "好比例穿搭", "日系穿搭", "女生上衣搭法"],
  // 黑色穿搭02夏天
  "cmp7yowrr00849qet6znbnq0f": ["黑色穿搭", "全身黑搭配", "夏天清爽穿搭", "女生穿搭", "百搭黑色"],
  // 美妝回憶殺妙鼻貼
  "cmp7yows3008k9qetiz5lls5h": ["美妝回憶殺", "經典美妝品", "懷舊美妝", "台灣流行文化", "七八年級生"],
  // 壞媽媽李到晛男生燙髮
  "cmp7yowrx008c9qetla41gwj0": ["李到晛髮型", "男生燙髮推薦", "韓系男生髮型", "歐爸髮型", "韓劇男主髮型"],
  // 2023女生中長髮編髮結婚
  "cmp7yowrg007s9qetnfm4vxee": ["中長髮編髮", "結婚盤髮", "氣質盤髮", "女生編髮教學", "自己盤髮"],
  // 端午節禁忌
  "cmp7yowry008e9qetao7r9q99": ["端午節禁忌", "端午節習俗", "艾草習俗", "端午注意事項", "節日文化"],
  // 求職面試服裝
  "cmp7yowro00809qetvivl963e": ["面試穿搭", "女生面試服裝", "求職穿搭", "職場穿搭", "第一印象穿搭"],
  // 黑色吊帶裙穿搭01
  "cmp7yowrv00889qettgx7ei2h": ["黑色吊帶裙", "吊帶裙穿搭", "上班穿搭", "日常黑色穿搭", "女生穿搭"],
  // 畢業謝師宴編髮
  "cmp7yowre007q9qet8818o0n7": ["謝師宴髮型", "畢業季髮型", "宴會編髮", "女生宴會盤髮", "日系編髮"],
  // 夏天日系短髮編髮
  "cmp7yowrh007u9qet5jk34b3d": ["夏天編髮", "日系短髮造型", "短髮編髮教學", "清爽髮型", "日本女生髮型"],
  // 塔羅貴人測驗
  "cmp7yowsb008u9qety3us1ifp": ["塔羅占卜", "貴人運測驗", "塔羅牌", "命運測驗", "心理塔羅"],
  // 中山區JC美顏做臉
  "cmp7yowrt00869qetcaki3aj6": ["中山區做臉", "清粉刺推薦", "臉部保養中山", "身體SPA台北", "岩盤浴推薦"],
  // 母親節禮物
  "cmp7yowrb007o9qetv10mu45t": ["母親節禮物", "送媽媽禮物推薦", "母親節推薦", "實用禮物", "送禮建議"],
  // 塔羅職場豬隊友
  "cmp7yowr9007m9qet36as5ooy": ["塔羅占卜", "工作運勢", "職場運測驗", "塔羅牌測驗", "心理測驗"],
  // 黑暗榮耀宋慧喬穿搭
  "cmp7yowr6007i9qetf43b233t": ["宋慧喬穿搭", "黑色系穿搭", "韓星穿搭", "約會穿搭", "女人味穿搭"],
  // 中壢桃園帕朵燙
  "cmp7yowr5007g9qet6c074md7": ["中壢髮廊推薦", "桃園燙髮推薦", "韓系帕朵燙", "青埔美髮沙龍", "桃園髮廊"],
  // 塔羅情人節告白
  "cmp7yowr2007e9qetcpgrrqin": ["塔羅占卜", "情人節測驗", "愛情運勢", "告白成功率", "感情占卜"],
  // 宋慧喬凍齡女神
  "cmp7yowr0007c9qetpqj47ch0": ["宋慧喬", "凍齡保養", "韓星話題", "台韓明星", "女神保養秘訣"],
  // 中山區薇舍美甲美睫
  "cmp7yowqz007a9qetrv0sxc3o": ["中山區美甲", "美甲美睫推薦", "台北造型沙龍", "中山區美容", "美甲美髮一站"],
  // 情人節穿搭日系
  "cmp7yowqt00749qetwj5ty1ko": ["情人節穿搭", "日系女孩穿搭", "約會穿搭", "好比例穿搭", "甜美穿搭"],
  // 零元美顏瘦臉運動
  "cmp7yowsc008w9qet3c3mq9ma": ["瘦臉運動", "小顏方法", "天鵝頸訓練", "臉部緊實運動", "在家美容"],
  // 塔羅脫單
  "cmp7yowqq00729qet8o1tk9km": ["塔羅占卜", "脫單運勢", "感情運勢", "曖昧占卜", "愛情牌卡"],
  // 普發6000怎麼領
  "cmp7yowr7007k9qetl6os3wsn": ["普發6000", "政府補助", "領取方式", "政策懶人包", "生活資訊"],
  // 情人節編髮脫單
  "cmp7yowqw00789qets4mbttt5": ["情人節髮型", "甜美編髮", "脫單髮型", "約會髮型教學", "簡單編髮"],
  // 板橋1997燙髮
  "cmp7yowqp00709qetip2vbxh5": ["板橋髮廊推薦", "江子翠美髮", "燙髮推薦板橋", "板橋美髮沙龍", "訂製髮型"],
  // 美甲凝膠指甲
  "cmp7yows1008i9qetwrpxv6ju": ["凝膠指甲", "美甲知識", "指甲保養", "自己卸甲", "美甲QA"],
  // 冷色調暖色調髮色
  "cmp7yowqo006y9qet3q7snvmd": ["冷色調暖色調", "命定髮色", "髮色診斷", "適合自己的髮色", "染髮前必看"],
  // 丸子頭編髮過渡期
  "cmp7yowqi006u9qetzve2vws1": ["丸子頭編髮", "留長過渡期", "及肩髮造型", "簡單丸子頭", "過渡期髮型"],
  // 水豚走春景點
  "cmp7yowql006w9qetldue0keq": ["水豚咖啡廳", "走春景點推薦", "台灣親子景點", "水豚農場", "動物咖啡廳"],
  // 許光漢想見你男生髮型
  "cmp7yowqb006o9qetiwtknsii": ["許光漢髮型", "想見你", "男生髮型推薦", "逗號瀏海", "韓系男生燙髮"],
  // 冬季牛仔褲穿搭
  "cmp7yowqv00769qetbssos1fx": ["牛仔褲穿搭", "冬季基本款", "深色丹寧", "百搭穿搭", "週間穿搭"],
  // 冬季保濕精華液
  "cmp7yowqd006q9qetel1st1us": ["冬季保濕", "精華液吸收技巧", "乾燥肌保養", "肌膚保濕", "冬天護膚"],
  // 心理測驗命定職業
  "cmp7yows0008g9qetyslw3klm": ["心理測驗", "命定職業測驗", "轉職方向", "性格測驗", "職業興趣"],
  // 縮毛矯正自然捲
  "cmp7yowqh006s9qetjjydgbjg": ["縮毛矯正", "自然捲改善", "頭髮毛躁", "縮毛矯正知識", "直髮技術"],
};

function toSlug(name: string): string {
  return name.trim().toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w一-鿿㐀-䶿]/g, "");
}

async function getOrCreateTag(name: string): Promise<string> {
  const slug = toSlug(name);
  const existing = await prisma.tag.findFirst({ where: { OR: [{ slug }, { name }] } });
  if (existing) return existing.id;
  const created = await prisma.tag.create({ data: { name, slug } });
  return created.id;
}

async function main() {
  // Step 1: Clear all article-tag relations
  const deleted = await prisma.articleTag.deleteMany({});
  console.log(`✓ Cleared ${deleted.count} article-tag relations\n`);

  // Step 2: Assign new tags
  let done = 0;
  for (const [articleId, tagNames] of Object.entries(TAG_MAP)) {
    const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true, title: true } });
    if (!article) { console.log(`⚠ Not found: ${articleId}`); continue; }

    const tagIds: string[] = [];
    for (const name of tagNames) {
      const id = await getOrCreateTag(name);
      tagIds.push(id);
    }

    for (const tagId of tagIds) {
      await prisma.articleTag.upsert({
        where: { articleId_tagId: { articleId: article.id, tagId } },
        create: { articleId: article.id, tagId },
        update: {},
      });
    }

    done++;
    console.log(`[${done}/88] ${article.title.substring(0, 40)}`);
    console.log(`  → ${tagNames.join("、")}`);
  }

  // Step 3: Delete orphan tags (no articles)
  const orphans = await prisma.tag.findMany({
    where: { articles: { none: {} } },
    select: { id: true, name: true },
  });
  if (orphans.length > 0) {
    await prisma.tag.deleteMany({ where: { id: { in: orphans.map((t) => t.id) } } });
    console.log(`\n✓ Removed ${orphans.length} orphan tags`);
  }

  const finalCount = await prisma.tag.count();
  console.log(`\nDone! ${done} articles tagged. Total unique tags: ${finalCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
