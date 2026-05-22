import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ensurePageViewsTable } from "@/lib/page-views";
import Link from "next/link";
import { redirect } from "next/navigation";
import ServerStatsCard from "@/components/admin/ServerStatsCard";

export const dynamic = "force-dynamic";

function dayStart(offsetDays = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  return d;
}

export default async function AnalyticsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user) redirect("/admin/login");
  if (role !== "ADMIN" && role !== "EDITOR") {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center text-gray-500">
        僅管理員 / 編輯可檢視流量分析。
      </div>
    );
  }

  const today = dayStart(0);
  const d7 = dayStart(6);
  const d30 = dayStart(29);
  const days = Array.from({ length: 14 }, (_, i) => dayStart(13 - i));

  type Data = {
    total: number;
    todayCount: number;
    c7: number;
    c30: number;
    daily: number[];
    maxDaily: number;
    top: { path: string; _count: { path: number } }[];
    titleBySlug: Map<string, string>;
  };

  let data: Data | null = null;
  try {
    await ensurePageViewsTable();
    const [total, todayCount, c7, c30] = await Promise.all([
      prisma.pageView.count(),
      prisma.pageView.count({ where: { createdAt: { gte: today } } }),
      prisma.pageView.count({ where: { createdAt: { gte: d7 } } }),
      prisma.pageView.count({ where: { createdAt: { gte: d30 } } }),
    ]);

    const daily = await Promise.all(
      days.map((start) => {
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return prisma.pageView.count({
          where: { createdAt: { gte: start, lt: end } },
        });
      })
    );

    const top = await prisma.pageView.groupBy({
      by: ["path"],
      where: { createdAt: { gte: d30 } },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 12,
    });

    const slugs = top
      .map((t) => t.path.match(/^\/article\/(.+)$/)?.[1])
      .filter((s): s is string => !!s);
    const articles = slugs.length
      ? await prisma.article.findMany({
          where: { slug: { in: slugs } },
          select: { slug: true, title: true },
        })
      : [];

    data = {
      total,
      todayCount,
      c7,
      c30,
      daily,
      maxDaily: Math.max(1, ...daily),
      top,
      titleBySlug: new Map(articles.map((a) => [a.slug, a.title])),
    };
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto space-y-2 py-20 text-center">
        <h1 className="text-xl font-bold text-gray-900">進站流量分析</h1>
        <p className="text-sm text-gray-400">
          流量分析尚未就緒：資料表需於部署套用 migration 後建立,或目前還沒有任何瀏覽資料。
          部署完成後,訪客瀏覽前台即會開始累積數據。
        </p>
      </div>
    );
  }

  const { total, todayCount, c7, c30, daily, maxDaily, top, titleBySlug } = data;

  const stats = [
    { label: "今日瀏覽", value: todayCount },
    { label: "近 7 日", value: c7 },
    { label: "近 30 日", value: c30 },
    { label: "累計總量", value: total },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">進站流量分析</h1>
        <p className="text-sm text-gray-400 mt-1">
          站內瀏覽統計(不含後台);資料於訪客瀏覽時即時記錄。
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-5 border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">
              {s.value.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-5">近 14 日趨勢</h2>
        <div className="flex items-end gap-1.5 h-40">
          {daily.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100">
                {v}
              </div>
              <div
                className="w-full bg-rose-brand/80 rounded-t"
                style={{ height: `${(v / maxDaily) * 100}%`, minHeight: v ? 4 : 0 }}
              />
              <div className="text-[10px] text-gray-400">
                {days[i].getMonth() + 1}/{days[i].getDate()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900 text-sm">熱門頁面(近 30 日)</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {top.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">尚無資料</p>
          ) : (
            top.map((t) => {
              const slug = t.path.match(/^\/article\/(.+)$/)?.[1];
              const label = slug ? titleBySlug.get(slug) ?? t.path : t.path;
              return (
                <div
                  key={t.path}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <Link
                    href={t.path}
                    target="_blank"
                    className="text-sm text-gray-700 hover:text-rose-brand truncate"
                  >
                    {label}
                  </Link>
                  <span className="text-sm font-medium text-gray-900 flex-shrink-0">
                    {t._count.path.toLocaleString()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ServerStatsCard />
    </div>
  );
}
