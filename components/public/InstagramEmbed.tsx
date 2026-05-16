"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

export default function InstagramEmbed() {
  const pathname = usePathname();

  // 內容/路由變動後，重新觸發 Instagram 處理未轉換的 blockquote
  useEffect(() => {
    if (window.instgrm) {
      window.instgrm.Embeds.process();
      return;
    }
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (window.instgrm) {
        window.instgrm.Embeds.process();
        clearInterval(t);
      } else if (tries > 20) {
        clearInterval(t);
      }
    }, 500);
    return () => clearInterval(t);
  }, [pathname]);

  return (
    <Script
      src="https://www.instagram.com/embed.js"
      strategy="afterInteractive"
      onLoad={() => window.instgrm?.Embeds.process()}
    />
  );
}
