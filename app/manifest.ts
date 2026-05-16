import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MIFASO 迷髮所",
    short_name: "MIFASO",
    description: "時尚・美髮・生活美學",
    start_url: "/",
    display: "standalone",
    background_color: "#C4837A",
    theme_color: "#C4837A",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
