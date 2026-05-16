"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", { account: email, password, redirect: false });

    if (result?.ok) {
      const cb = searchParams.get("callbackUrl") ?? "";
      const safe = /^\/(?!\/)[^\s]*$/.test(cb) ? cb : "/admin/dashboard";
      // 全頁導向(非 router.push):強制 server 端重新渲染 admin layout,
      // 否則登入後第一次進來側邊選單不會出現,要重新整理才有。
      window.location.href = safe;
      return;
    } else {
      setError("帳號或密碼錯誤，請重新輸入");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-100 border border-gray-100 p-8">

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image src="/logo.png" alt="mifaso 迷髮所" width={160} height={64} className="h-14 w-auto object-contain brightness-0" priority />
            </div>
            <h1 className="text-xl font-bold text-gray-900">內容管理後台</h1>
            <p className="text-sm text-gray-400 mt-1">登入以管理 mifaso 迷髮所的內容</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">帳號</label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-rose-brand focus:ring-2 focus:ring-rose-light transition-all placeholder:text-gray-300"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">密碼</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-rose-brand focus:ring-2 focus:ring-rose-light transition-all placeholder:text-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
                <Lock size={13} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-rose-brand text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-rose-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  登入中...
                </span>
              ) : "登入後台"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">
          MIFASO 迷髮所 © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
