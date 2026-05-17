export const dynamic = "force-static";

export function GET() {
  const manifest = {
    name: "MIFASO 迷髮所",
    short_name: "MIFASO",
    description: "時尚・美髮・生活美學",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#C4837A",
    theme_color: "#C4837A",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
