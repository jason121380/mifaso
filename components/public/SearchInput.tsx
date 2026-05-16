"use client";

import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";

export default function SearchInput({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value.trim()) router.push(`/search?q=${encodeURIComponent(value.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜尋彩妝、保養、時尚..."
        className="w-full border-b-2 border-gray-200 focus:border-rose-brand outline-none py-3 pr-12 text-base placeholder:text-gray-300 transition-colors bg-transparent"
      />
      <button type="submit" className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-rose-brand transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
    </form>
  );
}
