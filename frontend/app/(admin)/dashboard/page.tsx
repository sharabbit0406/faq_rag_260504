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

export default function DashboardPage() {
  const { tenant } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    apiGet<DashboardStats>("/api/analytics/dashboard")
      .then(setStats).catch(console.error).finally(() => setLoading(false));
  }, [tenant]);

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
    </div>
  );
}
