import Header from "@/components/public/Header";
import Footer from "@/components/public/Footer";
import Tracker from "@/components/public/Tracker";
import prisma from "@/lib/prisma";
import { jsonLdGraph, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdGraph(organizationJsonLd(), websiteJsonLd()),
        }}
      />
      <Tracker />
      <Header categories={categories} />
      <main className="min-h-screen">{children}</main>
      <Footer categories={categories} />
    </>
  );
}
