import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://mifaso.co"),
  title: {
    default: "MIFASO 迷髮所 — 時尚・美髮・生活美學",
    template: "%s｜MIFASO 迷髮所",
  },
  description: "MIFASO 迷髮所，提供最前沿的美髮造型趨勢、彩妝保養與生活美學內容。",
  keywords: ["迷髮所", "MIFASO", "mifaso", "美髮", "時尚", "美妝", "保養", "生活美學"],
  openGraph: {
    type: "website",
    locale: "zh_TW",
    siteName: "MIFASO 迷髮所",
  },
  twitter: { card: "summary_large_image" },
  alternates: {
    types: { "application/rss+xml": "/feed.xml" },
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={notoSansTC.variable}>
      <body>{children}</body>
    </html>
  );
}
