"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
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
  const [answerDraft, setAnswerDraft] = useState<Record<string, string>>({});
  const [answerSaving, setAnswerSaving] = useState<string | null>(null);
  const [answerSaved, setAnswerSaved] = useState<string | null>(null);
  const [kbAdding, setKbAdding] = useState<string | null>(null);

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

  async function saveSuggestedAnswer(id: string) {
    const text = answerDraft[id] ?? "";
    setAnswerSaving(id);
    try {
      await apiPatch(`/api/handoffs/${id}`, { suggested_answer: text });
      setAnswerSaved(id);
      setTimeout(() => setAnswerSaved(null), 2500);
      setAllItems((prev) => prev.map((h) => h.id === id ? { ...h, suggested_answer: text } : h));
      setItems((prev) => prev.map((h) => h.id === id ? { ...h, suggested_answer: text } : h));
    } finally { setAnswerSaving(null); }
  }

  async function addToKb(id: string) {
    setKbAdding(id);
    try {
      // Auto-save the draft first so the backend has the latest text
      const draft = answerDraft[id];
      if (draft !== undefined) {
        await apiPatch(`/api/handoffs/${id}`, { suggested_answer: draft });
        setAllItems((prev) => prev.map((h) => h.id === id ? { ...h, suggested_answer: draft } : h));
        setItems((prev) => prev.map((h) => h.id === id ? { ...h, suggested_answer: draft } : h));
      }
      const updated = await apiPost<HandoffRequest>(`/api/handoffs/${id}/add-to-kb`, {});
      setAllItems((prev) => prev.map((h) => h.id === id ? updated : h));
      setItems((prev) => prev.map((h) => h.id === id ? updated : h));
    } catch (err: any) {
      alert(err.message || "加入失敗");
    } finally { setKbAdding(null); }
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
              ? { background: "#A6D8F5", color: "#1e293b" }
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
                      {h.contact_email && (
                        <div className="flex items-center gap-2 rounded-xl px-4 py-2.5" style={{ background: "#e8f4fc" }}>
                          <span className="text-base">✉️</span>
                          <div>
                            <p className="text-xs font-semibold text-slate-400">用戶 Email</p>
                            <a href={`mailto:${h.contact_email}`}
                              className="text-sm font-medium hover:underline" style={{ color: "#5ba8d4" }}>
                              {h.contact_email}
                            </a>
                          </div>
                        </div>
                      )}
                      <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-xs font-semibold text-slate-400 mb-2">對話摘要</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{h.summary}</p>
                      </div>

                      {/* Suggested answer / KB expansion */}
                      <div className="rounded-xl border border-slate-200 px-4 py-3 space-y-2" style={{ background: h.kb_added ? "#f0fdf4" : "white" }}>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-600">建議回答方式</p>
                          {h.kb_added && <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">已加入知識庫 ✓</span>}
                        </div>
                        <p className="text-xs text-slate-400">填寫標準回答後，可一鍵加入知識庫，AI 下次遇到類似問題時會參考此內容。</p>
                        <textarea
                          rows={4}
                          value={answerDraft[h.id] ?? (h.suggested_answer || "")}
                          onChange={(e) => setAnswerDraft((prev) => ({ ...prev, [h.id]: e.target.value }))}
                          disabled={!!h.kb_added}
                          placeholder="請輸入這個問題的標準回答…"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 resize-none outline-none disabled:bg-slate-50 disabled:text-slate-400"
                          onFocus={(e) => { e.currentTarget.style.borderColor = "#A6D8F5"; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
                        />
                        {!h.kb_added && (
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => saveSuggestedAnswer(h.id)}
                              disabled={answerSaving === h.id}
                              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                              {answerSaving === h.id ? "儲存中…" : answerSaved === h.id ? "已儲存 ✓" : "儲存回答"}
                            </button>
                            <button
                              onClick={() => addToKb(h.id)}
                              disabled={kbAdding === h.id || !(answerDraft[h.id] ?? h.suggested_answer)}
                              className="text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
                              style={{ background: "linear-gradient(135deg,#10b981,#34d399)" }}>
                              {kbAdding === h.id ? "加入中…" : "🧠 加入知識庫"}
                            </button>
                          </div>
                        )}
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
                            style={{ background: "#A6D8F5", color: "#1e293b" }}>
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
