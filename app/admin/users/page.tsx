"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { formatDate } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  bio: string | null;
  createdAt: string;
  _count: { articles: number };
}

const ROLE_LABELS: Record<string, string> = { ADMIN: "管理員", EDITOR: "編輯", AUTHOR: "作者" };
const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-50 text-red-700",
  EDITOR: "bg-blue-50 text-blue-700",
  AUTHOR: "bg-gray-100 text-gray-600",
};

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "AUTHOR", bio: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentUser = session?.user as any;

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => { setUsers(data); setLoading(false); });
  }, []);

  async function createUser() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(typeof data.error === "string" ? data.error : "新增失敗，請確認欄位內容"); setSaving(false); return; }
    setUsers((prev) => [data, ...prev]);
    setForm({ name: "", email: "", password: "", role: "AUTHOR", bio: "" });
    setShowForm(false);
    setSaving(false);
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, active: !active } : u));
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`確定要刪除用戶「${name}」？`)) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">用戶管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-rose-brand text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-rose-dark transition-colors shadow-sm"
        >
          <span className="text-base leading-none">＋</span> 新增用戶
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-100 p-6 mb-8 rounded-xl">
          <h3 className="font-medium text-gray-900 mb-4">新增用戶</h3>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: "name", label: "姓名", type: "text", placeholder: "姓名" },
              { key: "email", label: "帳號", type: "text", placeholder: "帳號名稱" },
              { key: "password", label: "密碼（最少 8 字元）", type: "password", placeholder: "••••••••" },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
                <input
                  type={type}
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-gray-200 focus:border-rose-brand focus:ring-2 focus:ring-rose-light outline-none px-3 py-2.5 text-sm rounded-lg transition-all"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">角色</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full border border-gray-200 focus:border-rose-brand focus:ring-2 focus:ring-rose-light outline-none px-3 py-2.5 text-sm rounded-lg transition-all bg-white"
              >
                <option value="AUTHOR">作者</option>
                <option value="EDITOR">編輯</option>
                <option value="ADMIN">管理員</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1.5">個人簡介（可選）</label>
              <input
                type="text"
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                className="w-full border border-gray-200 focus:border-rose-brand focus:ring-2 focus:ring-rose-light outline-none px-3 py-2.5 text-sm rounded-lg transition-all"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={createUser} disabled={saving} className="bg-rose-brand text-white px-6 py-2.5 text-sm font-medium rounded-lg hover:bg-rose-dark transition-colors disabled:opacity-50">
              {saving ? "新增中..." : "新增用戶"}
            </button>
            <button onClick={() => setShowForm(false)} className="border border-gray-200 text-gray-500 px-6 py-2.5 text-sm rounded-lg hover:border-gray-400 hover:text-gray-700 transition-colors">
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-rose-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-medium">用戶</th>
                <th className="text-left px-6 py-3 font-medium hidden md:table-cell">角色</th>
                <th className="text-left px-6 py-3 font-medium hidden lg:table-cell">文章數</th>
                <th className="text-left px-6 py-3 font-medium hidden lg:table-cell">狀態</th>
                <th className="text-left px-6 py-3 font-medium hidden xl:table-cell">加入時間</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-rose-brand rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        {user.name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-400">@{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className={`inline-flex px-2.5 py-0.5 text-xs rounded-full font-medium ${ROLE_COLORS[user.role]}`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 hidden lg:table-cell">{user._count.articles}</td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <span className={`inline-flex px-2.5 py-0.5 text-xs rounded-full ${user.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {user.active ? "啟用" : "停用"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs hidden xl:table-cell">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-4">
                    {user.id !== currentUser?.id && (
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => toggleActive(user.id, user.active)}
                          className="text-xs text-gray-400 hover:text-black transition-colors"
                        >
                          {user.active ? "停用" : "啟用"}
                        </button>
                        <button
                          onClick={() => deleteUser(user.id, user.name)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          刪除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
