export const dynamic = "force-static";

export function GET() {
  const manifest = {
    name: "MIFASO 後台",
    short_name: "MIFASO 後台",
    description: "MIFASO 迷髮所 內容管理後台",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/admin-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/admin-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/admin-apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
