"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { ChatMessage, DebugInfo } from "@/lib/types";

const TONE_OPTIONS = [
  { value: "formal",   label: "正式", desc: "專業穩重，使用「您」" },
  { value: "friendly", label: "親切", desc: "溫暖自然，像朋友聊天" },
  { value: "lively",   label: "活潑", desc: "輕鬆有趣，可用 emoji" },
  { value: "custom",   label: "其他", desc: "自行描述語氣風格" },
] as const;

type ToneValue = typeof TONE_OPTIONS[number]["value"];

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

const chatStorageKey = (tenantId: string) => `pg_chat_${tenantId}`;

export default function PlaygroundPage() {
  const { tenant, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailMode, setDetailMode] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [expandedDebug, setExpandedDebug] = useState<number | null>(null);
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatInitialized = useRef(false);

  const [aiTone, setAiTone] = useState<ToneValue>("friendly");
  const [aiStyleNote, setAiStyleNote] = useState("");
  const [savedAiTone, setSavedAiTone] = useState<ToneValue>("friendly");
  const [savedAiStyleNote, setSavedAiStyleNote] = useState("");
  const [aiStyleSaving, setAiStyleSaving] = useState(false);
  const [aiStyleSaved, setAiStyleSaved] = useState(false);

  const [aiStyleOpen, setAiStyleOpen] = useState(false);
  const aiStyleIsDirty = (aiTone !== savedAiTone || aiStyleNote !== savedAiStyleNote) && !aiStyleSaving;

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  // Mark onboarding step 2 done whenever user visits playground (regardless of entry path)
  useEffect(() => {
    if (!tenant) return;
    try {
      const key = `onboarding_${tenant.id}`;
      const raw = localStorage.getItem(key);
      const state = raw ? JSON.parse(raw) : { step2: false, step3: false, dismissed: false };
      if (!state.step2) {
        localStorage.setItem(key, JSON.stringify({ ...state, step2: true }));
      }
    } catch { /* ignore */ }
  }, [tenant]);

  // Restore conversation from sessionStorage when tenant is ready
  useEffect(() => {
    if (!tenant || chatInitialized.current) return;
    chatInitialized.current = true;
    try {
      const saved = sessionStorage.getItem(chatStorageKey(tenant.id));
      if (saved) {
        const { messages: savedMsgs, conversationId: savedConvId } = JSON.parse(saved);
        if (Array.isArray(savedMsgs) && savedMsgs.length > 0) {
          setMessages(savedMsgs);
          setConversationId(savedConvId ?? null);
        }
      }
    } catch { /* ignore */ }
  }, [tenant]);

  // Persist conversation to sessionStorage whenever messages change
  useEffect(() => {
    if (!tenant || !chatInitialized.current || messages.length === 0) return;
    try {
      sessionStorage.setItem(chatStorageKey(tenant.id), JSON.stringify({ messages, conversationId }));
    } catch { /* ignore */ }
  }, [messages, conversationId, tenant]);

  useEffect(() => {
    if (!tenant) return;
    apiGet<{ ai_tone?: string; ai_style_note?: string }>("/api/auth/settings").then((data) => {
      const t = (data.ai_tone ?? "friendly") as ToneValue;
      const n = data.ai_style_note ?? "";
      setAiTone(t); setSavedAiTone(t);
      setAiStyleNote(n); setSavedAiStyleNote(n);
    }).catch(() => {});
    apiGet<any[]>("/api/documents/").then((docs) => {
      const hasDocs = docs.length > 0;
      setHasDocuments(hasDocs);
      if (hasDocs) {
        apiGet<{ questions: string[] }>(`/api/chat/suggestions?tenant_id=${tenant.id}`)
          .then((data) => setHints(data.questions ?? []))
          .catch(() => setHints([]));
      }
    }).catch(() => setHasDocuments(false));
  }, [tenant]);

  async function saveAiStyle() {
    setAiStyleSaving(true);
    try {
      await apiPatch("/api/auth/settings", { ai_tone: aiTone, ai_style_note: aiStyleNote });
      setSavedAiTone(aiTone); setSavedAiStyleNote(aiStyleNote);
      setAiStyleSaved(true); setTimeout(() => setAiStyleSaved(false), 2500);
    } catch { /* ignore */ } finally { setAiStyleSaving(false); }
  }

  async function sendMessage(text?: string) {
    const question = (text ?? input).trim();
    if (!question || !tenant || !user || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    if (!hasDocuments) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "⚠ 知識庫目前尚無文件，AI 無法回答任何問題。\n\n請先到「知識庫」頁面上傳 FAQ 文件（PDF、CSV、Excel、TXT），上傳完成後即可在這裡測試。",
        was_refused: false,
      }]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost<{
        conversation_id: string; answer: string; was_refused: boolean;
        citations?: any[]; debug?: DebugInfo;
      }>(`/api/chat/?detail_mode=${detailMode}`, {
        tenant_id: tenant.id, conversation_id: conversationId, question, end_user_id: user.uid,
        is_playground: true,
      });
      setConversationId(res.conversation_id);
      setMessages((prev) => [...prev, {
        role: "assistant", content: res.answer, was_refused: res.was_refused,
        citations: res.citations ?? [], debug: res.debug,
      }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `錯誤：${err.message}`, was_refused: false }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">對話測試</h1>
          <p className="text-sm text-slate-500 mt-1">模擬終端用戶對話，此頁面的對話不計入統計與未解問題。</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <div
              onClick={() => setDetailMode(!detailMode)}
              className="w-9 h-5 rounded-full flex items-center px-0.5 transition-colors cursor-pointer"
              style={{ background: detailMode ? "linear-gradient(135deg,#3b82f6,#38bdf8)" : "#cbd5e1" }}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: detailMode ? "translateX(16px)" : "translateX(0)" }} />
            </div>
            Debug 模式
          </label>
          <button
            onClick={() => {
              setMessages([]);
              setConversationId(null);
              if (tenant) sessionStorage.removeItem(chatStorageKey(tenant.id));
            }}
            className="text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
            重置對話
          </button>
        </div>
      </div>

      {/* AI 回應風格（可折疊） */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setAiStyleOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">AI 回應風格</span>
            {!aiStyleOpen && (
              <span className="text-xs text-slate-400 font-normal">
                {TONE_OPTIONS.find((o) => o.value === aiTone)?.label ?? ""}
                {aiStyleIsDirty && <span className="ml-2 text-amber-500">● 未儲存</span>}
              </span>
            )}
          </div>
          <span className="text-slate-400 text-xs transition-transform" style={{ transform: aiStyleOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
        </button>

        {aiStyleOpen && (
          <div className="px-5 pb-4 space-y-3 border-t border-slate-100">
            <div className="flex items-center justify-end gap-2.5 pt-3">
              {aiStyleIsDirty && <span className="text-xs text-amber-500 font-medium">● 有未儲存的變更</span>}
              {aiStyleSaved && <span className="text-xs text-emerald-600 font-medium">已儲存 ✓</span>}
              <button onClick={saveAiStyle} disabled={aiStyleSaving || !aiStyleIsDirty}
                className="text-xs px-3 py-1.5 rounded-xl font-semibold text-white disabled:opacity-40 transition-all"
                style={{ background: "linear-gradient(135deg,#3b82f6,#38bdf8)" }}>
                {aiStyleSaving ? "儲存中…" : "儲存"}
              </button>
            </div>
            <div className="flex gap-2">
              {TONE_OPTIONS.map((opt) => (
                <label key={opt.value}
                  className="flex-1 flex flex-col gap-0.5 rounded-xl border-2 px-3 py-2.5 cursor-pointer transition-all"
                  style={{
                    borderColor: aiTone === opt.value ? "#38bdf8" : "#e2e8f0",
                    background: aiTone === opt.value ? "#eff6ff" : "#f8fafc",
                  }}>
                  <div className="flex items-center gap-1.5">
                    <input type="radio" name="pg_ai_tone" value={opt.value}
                      checked={aiTone === opt.value}
                      onChange={() => setAiTone(opt.value)}
                      className="accent-sky-500" />
                    <span className="text-xs font-semibold text-slate-700">{opt.label}</span>
                  </div>
                  <p className="text-xs text-slate-400 ml-4 leading-tight">{opt.desc}</p>
                </label>
              ))}
            </div>
            {aiTone === "custom" ? (
              <textarea rows={2} value={aiStyleNote} onChange={(e) => setAiStyleNote(e.target.value)}
                placeholder="描述你想要的語氣風格，例如：像台灣年輕店員，親切有活力，可以加入台式口語…"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none resize-none transition-all"
                onFocus={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; }} />
            ) : (
              <input type="text" value={aiStyleNote} onChange={(e) => setAiStyleNote(e.target.value)}
                placeholder="補充說明（選填）：例如「我們是寵物品牌，可以對用戶的寵物表示關心」"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all"
                onFocus={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; }} />
            )}
          </div>
        )}
      </div>

      {/* Chat box */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-5 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: "linear-gradient(135deg,#eff6ff,#dbeafe)" }}>🤖</div>
              <div>
                <p className="font-semibold text-slate-700">Playground 對話測試</p>
                <p className="text-sm text-slate-400 mt-1">此對話不計入統計與未解問題紀錄</p>
              </div>
              {hasDocuments === false ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                  style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#92400e" }}>
                  <span>📂</span>
                  <span>知識庫尚無文件，請先到<a href="/knowledge" className="font-semibold underline mx-1">知識庫</a>上傳資料後再測試。</span>
                </div>
              ) : hasDocuments === true && hints.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {hints.map((q) => (
                    <button key={q} onClick={() => sendMessage(q)}
                      className="text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              ) : null}

            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className="max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={
                  msg.role === "user"
                    ? { background: "linear-gradient(135deg,#3b82f6,#38bdf8)", color: "white", borderBottomRightRadius: "4px" }
                    : msg.was_refused
                    ? { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderBottomLeftRadius: "4px" }
                    : { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#1e293b", borderBottomLeftRadius: "4px" }
                }
              >
                {msg.was_refused && <p className="text-xs font-semibold mb-1 opacity-70">⚠ 拒答</p>}
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>

              {/* Citations */}
              {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 max-w-[75%] space-y-1.5">
                  {msg.citations.map((c, ci) => (
                    <div key={ci} className="text-xs rounded-xl px-3 py-2 text-blue-700 flex gap-2"
                      style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                      <span className="shrink-0">📎</span>
                      <span>{c.excerpt}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Debug */}
              {msg.role === "assistant" && msg.debug && (
                <div className="mt-2 max-w-[75%] w-full">
                  <button
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setExpandedDebug(expandedDebug === i ? null : i)}>
                    {expandedDebug === i ? "▲ 收起 Debug" : "▼ 展開 Debug"}
                  </button>
                  {expandedDebug === i && (
                    <div className="mt-2 rounded-xl p-4 text-xs space-y-2.5 overflow-auto"
                      style={{ background: "#0f172a", color: "#e2e8f0" }}>
                      <div>
                        <span style={{ color: "#fbbf24", fontWeight: 600 }}>改寫後的問題：</span>
                        <span className="ml-1">{msg.debug.rewritten_query || "（未改寫）"}</span>
                      </div>
                      <div>
                        <span style={{ color: "#fbbf24", fontWeight: 600 }}>Answerability：</span>
                        <span className="ml-1">
                          {msg.debug.answerability?.verdict ?? msg.debug.source ?? "—"}
                          {msg.debug.answerability ? ` — ${msg.debug.answerability.reason}` : ""}
                        </span>
                      </div>
                      {msg.debug.reranked_chunks && (
                        <div>
                          <span style={{ color: "#fbbf24", fontWeight: 600 }}>Top Chunks（{msg.debug.reranked_chunks.length}）：</span>
                          <div className="mt-1.5 space-y-1">
                            {msg.debug.reranked_chunks.map((chunk, ci) => (
                              <div key={ci} className="rounded-lg p-2.5" style={{ background: "#1e293b" }}>
                                <span style={{ color: "#4ade80" }}>[{chunk.rerank_score?.toFixed(1) ?? "—"}]</span>{" "}
                                {chunk.content.slice(0, 120)}…
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-start">
              <div className="rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center"
                style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                {[0, 0.18, 0.36].map((d, idx) => (
                  <span key={idx} className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"
                    style={{ animation: `bounce 1.2s ${d}s infinite`, animationTimingFunction: "ease-in-out" }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-100 px-4 py-3 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
            style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0" }}
            onFocusCapture={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.background = "white"; }}
            onBlurCapture={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}>
            <input
              ref={inputRef}
              placeholder="輸入問題…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none disabled:opacity-50"
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 flex-shrink-0"
            style={{ background: input.trim() && !loading ? "linear-gradient(135deg,#3b82f6,#38bdf8)" : "#cbd5e1" }}>
            <SendIcon />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%,100%{transform:translateY(0);opacity:.5}
          50%{transform:translateY(-4px);opacity:1}
        }
      `}</style>
    </div>
  );
}
