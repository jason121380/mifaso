import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readCgroup(): Promise<{
  source: "cgroupv2" | "cgroupv1" | "unknown";
  usage: number | null;
  limit: number | null;
}> {
  try {
    const [cur, max] = await Promise.all([
      readFile("/sys/fs/cgroup/memory.current", "utf8"),
      readFile("/sys/fs/cgroup/memory.max", "utf8"),
    ]);
    const m = max.trim();
    return {
      source: "cgroupv2",
      usage: Number(cur.trim()) || null,
      limit: m === "max" || !m ? null : Number(m),
    };
  } catch {
    /* try v1 */
  }
  try {
    const [cur, max] = await Promise.all([
      readFile("/sys/fs/cgroup/memory/memory.usage_in_bytes", "utf8"),
      readFile("/sys/fs/cgroup/memory/memory.limit_in_bytes", "utf8"),
    ]);
    const lim = Number(max.trim());
    return {
      source: "cgroupv1",
      usage: Number(cur.trim()) || null,
      // 沒設限制時 v1 會回極大值
      limit: lim > 1e15 ? null : lim,
    };
  } catch {
    return { source: "unknown", usage: null, limit: null };
  }
}

async function dirSize(dir: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  try {
    const ents = await readdir(dir, { withFileTypes: true });
    for (const e of ents) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        const s = await dirSize(p);
        bytes += s.bytes;
        files += s.files;
      } else if (e.isFile()) {
        try {
          const st = await stat(p);
          bytes += st.size;
          files++;
        } catch {
          /* ignore single file errors */
        }
      }
    }
  } catch {
    /* dir not exists -> 0 */
  }
  return { bytes, files };
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理員身分" }, { status: 401 });
  }

  const mem = process.memoryUsage();
  const cg = await readCgroup();
  const uploads = await dirSize(join(process.cwd(), "public", "uploads"));

  return NextResponse.json({
    node: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      uptimeSec: Math.round(process.uptime()),
      pid: process.pid,
      version: process.version,
    },
    container: cg, // { source, usage, limit }(容器/cgroup 視角的記憶體)
    host: {
      // 在容器內 os.totalmem 通常是 host 值,僅供參考
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      cpus: os.cpus().length,
      loadavg: os.loadavg(),
      platform: process.platform,
    },
    uploads, // { bytes, files }
  });
}
