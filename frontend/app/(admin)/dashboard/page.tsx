"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";

function StatCard({
  label, value, sub, accent, icon, onClick,
}: {
  label: string; value: React.ReactNode; sub: string;
  accent: string; icon: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col gap-3 transition-all"
      style={{ cursor: onClick ? "pointer" : "default" }}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"; }}
      onMouseLeave={(e) => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: accent + "20" }}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

interface OnboardingState { step2: boolean; step3: boolean; dismissed: boolean; }

const ONBOARDING_KEY = (id: string) => `onboarding_${id}`;

export default function DashboardPage() {
  const { tenant } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [docCount, setDocCount] = useState<number | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);

  useEffect(() => {
    if (!tenant) return;
    apiGet<DashboardStats>("/api/analytics/dashboard")
      .then(setStats).catch(console.error).finally(() => setLoading(false));
    apiGet<any[]>("/api/documents/")
      .then((docs) => setDocCount(docs.length)).catch(() => setDocCount(0));
    try {
      const raw = localStorage.getItem(ONBOARDING_KEY(tenant.id));
      setOnboarding(raw ? JSON.parse(raw) : { step2: false, step3: false, dismissed: false });
    } catch {
      setOnboarding({ step2: false, step3: false, dismissed: false });
    }
  }, [tenant]);

  const updateOnboarding = (patch: Partial<OnboardingState>) => {
    if (!tenant) return;
    const next = { ...(onboarding ?? { step2: false, step3: false, dismissed: false }), ...patch };
    setOnboarding(next);
    localStorage.setItem(ONBOARDING_KEY(tenant.id), JSON.stringify(next));
  };

  const limitExceeded = stats && stats.daily_llm_limit > 0 && stats.daily_llm_used >= stats.daily_llm_limit;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">管理概覽</h1>
        <p className="text-sm text-slate-500 mt-1">歡迎回來，{tenant?.name}</p>
      </div>

      {/* 統計數據 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="今日諮詢" value={stats?.today_queries ?? 0} sub="來自終端用戶的提問"
            accent="#3b82f6" icon="💬" onClick={() => router.push("/unanswered")} />
          <StatCard label="拒答次數" value={<span style={{ color: "#f59e0b" }}>{stats?.today_refused ?? 0}</span>}
            sub="知識庫無法回答的問題" accent="#f59e0b" icon="⚠️" onClick={() => router.push("/unanswered")} />
          <StatCard label="未解問題" value={<span style={{ color: "#ef4444" }}>{stats?.unanswered_new ?? 0}</span>}
            sub="待商家補充的問題" accent="#ef4444" icon="❓" onClick={() => router.push("/unanswered")} />
          <StatCard
            label="今日 LLM 用量"
            value={
              <span style={{ color: limitExceeded ? "#ef4444" : "#0f172a" }}>
                {stats?.daily_llm_used ?? 0}
                {stats && stats.daily_llm_limit > 0 && (
                  <span className="text-xl font-normal text-slate-400"> / {stats.daily_llm_limit}</span>
                )}
              </span>
            }
            sub={stats?.daily_llm_limit === 0 ? "不限制" : "今日 Gemini 呼叫次數"}
            accent={limitExceeded ? "#ef4444" : "#38bdf8"} icon="⚡"
            onClick={() => router.push("/settings")}
          />
        </div>
      )}

      {/* 新手引導：未完成全部步驟且未手動關閉時顯示 */}
      {docCount !== null && onboarding !== null && !onboarding.dismissed && (() => {
        const step1Done = docCount > 0;
        const step2Done = onboarding.step2;
        const step3Done = onboarding.step3;
        if (step1Done && step2Done && step3Done) return null;
        const steps = [
          {
            key: "1", done: step1Done,
            icon: "📂", title: "上傳知識庫",
            desc: "將你的 FAQ 文件（PDF、CSV、Excel、TXT）上傳，系統自動建立 AI 向量索引。",
            action: "前往知識庫", href: "/knowledge", accent: "#3b82f6",
            onAction: () => router.push("/knowledge"),
          },
          {
            key: "2", done: step2Done,
            icon: "🤖", title: "測試 AI 對話",
            desc: "到「對話測試」頁面，模擬用戶提問，確認 AI 回答符合你的期望。",
            action: "開啟對話測試", href: "/playground", accent: "#8b5cf6",
            onAction: () => { updateOnboarding({ step2: true }); router.push("/playground"); },
          },
          {
            key: "3", done: step3Done,
            icon: "🔗", title: "嵌入到你的網站",
            desc: "複製專屬連結或嵌入碼，放到你的網站，讓用戶直接使用。",
            action: "查看嵌入設定", href: "/settings", accent: "#10b981",
            onAction: () => { updateOnboarding({ step3: true }); router.push("/settings"); },
          },
        ];
        return (
          <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-lg">🚀</span>
                <h2 className="text-base font-bold text-slate-800">三步驟開始使用</h2>
              </div>
              <button
                onClick={() => updateOnboarding({ dismissed: true })}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100"
              >
                不再顯示
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {steps.map(({ key, done, icon, title, desc, action, accent, onAction }) => (
                <div key={key}
                  className="rounded-xl border p-5 flex flex-col gap-3 transition-all"
                  style={{ background: done ? "#f0fdf4" : "#f8fafc", borderColor: done ? "#bbf7d0" : "#f1f5f9" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: done ? "#16a34a" : accent }}>
                      {done ? "✓" : key}
                    </div>
                    <span className="text-lg">{icon}</span>
                    <span className="font-semibold text-slate-800 text-sm">{title}</span>
                    {done && <span className="ml-auto text-xs text-green-600 font-medium">完成</span>}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed flex-1">{desc}</p>
                  {!done && (
                    <button onClick={onAction}
                      className="text-xs font-semibold px-3 py-2 rounded-xl text-white transition-opacity hover:opacity-90"
                      style={{ background: accent }}>
                      {action} →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
