"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";
import type { UnansweredQuestion } from "@/lib/types";

type StatusFilter = "all" | "new" | "answered" | "ignored";

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  new:      { label: "未處理", bg: "#fef2f2", color: "#dc2626" },
  answered: { label: "已回答", bg: "#f0fdf4", color: "#16a34a" },
  ignored:  { label: "已忽略", bg: "#f8fafc", color: "#64748b" },
};

export default function UnansweredPage() {
  const { tenant } = useAuth();
  const [allQuestions, setAllQuestions] = useState<UnansweredQuestion[]>([]);
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("new");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editAnswer, setEditAnswer] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const counts = {
    all: allQuestions.length,
    new: allQuestions.filter((q) => q.status === "new").length,
    answered: allQuestions.filter((q) => q.status === "answered").length,
    ignored: allQuestions.filter((q) => q.status === "ignored").length,
  };

  const fetchQuestions = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await apiGet<UnansweredQuestion[]>("/api/unanswered/");
      setAllQuestions(data);
      setQuestions(filter === "all" ? data : data.filter((q) => q.status === filter));
    } finally { setLoading(false); }
  }, [tenant, filter]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  async function updateQuestion(id: string, updates: { status?: string; manual_answer?: string }) {
    setSaving(id);
    try {
      await apiPatch(`/api/unanswered/${id}`, updates);
      const update = (prev: UnansweredQuestion[]) =>
        prev.map((q) => q.id === id ? { ...q, ...updates } as UnansweredQuestion : q);
      setAllQuestions(update);
      setQuestions((prev) => {
        const updated = update(prev);
        if (updates.status && filter !== "all" && updates.status !== filter) return updated.filter((q) => q.id !== id);
        return updated;
      });
    } finally { setSaving(null); }
  }

  async function deleteQuestion(id: string) {
    if (!window.confirm("確定要刪除這筆問題嗎？")) return;
    setDeleting(id);
    try {
      await apiDelete(`/api/unanswered/${id}`);
      setAllQuestions((p) => p.filter((q) => q.id !== id));
      setQuestions((p) => p.filter((q) => q.id !== id));
      if (expanded === id) setExpanded(null);
    } finally { setDeleting(null); }
  }

  function formatDate(iso: string) {
    const utc = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
    return new Date(utc).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "全部" }, { key: "new", label: "未處理" },
    { key: "answered", label: "已回答" }, { key: "ignored", label: "已忽略" },
  ];

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">未解問題</h1>
        <p className="text-sm text-slate-500 mt-1">AI 無法回答的問題會記錄在此，補充答案可讓系統下次直接回覆。</p>
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
          <h2 className="text-sm font-semibold text-slate-700">問題列表（{questions.length}）</h2>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">載入中…</div>
        ) : questions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="text-sm text-slate-400">沒有符合條件的問題</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {questions.map((q) => {
              const s = STATUS_LABELS[q.status] ?? STATUS_LABELS.ignored;
              const isExpanded = expanded === q.id;
              return (
                <div key={q.id} className="transition-colors hover:bg-slate-50">
                  <div className="flex items-start gap-4 px-6 py-4 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : q.id)}>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="font-medium text-slate-800 text-sm">{q.question}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        詢問 {q.occurrence_count} 次 · 最後 {formatDate(q.last_asked_at)}
                      </p>
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
                      <div className="bg-slate-50 rounded-xl p-1">
                        <textarea
                          className="w-full bg-transparent px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none"
                          rows={3}
                          placeholder="輸入手動補充答案（可選）"
                          value={editAnswer[q.id] ?? q.manual_answer ?? ""}
                          onChange={(e) => setEditAnswer((p) => ({ ...p, [q.id]: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => updateQuestion(q.id, { status: "answered", manual_answer: editAnswer[q.id] ?? q.manual_answer ?? undefined })}
                          disabled={saving === q.id}
                          className="text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
                          style={{ background: "linear-gradient(135deg,#3b82f6,#38bdf8)" }}>
                          {saving === q.id ? "儲存中…" : "✓ 標記已解"}
                        </button>
                        <button
                          onClick={() => updateQuestion(q.id, { status: "ignored" })}
                          disabled={saving === q.id}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
                          忽略
                        </button>
                        {editAnswer[q.id] !== undefined && (
                          <button
                            onClick={() => updateQuestion(q.id, { manual_answer: editAnswer[q.id] })}
                            disabled={saving === q.id}
                            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
                            僅儲存答案
                          </button>
                        )}
                        <button
                          onClick={() => deleteQuestion(q.id)}
                          disabled={saving === q.id || deleting === q.id}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 ml-auto">
                          {deleting === q.id ? "刪除中…" : "刪除"}
                        </button>
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
