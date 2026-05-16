import Link from "next/link";
import Image from "next/image";
import { Category } from "@prisma/client";

interface FooterProps {
  categories: Category[];
}

export default function Footer({ categories }: FooterProps) {
  return (
    <footer className="bg-rose-brand text-white mt-24">
      <div className="max-w-screen-xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <Link href="/">
              <Image src="/logo.png" alt="mifaso 迷髮所" width={140} height={56} className="h-12 w-auto object-contain brightness-0 invert" />
            </Link>
            <div className="w-12 h-px bg-white/40 mt-4 mb-6" />
            <p className="text-white/70 text-sm leading-relaxed max-w-xs">
              mifaso 迷髮所，提供最前沿的美髮造型趨勢、彩妝保養與生活美學內容，陪你探索屬於自己的美麗風格。
            </p>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-widest text-white/50 mb-6">分類</h3>
            <nav className="flex flex-col gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="text-sm text-white/80 hover:text-white transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-widest text-white/50 mb-6">關於</h3>
            <nav className="flex flex-col gap-3">
              <Link href="/search" className="text-sm text-white/80 hover:text-white transition-colors">搜尋文章</Link>
              <Link href="/admin" className="text-sm text-white/80 hover:text-white transition-colors">編輯後台</Link>
            </nav>
          </div>
        </div>

        <div className="border-t border-white/20 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/50 uppercase tracking-widest">
            © {new Date().getFullYear()} MIFASO 迷髮所. All Rights Reserved.
          </p>
          <p className="text-xs text-white/50">時尚・美髮・生活美學</p>
        </div>
      </div>
    </footer>
  );
}
