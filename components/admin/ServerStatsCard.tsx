"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

interface Stats {
  node: { rss: number; heapUsed: number; heapTotal: number; external: number; uptimeSec: number; version: string };
  container: { source: string; usage: number | null; limit: number | null };
  host: { totalMem: number; freeMem: number; cpus: number; loadavg: number[] };
  uploads: { bytes: number; files: number };
}

function fmt(b: number | null | undefined) {
  if (!b && b !== 0) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
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

  const containerPct =
    data?.container.usage && data?.container.limit
      ? Math.round((data.container.usage / data.container.limit) * 100)
      : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 text-sm">伺服器狀態(即時)</h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-gray-500 hover:text-rose-brand flex items-center gap-1 disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> 重新整理
        </button>
      </div>
      {err && <p className="text-sm text-red-500">{err}</p>}
      {!data && !err && <p className="text-sm text-gray-400">載入中…</p>}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Stat
            label="容器記憶體"
            value={
              data.container.usage != null
                ? `${fmt(data.container.usage)}${data.container.limit ? ` / ${fmt(data.container.limit)}` : ""}`
                : "—"
            }
            hint={containerPct != null ? `${containerPct}%` : data.container.source}
            bar={containerPct ?? undefined}
          />
          <Stat label="Node RSS" value={fmt(data.node.rss)} hint={`heap ${fmt(data.node.heapUsed)} / ${fmt(data.node.heapTotal)}`} />
          <Stat label="上傳目錄" value={fmt(data.uploads.bytes)} hint={`${data.uploads.files} 個檔案`} />
          <Stat label="運行時間" value={fmtUptime(data.node.uptimeSec)} hint={`Node ${data.node.version}・${data.host.cpus} CPU`} />
        </div>
      )}
      <p className="text-xs text-gray-400">
        即時快照(僅本實例);歷史趨勢 / CPU / 網路請看 Zeabur「資源用量」分頁。
      </p>
    </div>
  );
}

function Stat({ label, value, hint, bar }: { label: string; value: string; hint?: string; bar?: number }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-base font-semibold text-gray-900 mt-0.5">{value}</p>
      {bar != null && (
        <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
          <div
            className={`h-full ${bar > 85 ? "bg-red-500" : bar > 70 ? "bg-amber-500" : "bg-rose-brand"}`}
            style={{ width: `${Math.min(100, bar)}%` }}
          />
        </div>
      )}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
