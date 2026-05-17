"use client";

import { useCallback, useEffect, useState } from "react";

interface Preview {
  totalArticles: number;
  articlesAffected: number;
  paragraphsRemoved: number;
  executed: boolean;
  sample: { title: string; removed: string[] }[];
}

export default function ToolsPage() {
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");

  const load = useCallback(async (run = false) => {
    setErr("");
    if (run) setRunning(true); else setLoading(true);
    try {
      const res = await fetch(`/api/strip-related-reading${run ? "?run=1" : ""}`);
      if (res.status === 401) { setErr("需要以管理員身分登入後台。"); return; }
      const json = (await res.json()) as Preview;
      setData(json);
      if (run) setDoneMsg(`已從 ${json.articlesAffected} 篇移除 ${json.paragraphsRemoved} 個「延伸閱讀」段落。`);
    } catch {
      setErr("讀取失敗,請稍後再試。");
    } finally {
      setLoading(false);
      setRunning(false);
      setConfirming(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">維運工具</h1>
        <p className="text-sm text-gray-400 mt-1">內容批次處理,操作前請先看預覽。</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">移除文章「延伸閱讀」段落</h2>
          <p className="text-sm text-gray-500 mt-1">
            移除所有文章內文中的 <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">&lt;p&gt;…延伸閱讀…&lt;/p&gt;</code>
            整段(含其中連結)。不影響文章其他內容、不更動發布日期。
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-7 h-7 border-2 border-rose-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : err ? (
          <p className="text-sm text-red-500">{err}</p>
        ) : data ? (
          <>
            <div className="flex flex-wrap gap-6 text-sm">
              <span>影響文章:<b className="text-gray-900">{data.articlesAffected}</b> / {data.totalArticles}</span>
              <span>將移除段落:<b className="text-gray-900">{data.paragraphsRemoved}</b></span>
            </div>

            {data.sample.length > 0 && (
              <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">預覽(前 5 篇)</p>
                {data.sample.map((s, i) => (
                  <div key={i} className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                    {s.removed.map((r, j) => (
                      <p key={j} className="text-xs text-gray-500 mt-1 line-clamp-2">移除:{r}</p>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {doneMsg && (
              <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                ✓ {doneMsg}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => load(false)}
                disabled={running}
                className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:border-rose-brand hover:text-rose-brand transition-colors disabled:opacity-40"
              >
                重新預覽
              </button>
              <button
                onClick={() => setConfirming(true)}
                disabled={running || data.articlesAffected === 0}
                className="px-4 py-2 text-sm bg-rose-brand text-white rounded-lg hover:bg-rose-dark transition-colors disabled:opacity-40"
              >
                {data.articlesAffected === 0 ? "沒有可移除的段落" : "確認刪除"}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirming(false); }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-2">確認刪除</h3>
            <p className="text-sm text-gray-500">
              將從 <b className="text-gray-900">{data?.articlesAffected}</b> 篇文章移除{" "}
              <b className="text-gray-900">{data?.paragraphsRemoved}</b> 個「延伸閱讀」段落。
              此動作無法復原,確定要繼續嗎?
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirming(false)}
                disabled={running}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-40"
              >
                取消
              </button>
              <button
                onClick={() => load(true)}
                disabled={running}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                {running ? "處理中…" : "確定刪除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
