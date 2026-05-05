"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await signup(email, password, tenantName);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "操作失敗，請重試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] p-12 flex-shrink-0"
        style={{ background: "linear-gradient(160deg,#0c1a6e 0%,#1e40af 40%,#3b82f6 100%)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg font-bold">✦</div>
          <span className="text-white font-semibold text-lg">智慧客服系統</span>
        </div>
        <div>
          <p className="text-white/90 text-3xl font-bold leading-snug mb-4">
            AI 驅動的客服<br />知識庫平台
          </p>
          <p className="text-white/60 text-sm leading-relaxed">
            上傳 FAQ 文件，自動建立向量索引。<br />
            嚴格幻覺控制，只根據您的資料回答。<br />
            多租戶、多輪對話、智能拒答一應俱全。
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {["📄 支援 PDF、CSV、Excel、TXT", "🤖 Gemini 2.5 Flash 驅動", "🔒 多租戶資料完全隔離"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-white/70 text-sm">{f}</div>
            ))}
          </div>
        </div>
        <p className="text-white/30 text-xs">© 2025 智慧客服系統</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: "#f6f7fb" }}>
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold"
              style={{ background: "linear-gradient(135deg,#3b82f6,#38bdf8)" }}>✦</div>
            <span className="font-bold text-slate-800">智慧客服系統</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {mode === "login" ? "歡迎回來" : "建立帳號"}
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            {mode === "login" ? "登入您的商家後台" : "開始使用智慧客服系統"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">商家名稱</label>
                <input
                  type="text"
                  placeholder="e.g. 我的線上店鋪"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  required
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">電子郵件</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
                onFocus={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
                onFocus={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all mt-2 disabled:opacity-60"
              style={{ background: loading ? "#94a3b8" : "linear-gradient(135deg,#3b82f6,#38bdf8)" }}
            >
              {loading ? "處理中…" : mode === "login" ? "登入" : "建立帳號"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === "login" ? (
              <>還沒有帳號？{" "}
                <button onClick={() => { setMode("signup"); setError(""); }}
                  className="font-semibold text-blue-600 hover:underline">建立帳號</button></>
            ) : (
              <>已有帳號？{" "}
                <button onClick={() => { setMode("login"); setError(""); }}
                  className="font-semibold text-blue-600 hover:underline">登入</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
