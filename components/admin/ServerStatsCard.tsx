"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

interface Stats {
  node: { rss: number; heapUsed: number; heapTotal: number; external: number; uptimeSec: number; version: string };
  container: { source: string; usage: number | null; limit: number | null };
  host: { totalMem: number; freeMem: number; cpus: number; loadavg: number[] };
  uploads: { bytes: number; files: number };
}

function mb(b: number | null | undefined) {
  if (b == null) return "—";
  return `${(b / 1024 / 1024).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d} 天 ${h} 小時` : h ? `${h} 小時 ${m} 分` : `${m} 分`;
}

export default function ServerStatsCard() {
  const [data, setData] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!r.ok) { setErr("讀取失敗"); return; }
      setData(await r.json());
    } catch {
      setErr("讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 來源:容器 cgroup;若沒有,退而求其次用 host total(在容器內可能不準,但可呈現一個比值)
  const used = data?.container.usage ?? data?.node.rss ?? null;
  const limit = data?.container.limit ?? data?.host.totalMem ?? null;
  const pct = used != null && limit != null && limit > 0 ? (used / limit) * 100 : null;
  const source = data
    ? data.container.usage != null
      ? `容器(${data.container.source})`
      : "主機"
    : "—";

  const barColor =
    pct == null ? "bg-gray-300"
    : pct > 85 ? "bg-red-500"
    : pct > 70 ? "bg-amber-500"
    : "bg-rose-brand";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-gray-500">伺服器記憶體</h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-rose-brand flex items-center gap-1 disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {err && <p className="text-sm text-red-500">{err}</p>}
      {!data && !err && <p className="text-sm text-gray-400">載入中…</p>}

      {data && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-2xl font-semibold text-gray-900">
              {mb(used)} <span className="text-gray-300">/</span> <span className="text-gray-500 font-medium">{mb(limit)}</span>
            </p>
            <p className="text-sm text-gray-500">{pct != null ? `${pct.toFixed(1)}%` : "—"}</p>
          </div>

          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all`}
              style={{ width: `${Math.min(100, pct ?? 0)}%` }}
            />
          </div>

          <p className="text-xs text-gray-400">
            來源:{source} ・ 本服務 (RSS):{mb(data.node.rss)}
          </p>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400 pt-2 border-t border-gray-50">
            <span>運行時間 {fmtUptime(data.node.uptimeSec)}</span>
            <span>上傳目錄 {mb(data.uploads.bytes)}({data.uploads.files} 檔)</span>
            <span>Node {data.node.version} ・ {data.host.cpus} CPU</span>
          </div>
        </>
      )}
    </div>
  );
}
