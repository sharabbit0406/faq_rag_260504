"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch } from "@/lib/api";
import type { HandoffRequest } from "@/lib/types";

type StatusFilter = "all" | "new" | "read" | "resolved";

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  new:      { label: "未處理", bg: "#fef2f2", color: "#dc2626" },
  read:     { label: "已查看", bg: "#fffbeb", color: "#d97706" },
  resolved: { label: "已解決", bg: "#f0fdf4", color: "#16a34a" },
};

export default function HandoffsPage() {
  const { tenant } = useAuth();
  const [allItems, setAllItems] = useState<HandoffRequest[]>([]);
  const [items, setItems] = useState<HandoffRequest[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("new");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const counts = {
    all: allItems.length,
    new: allItems.filter((h) => h.status === "new").length,
    read: allItems.filter((h) => h.status === "read").length,
    resolved: allItems.filter((h) => h.status === "resolved").length,
  };

  const fetchHandoffs = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await apiGet<HandoffRequest[]>("/api/handoffs/");
      setAllItems(data);
      setItems(filter === "all" ? data : data.filter((h) => h.status === filter));
    } finally { setLoading(false); }
  }, [tenant, filter]);

  useEffect(() => { fetchHandoffs(); }, [fetchHandoffs]);

  async function updateStatus(id: string, status: string) {
    setSaving(id);
    try {
      await apiPatch(`/api/handoffs/${id}`, { status });
      const update = (prev: HandoffRequest[]) =>
        prev.map((h) => h.id === id ? { ...h, status } as HandoffRequest : h);
      setAllItems(update);
      setItems((prev) => {
        const updated = update(prev);
        if (filter !== "all" && status !== filter) return updated.filter((h) => h.id !== id);
        return updated;
      });
    } finally { setSaving(null); }
  }

  function formatDate(iso: string) {
    const utc = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
    return new Date(utc).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "全部" }, { key: "new", label: "未處理" },
    { key: "read", label: "已查看" }, { key: "resolved", label: "已解決" },
  ];

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">轉接紀錄</h1>
        <p className="text-sm text-slate-500 mt-1">用戶請求轉接真人客服時，AI 生成的對話摘要會記錄在此。</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={filter === key
              ? { background: "linear-gradient(135deg,#3b82f6,#38bdf8)", color: "white" }
              : { background: "white", color: "#64748b", border: "1px solid #e2e8f0" }}>
            {label}（{counts[key]}）
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">轉接列表（{items.length}）</h2>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">載入中…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="text-sm text-slate-400">沒有符合條件的轉接紀錄</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((h) => {
              const s = STATUS_LABELS[h.status] ?? STATUS_LABELS.read;
              const isExpanded = expanded === h.id;
              return (
                <div key={h.id} className="transition-colors hover:bg-slate-50">
                  <div className="flex items-start gap-4 px-6 py-4 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : h.id)}>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="font-medium text-slate-800 text-sm line-clamp-2">
                        {h.summary.split("\n")[0] || "（無摘要）"}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{formatDate(h.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                      <span className="text-slate-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-5 pt-0 space-y-3">
                      <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-xs font-semibold text-slate-400 mb-2">對話摘要</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{h.summary}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {h.status === "new" && (
                          <button
                            onClick={() => updateStatus(h.id, "read")}
                            disabled={saving === h.id}
                            className="text-xs px-3 py-1.5 rounded-lg border font-medium disabled:opacity-50 transition-colors hover:bg-amber-50"
                            style={{ borderColor: "#fcd34d", color: "#d97706" }}>
                            {saving === h.id ? "儲存中…" : "👁 已查看"}
                          </button>
                        )}
                        {h.status !== "resolved" && (
                          <button
                            onClick={() => updateStatus(h.id, "resolved")}
                            disabled={saving === h.id}
                            className="text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
                            style={{ background: "linear-gradient(135deg,#3b82f6,#38bdf8)" }}>
                            {saving === h.id ? "儲存中…" : "✓ 標記已解決"}
                          </button>
                        )}
                        {h.status !== "new" && (
                          <button
                            onClick={() => updateStatus(h.id, "new")}
                            disabled={saving === h.id}
                            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
                            重設為未處理
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
