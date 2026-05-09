"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

function toZhError(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "帳號或密碼錯誤，請重新輸入。";
      case "auth/invalid-email":
        return "電子郵件格式不正確。";
      case "auth/email-already-in-use":
        return "此電子郵件已被其他帳號使用。";
      case "auth/weak-password":
        return "密碼強度不足，至少需要 6 個字元。";
      case "auth/too-many-requests":
        return "登入嘗試次數過多，帳號已暫時鎖定，請稍後再試或使用「忘記密碼」重置。";
      case "auth/network-request-failed":
        return "網路連線失敗，請確認網路後再試。";
      case "auth/user-disabled":
        return "此帳號已被停用，請聯絡客服。";
      case "auth/missing-email":
        return "請輸入電子郵件。";
      default:
        return `登入失敗（${err.code}），請稍後再試。`;
    }
  }
  if (err instanceof Error) return err.message;
  return "操作失敗，請稍後再試。";
}

type Mode = "login" | "signup" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setResetSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        router.push("/dashboard");
      } else if (mode === "signup") {
        await signup(email, password, tenantName);
        router.push("/dashboard");
      } else {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
      }
    } catch (err: unknown) {
      setError(toZhError(err));
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-[3px] focus:ring-blue-500/10 transition-all bg-white";

  const title = mode === "login" ? "歡迎回來" : mode === "signup" ? "建立帳號" : "重置密碼";
  const subtitle =
    mode === "login"
      ? "登入您的商家後台"
      : mode === "signup"
      ? "開始使用智慧客服系統"
      : "輸入您的帳號信箱，我們將發送重置連結";

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}
    >
      {/* ── 左側行銷面板（lg 以上才顯示） ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] p-12 flex-shrink-0"
        style={{ background: "linear-gradient(160deg,#0c1a6e 0%,#1e40af 40%,#3b82f6 100%)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg font-bold">
            ✦
          </div>
          <span className="text-white font-semibold text-lg">智慧客服系統</span>
        </div>
        <div>
          <p className="text-white/90 text-3xl font-bold leading-snug mb-4">
            AI 驅動的客服
            <br />
            知識庫平台
          </p>
          <p className="text-white/60 text-sm leading-relaxed">
            上傳 FAQ 文件，自動建立向量索引。
            <br />
            嚴格幻覺控制，只根據您的資料回答。
            <br />
            多租戶、多輪對話、智能拒答一應俱全。
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {["📄 支援 PDF、CSV、Excel、TXT", "🤖 Gemini 2.5 Flash 驅動", "🔒 多租戶資料完全隔離"].map(
              (f) => (
                <div key={f} className="flex items-center gap-2 text-white/70 text-sm">
                  {f}
                </div>
              )
            )}
          </div>
        </div>
        <p className="text-white/30 text-xs">© {new Date().getFullYear()} 智慧客服系統</p>
      </div>

      {/* ── 右側表單區 ── */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: "#f6f7fb" }}
      >
        <div className="w-full max-w-sm">
          {/* Mobile / Tablet 品牌標誌（lg 以下才顯示） */}
          <div className="lg:hidden flex flex-col items-center mb-8 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold mb-3"
              style={{ background: "linear-gradient(135deg,#3b82f6,#38bdf8)" }}
            >
              ✦
            </div>
            <span className="font-bold text-slate-800 text-lg">智慧客服系統</span>
            <span className="text-slate-500 text-xs mt-1">AI 驅動的客服知識庫平台</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-1">{title}</h1>
          <p className="text-slate-500 text-sm mb-8">{subtitle}</p>

          {/* 重置密碼成功畫面 */}
          {mode === "reset" && resetSent && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
                  fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-slate-800 font-semibold text-base mb-2">郵件已送出！</p>
              <p className="text-slate-500 text-sm leading-relaxed mb-1">
                請到 <span className="font-medium text-slate-700">{email}</span> 的信箱
              </p>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                點選郵件中的連結，即可設定新密碼。
              </p>
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-4 py-3 rounded-xl text-left mb-6">
                若幾分鐘內未收到，請確認：
                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                  <li>是否輸入正確的信箱</li>
                  <li>垃圾郵件或促銷郵件資料夾</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
                style={{ background: "linear-gradient(135deg,#3b82f6,#38bdf8)" }}
              >
                返回登入
              </button>
            </div>
          )}

          {/* 一般表單（reset 成功後隱藏） */}
          {!(mode === "reset" && resetSent) && (
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
                  className={inputCls}
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
                className={inputCls}
              />
            </div>

            {mode !== "reset" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">密碼</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className={inputCls + " pr-11"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {mode === "login" && (
                  <div className="mt-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => switchMode("reset")}
                      className="text-xs text-slate-500 hover:text-blue-600 hover:underline transition-colors"
                    >
                      忘記密碼？
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity mt-2 disabled:opacity-60"
              style={{
                background: loading ? "#94a3b8" : "linear-gradient(135deg,#3b82f6,#38bdf8)",
              }}
            >
              {loading
                ? "處理中…"
                : mode === "login"
                ? "登入"
                : mode === "signup"
                ? "建立帳號"
                : "發送重置郵件"}
            </button>
          </form>
          )}

          {!(mode === "reset" && resetSent) && (
          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === "login" ? (
              <>
                還沒有帳號？{" "}
                <button
                  onClick={() => switchMode("signup")}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  建立帳號
                </button>
              </>
            ) : (
              <button
                onClick={() => switchMode("login")}
                className="font-semibold text-blue-600 hover:underline"
              >
                返回登入
              </button>
            )}
          </p>
          )}
        </div>
      </div>
    </div>
  );
}
