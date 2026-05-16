"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Category } from "@prisma/client";

interface HeaderProps {
  categories: Category[];
}

export default function Header({ categories }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-white border-b border-gray-100 shadow-sm" : "bg-white/95 backdrop-blur-sm"
        }`}
      >
        {/* Main nav */}
        <div className="max-w-screen-xl mx-auto px-6 py-2.5 md:py-4">
          <div className="flex items-center justify-between gap-8">
            {/* Mobile menu button */}
            <button
              className="md:hidden p-1"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="選單"
            >
              <div className="w-5 space-y-1.5">
                <span className={`block h-px bg-black transition-transform ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
                <span className={`block h-px bg-black transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
                <span className={`block h-px bg-black transition-transform ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
              </div>
            </button>

            {/* Desktop nav left */}
            <nav className="hidden md:flex items-center gap-8 flex-1">
              {categories.slice(0, Math.ceil(categories.length / 2)).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="text-xs uppercase tracking-widest text-gray-700 hover:text-rose-brand transition-colors font-medium"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>

            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <Image src="/logo.png" alt="mifaso 迷髮所" width={140} height={56} className="h-8 md:h-12 w-auto object-contain brightness-0" priority />
            </Link>

            {/* Desktop nav right */}
            <nav className="hidden md:flex items-center gap-8 flex-1 justify-end">
              {categories.slice(Math.ceil(categories.length / 2)).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="text-xs uppercase tracking-widest text-gray-700 hover:text-rose-brand transition-colors font-medium"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>

            {/* Search */}
            <Link
              href="/search"
              aria-label="搜尋"
              className="flex-shrink-0 text-gray-600 hover:text-rose-brand transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-white pt-24 px-8 overflow-y-auto" onClick={() => setMenuOpen(false)}>
          <nav className="flex flex-col">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="font-serif text-lg text-black hover:text-rose-brand transition-colors border-b border-gray-100 py-3"
                onClick={() => setMenuOpen(false)}
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Spacer */}
      <div className="h-[60px] md:h-[88px]" />
    </>
  );
}
