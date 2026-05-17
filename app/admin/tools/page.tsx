"use client";

import { useCallback, useEffect, useState } from "react";

interface Preview {
  totalArticles: number;
  articlesAffected: number;
  paragraphsRemoved: number;
  executed: boolean;
  sample: { title: string; removed: string[] }[];
}

interface NormResult {
  totalArticles: number;
  articlesChanged: number;
  manualTocsRemoved: number;
  executed: boolean;
  sample: { title: string; tocRemoved: number; bytesBefore: number; bytesAfter: number }[];
  backup?: { count: number; at: string | null };
}

interface ScanItem {
  title: string;
  slug: string;
  href: string;
  text: string;
  type: string;
  reason: string;
}
interface ScanResult {
  scannedArticles: number;
  totalLinks: number;
  issues: number;
  truncated: boolean;
  counts: Record<string, number>;
  items: ScanItem[];
}

export default function ToolsPage() {
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");
  const [clearing, setClearing] = useState(false);
  const [cacheMsg, setCacheMsg] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState("");

  const doScan = useCallback(async () => {
    setScanning(true);
    setScanErr("");
    try {
      const res = await fetch("/api/scan-links");
      if (res.status === 401) { setScanErr("需要以管理員身分登入。"); return; }
      setScan((await res.json()) as ScanResult);
    } catch {
      setScanErr("掃描失敗,請稍後再試。");
    } finally {
      setScanning(false);
    }
  }, []);

  const [fixing, setFixing] = useState(false);
  const [fixMsg, setFixMsg] = useState("");
  const doFixAnchors = useCallback(async () => {
    setFixing(true);
    setFixMsg("");
    try {
      const res = await fetch("/api/scan-links?fix=1");
      if (res.status === 401) { setFixMsg("需要以管理員身分登入。"); return; }
      const j = await res.json();
      setFixMsg(j?.note ?? "已修復。");
      await doScan();
    } catch {
      setFixMsg("修復失敗,請稍後再試。");
    } finally {
      setFixing(false);
    }
  }, [doScan]);

  const [norm, setNorm] = useState<NormResult | null>(null);
  const [normLoading, setNormLoading] = useState(false);
  const [normErr, setNormErr] = useState("");
  const [normConfirm, setNormConfirm] = useState(false);
  const [normRunning, setNormRunning] = useState(false);
  const [normMsg, setNormMsg] = useState("");
  const [normRestoring, setNormRestoring] = useState(false);

  const restoreNorm = useCallback(async () => {
    setNormRestoring(true);
    setNormMsg("");
    try {
      const res = await fetch("/api/normalize-content?restore=1");
      if (res.status === 401) { setNormErr("需要以管理員身分登入。"); return; }
      const j = await res.json();
      setNormMsg(j?.note ?? "已復原。");
    } catch {
      setNormMsg("復原失敗,請稍後再試。");
    } finally {
      setNormRestoring(false);
    }
  }, []);

  const loadNorm = useCallback(async (run = false) => {
    setNormErr("");
    if (run) setNormRunning(true); else setNormLoading(true);
    try {
      const res = await fetch(`/api/normalize-content${run ? "?run=1" : ""}`);
      if (res.status === 401) { setNormErr("需要以管理員身分登入。"); return; }
      const j = (await res.json()) as NormResult & { note?: string };
      setNorm(j);
      if (run) setNormMsg(j?.note ?? "完成。");
    } catch {
      setNormErr("讀取失敗,請稍後再試。");
    } finally {
      setNormLoading(false);
      setNormRunning(false);
      setNormConfirm(false);
    }
  }, []);

  const clearCache = useCallback(async () => {
    setClearing(true);
    setCacheMsg("");
    try {
      const res = await fetch("/api/revalidate");
      if (res.status === 401) { setCacheMsg("需要以管理員身分登入。"); return; }
      await res.json();
      setCacheMsg("已清除前台快取,前台稍候或強制重整即更新。");
    } catch {
      setCacheMsg("清除失敗,請稍後再試。");
    } finally {
      setClearing(false);
    }
  }, []);

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
        <h1 className="text-2xl font-bold text-gray-900">工程工具</h1>
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

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">全文樣式整齊 + 目錄統一</h2>
          <p className="text-sm text-gray-500 mt-1">
            移除手動 / WP 舊版「本文目錄」(表格、清單、標題+清單),原本有目錄者統一改用
            自動目錄(<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">data-toc</code>);
            並清掉文字標籤雜亂 inline style 與空段落。不動圖片/IG/表格。不更動發布日期。
          </p>
        </div>

        {normLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-7 h-7 border-2 border-rose-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : normErr ? (
          <p className="text-sm text-red-500">{normErr}</p>
        ) : norm ? (
          <>
            <div className="flex flex-wrap gap-6 text-sm">
              <span>影響文章:<b className="text-gray-900">{norm.articlesChanged}</b> / {norm.totalArticles}</span>
              <span>移除手動目錄:<b className="text-gray-900">{norm.manualTocsRemoved}</b></span>
            </div>
            {norm.sample.length > 0 && (
              <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">預覽(前 5 篇)</p>
                {norm.sample.map((s, i) => (
                  <div key={i} className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      移除目錄 {s.tocRemoved} 個・內容 {s.bytesBefore} → {s.bytesAfter} 字元
                    </p>
                  </div>
                ))}
              </div>
            )}
            {normMsg && (
              <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                ✓ {normMsg}
              </p>
            )}
          </>
        ) : null}

        <div className="flex gap-2">
          <button
            onClick={() => loadNorm(false)}
            disabled={normRunning || normLoading}
            className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:border-rose-brand hover:text-rose-brand transition-colors disabled:opacity-40"
          >
            預覽
          </button>
          <button
            onClick={() => setNormConfirm(true)}
            disabled={normRunning || !norm || norm.articlesChanged === 0}
            className="px-4 py-2 text-sm bg-rose-brand text-white rounded-lg hover:bg-rose-dark transition-colors disabled:opacity-40"
          >
            {!norm || norm.articlesChanged === 0 ? "無可整理項目" : "確認整理"}
          </button>
          {(norm?.backup?.count ?? 0) > 0 && (
            <button
              onClick={restoreNorm}
              disabled={normRestoring || normRunning}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:border-gray-500 transition-colors disabled:opacity-40"
            >
              {normRestoring ? "復原中…" : `復原上次整理（${norm?.backup?.count}）`}
            </button>
          )}
        </div>
        {(norm?.backup?.count ?? 0) > 0 && (
          <p className="text-xs text-gray-400">
            有上次整理前的備份({norm?.backup?.count} 篇,可一鍵復原)。
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">清除前台快取</h2>
          <p className="text-sm text-gray-500 mt-1">
            文章頁有快取(ISR),改完內容若前台還是舊的,按這裡立即套用。
            (若仍是舊的,可能是 Cloudflare 快取,需在 Cloudflare 端 purge。)
          </p>
        </div>
        {cacheMsg && (
          <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            ✓ {cacheMsg}
          </p>
        )}
        <button
          onClick={clearCache}
          disabled={clearing}
          className="px-4 py-2 text-sm bg-rose-brand text-white rounded-lg hover:bg-rose-dark transition-colors disabled:opacity-40"
        >
          {clearing ? "清除中…" : "清除前台快取"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">掃描無效連結</h2>
          <p className="text-sm text-gray-500 mt-1">
            靜態掃描所有文章:空 / <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">javascript:</code> /
            協定相對 / <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">http://</code> 混合內容、
            頁內錨點對不到標題、站內 <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/article</code>、
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/category</code> 連結失效。
            (不檢查外部網站是否存活。)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={doScan}
            disabled={scanning || fixing}
            className="px-4 py-2 text-sm bg-rose-brand text-white rounded-lg hover:bg-rose-dark transition-colors disabled:opacity-40"
          >
            {scanning ? "掃描中…" : "開始掃描"}
          </button>
          {scan && (scan.counts.anchor ?? 0) > 0 && (
            <button
              onClick={doFixAnchors}
              disabled={fixing || scanning}
              className="px-4 py-2 text-sm border border-rose-brand text-rose-brand rounded-lg hover:bg-rose-light/40 transition-colors disabled:opacity-40"
            >
              {fixing ? "修復中…" : `修復錨點連結（${scan.counts.anchor}）`}
            </button>
          )}
        </div>

        {fixMsg && (
          <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            ✓ {fixMsg}
          </p>
        )}
        {scanErr && <p className="text-sm text-red-500">{scanErr}</p>}

        {scan && (
          <>
            <div className="flex flex-wrap gap-6 text-sm">
              <span>掃描文章:<b className="text-gray-900">{scan.scannedArticles}</b></span>
              <span>連結總數:<b className="text-gray-900">{scan.totalLinks}</b></span>
              <span>
                問題連結:
                <b className={scan.issues ? "text-red-600" : "text-emerald-600"}>{scan.issues}</b>
              </span>
            </div>

            {Object.keys(scan.counts).length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(scan.counts).map(([k, n]) => (
                  <span key={k} className="bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">
                    {k}:{n}
                  </span>
                ))}
              </div>
            )}

            {scan.issues === 0 ? (
              <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                ✓ 沒有發現無效連結。
              </p>
            ) : (
              <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
                {scan.items.map((it, i) => (
                  <div key={i} className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{it.title}</p>
                    <p className="text-xs text-red-500 mt-0.5">{it.reason}</p>
                    <p className="text-xs text-gray-400 mt-0.5 break-all">
                      連結:<code>{it.href || "(空)"}</code>
                      {it.text && <>　文字:「{it.text}」</>}
                    </p>
                    <a
                      href={`/article/${it.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-rose-brand hover:underline"
                    >
                      開啟文章前台 ↗
                    </a>
                  </div>
                ))}
                {scan.truncated && (
                  <p className="px-4 py-3 text-xs text-gray-400">已達顯示上限,請先修正後再掃描一次。</p>
                )}
              </div>
            )}
          </>
        )}
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

      {normConfirm && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setNormConfirm(false); }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-2">確認整理</h3>
            <p className="text-sm text-gray-500">
              將整理 <b className="text-gray-900">{norm?.articlesChanged}</b> 篇文章
              (移除 <b className="text-gray-900">{norm?.manualTocsRemoved}</b> 個手動目錄、
              統一改用自動目錄並清理樣式)。此動作無法復原,確定要繼續嗎?
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setNormConfirm(false)}
                disabled={normRunning}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-40"
              >
                取消
              </button>
              <button
                onClick={() => loadNorm(true)}
                disabled={normRunning}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                {normRunning ? "處理中…" : "確定整理"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
