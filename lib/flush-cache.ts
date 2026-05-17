import { revalidatePath } from "next/cache";

/**
 * 清前台快取:Next 自身的 ISR/route 快取一定清;若有設 Cloudflare 憑證,
 * 同時呼叫 Cloudflare Purge API(因為 revalidatePath 不會清 CDN 邊緣快取,
 * 這也是「改了內容前台/無痕還是舊的」的最常見原因)。
 *
 * Zeabur 環境變數(選用):
 *   CLOUDFLARE_API_TOKEN  — 具該 zone「Cache Purge」權限的 API Token
 *   CLOUDFLARE_ZONE_ID    — 網域的 Zone ID
 */
export async function purgeCloudflare(): Promise<boolean> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zone) return false;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purge_everything: true }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** 整理/維運工具改動內容後統一呼叫:清 Next 快取 + (可選)Cloudflare。 */
export async function flushFront(): Promise<{ cloudflare: boolean }> {
  revalidatePath("/", "layout");
  const cloudflare = await purgeCloudflare();
  return { cloudflare };
}
