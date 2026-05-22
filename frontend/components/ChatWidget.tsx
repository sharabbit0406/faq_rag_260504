"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
  was_refused?: boolean;
  citations?: Citation[];
}

interface Citation {
  chunk_id: string;
  document_id: string;
  excerpt: string;
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 2, marginLeft: 4, verticalAlign: "middle" }}>
      {[0, 0.2, 0.4].map((d, i) => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: "50%", background: "#94a3b8", display: "inline-block",
          animation: `bounce 1.2s ${d}s ease-in-out infinite`,
        }} />
      ))}
    </span>
  );
}

function BotAvatar({ url }: { url?: string | null }) {
  if (url) {
    return (
      <img src={url} alt="客服頭像"
        className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5 object-cover"
        style={{ border: "1.5px solid #e2e8f0" }} />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-sm"
      style={{ background: "#A6D8F5" }}>🤖</div>
  );
}

export default function ChatWidget({ tenantId }: { tenantId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [endUserId, setEndUserId] = useState<string>("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("智慧客服");
  const [greetingMessage, setGreetingMessage] = useState<string>("您好！我是智慧客服助理，可以回答關於本服務的相關問題。");
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState<string>("AI 回覆中，請稍候…");
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [clickedSuggestions, setClickedSuggestions] = useState<Set<string>>(new Set());
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
  const [tenantNotFound, setTenantNotFound] = useState<boolean>(false);

  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [handoffSummary, setHandoffSummary] = useState("");
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffSubmitting, setHandoffSubmitting] = useState(false);
  const [handoffDone, setHandoffDone] = useState(false);
  const [handoffCopied, setHandoffCopied] = useState(false);
  const [showEmailStep, setShowEmailStep] = useState(false);
  const [handoffEmail, setHandoffEmail] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = `end_user_id_${tenantId}`;
    let id = localStorage.getItem(key);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
    setEndUserId(id);
  }, [tenantId]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/chat/widget-config/${tenantId}`)
      .then((r) => {
        if (r.status === 404) { setTenantNotFound(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (!data) return;
        if (data?.tenant_name) setTenantName(data.tenant_name);
        if (data?.greeting_message) setGreetingMessage(data.greeting_message);
        if (data?.contact_email) setContactEmail(data.contact_email);
        if (data?.contact_phone) setContactPhone(data.contact_phone);
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        if (data?.loading_text) setLoadingText(data.loading_text);
      }).catch(() => {});

    fetch(`${BASE_URL}/api/chat/suggestions?tenant_id=${tenantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.questions?.length) setSuggestions(data.questions.slice(0, 6)); })
      .catch(() => {});
  }, [tenantId]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 150) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, followUpSuggestions]);

  const sendMessage = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading || !endUserId) return;
    setInput("");
    setFollowUpSuggestions([]);
    if (text) setClickedSuggestions((prev) => new Set([...prev, text]));
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    inputRef.current?.focus();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch(`${BASE_URL}/api/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, conversation_id: conversationId, question, end_user_id: endUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "請求失敗");
      if (data.conversation_id && data.conversation_id !== "greeting") setConversationId(data.conversation_id);
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, was_refused: data.was_refused, citations: data.citations }]);

      if (!data.was_refused) {
        fetch(`${BASE_URL}/api/chat/follow-up-suggestions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, answer: data.answer }),
        })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => { if (d?.questions?.length) setFollowUpSuggestions(d.questions.slice(0, 3)); })
          .catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "請求失敗";
      setMessages((prev) => [...prev, { role: "assistant", content: `錯誤：${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const openHandoffModal = async () => {
    setShowContactMenu(false);
    setHandoffDone(false);
    setHandoffCopied(false);
    setHandoffSummary("");
    setShowEmailStep(false);
    setHandoffEmail("");
    setShowHandoffModal(true);

    if (messages.length === 0) return;

    setHandoffLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/handoffs/generate-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setHandoffSummary(data.summary ?? "");
    } catch {
      setHandoffSummary("（摘要生成失敗，請手動描述您的問題）");
    } finally {
      setHandoffLoading(false);
    }
  };

  const requestEmail = () => {
    if (!handoffSummary.trim()) return;
    setShowEmailStep(true);
  };

  const submitHandoff = async () => {
    setHandoffSubmitting(true);
    try {
      await fetch(`${BASE_URL}/api/handoffs/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          conversation_id: conversationId,
          end_user_id: endUserId,
          summary: handoffSummary,
          contact_email: handoffEmail.trim() || null,
        }),
      });
      setHandoffDone(true);
    } catch {
      // fail silently — user can still copy
    } finally {
      setHandoffSubmitting(false);
    }
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(handoffSummary);
      setHandoffCopied(true);
      setTimeout(() => setHandoffCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const showInitialSuggestions = suggestions.length > 0 && messages.length === 0;
  const availableInitialSuggestions = suggestions.filter((s) => !clickedSuggestions.has(s));

  if (tenantNotFound) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4"
        style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background: "#f6f7fb" }}>
        <div className="text-5xl">🔍</div>
        <h1 className="text-lg font-semibold text-slate-700">找不到此客服頁面</h1>
        <p className="text-sm text-slate-400">此連結無效或服務尚未開啟，請確認網址是否正確。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background: "#f6f7fb" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3.5 flex items-center gap-3 border-b"
        style={{ background: "white", borderColor: "#e2e8f0" }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="客服頭像" className="w-9 h-9 rounded-full flex-shrink-0 object-cover" style={{ border: "1.5px solid #e2e8f0" }} />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: "#A6D8F5" }}>🤖</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">{tenantName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="text-xs text-slate-400">由AI服務</span>
          </div>
        </div>
        {(contactEmail || contactPhone) && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={openHandoffModal}
              className="flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-1.5 transition-all"
              style={{ background: "#e8f4fc", color: "#5ba8d4", border: "1px solid #A6D8F5" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#c8e8f8"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#e8f4fc"; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              真人客服
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

        {/* Greeting */}
        <div className="flex gap-2.5">
          <BotAvatar url={avatarUrl} />
          <div className="max-w-[80%]">
            <div className="rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-800 shadow-sm"
              style={{ background: "white", border: "1px solid #e2e8f0" }}>
              <p className="whitespace-pre-wrap">{greetingMessage}</p>
            </div>
            {showInitialSuggestions && availableInitialSuggestions.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {availableInitialSuggestions.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)} disabled={loading}
                    className="text-left text-xs px-3.5 py-2 rounded-xl transition-all disabled:opacity-50"
                    style={{ background: "white", border: "1px solid #e2e8f0", color: "#5ba8d4", fontWeight: 500 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#e8f4fc"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#A6D8F5"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "white"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0"; }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {msg.role === "assistant" && <BotAvatar url={avatarUrl} />}
            <div className={`max-w-[80%] flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className="rounded-2xl px-4 py-3 text-sm shadow-sm"
                style={
                  msg.role === "user"
                    ? { background: "#A6D8F5", color: "#1e293b", borderBottomRightRadius: "4px" }
                    : msg.was_refused
                    ? { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderBottomLeftRadius: "4px" }
                    : { background: "white", border: "1px solid #e2e8f0", color: "#1e293b", borderBottomLeftRadius: "4px" }
                }>
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none leading-relaxed
                    prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                    prose-strong:font-semibold prose-headings:font-semibold
                    prose-headings:text-inherit prose-p:text-inherit prose-li:text-inherit">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>

              {msg.citations && msg.citations.length > 0 && (
                <div className="space-y-1 w-full">
                  {msg.citations.map((c, ci) => {
                    const key = `${i}-${ci}`;
                    const open = expandedCitation === key;
                    return (
                      <div key={ci}>
                        <button onClick={() => setExpandedCitation(open ? null : key)}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                          <span>📎</span> 來源 {ci + 1} {open ? "▲" : "▼"}
                        </button>
                        {open && (
                          <div className="mt-1 text-xs rounded-xl px-3 py-2 leading-relaxed"
                            style={{ background: "#e8f4fc", border: "1px solid #A6D8F5", color: "#5ba8d4" }}>
                            {c.excerpt}…
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {msg.role === "assistant" && i === messages.length - 1 && !loading && followUpSuggestions.length > 0 && (
                <div className="mt-1 flex flex-col gap-2 w-full">
                  <p className="text-xs text-slate-400 px-0.5">您可能還想問：</p>
                  {followUpSuggestions.map((q) => (
                    <button key={q} onClick={() => sendMessage(q)} disabled={loading}
                      className="text-left text-xs px-3.5 py-2 rounded-xl transition-all disabled:opacity-50"
                      style={{ background: "white", border: "1px solid #e2e8f0", color: "#5ba8d4", fontWeight: 500 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#e8f4fc"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#A6D8F5"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "white"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0"; }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5" style={{ animation: "fadeIn 0.4s ease" }}>
            <BotAvatar url={avatarUrl} />
            <div className="rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm max-w-[80%]" style={{ background: "white", border: "1px solid #e2e8f0" }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 16, animation: "pulse 1.2s ease-in-out infinite" }}>🧠</span>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {loadingText}
                  <LoadingDots />
                </p>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t" style={{ background: "white", borderColor: "#e2e8f0" }}>
        <div className="flex items-center gap-2 rounded-2xl px-3 py-1.5 transition-all"
          style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0" }}
          onFocusCapture={(e) => { e.currentTarget.style.borderColor = "#A6D8F5"; e.currentTarget.style.background = "white"; }}
          onBlurCapture={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="輸入您的問題…"
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none py-1.5"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 flex-shrink-0"
            style={{ background: input.trim() && !loading ? "#A6D8F5" : "#cbd5e1", color: "#1e293b" }}>
            <SendIcon />
          </button>
        </div>
      </div>

      {/* Handoff Modal */}
      {showHandoffModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: "0 16px" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowHandoffModal(false); }}>
          <div style={{
            background: "white", borderRadius: 20, width: "100%", maxWidth: 520,
            padding: "24px 20px 24px", boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
            maxHeight: "85vh", display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>轉接真人客服</h3>
              <p style={{ fontSize: 12, color: "#94a3b8" }}>
                {showEmailStep
                  ? "請留下您的 Email，商家回覆時會主動聯絡您。"
                  : messages.length === 0
                  ? "請描述您的問題，我們會轉給商家處理。"
                  : "以下是您與 AI 對話的摘要，您可以編輯後送給商家，或自行複製使用。"}
              </p>
            </div>

            {handoffLoading ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "24px 0" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 0.18, 0.36].map((d, i) => (
                    <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#A6D8F5", display: "inline-block",
                      animation: `bounce 1.2s ${d}s infinite`, animationTimingFunction: "ease-in-out" }} />
                  ))}
                </div>
                <p style={{ fontSize: 13, color: "#94a3b8" }}>AI 正在生成摘要…</p>
              </div>
            ) : handoffDone ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "24px 0" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>✅</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#16a34a" }}>已送給商家</p>
                <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>商家收到後會盡快與您聯繫。</p>
                {(contactEmail || contactPhone) && (
                  <div style={{ marginTop: 8, background: "#f8fafc", borderRadius: 12, padding: "12px 16px", width: "100%" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>也可直接聯絡</p>
                    {contactEmail && <p style={{ fontSize: 13, color: "#1e293b" }}>✉️ {contactEmail}</p>}
                    {contactPhone && <p style={{ fontSize: 13, color: "#1e293b", marginTop: 4 }}>📞 {contactPhone}</p>}
                  </div>
                )}
                <button onClick={() => setShowHandoffModal(false)}
                  style={{ marginTop: 4, fontSize: 13, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}>
                  關閉
                </button>
              </div>
            ) : showEmailStep ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                    Email <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={handoffEmail}
                    onChange={(e) => setHandoffEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoFocus
                    style={{
                      width: "100%", borderRadius: 12,
                      border: `1.5px solid ${handoffEmail.trim() ? "#e2e8f0" : "#fca5a5"}`,
                      padding: "12px 14px", fontSize: 14, color: "#1e293b",
                      outline: "none", background: "#f8fafc", fontFamily: "inherit",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#A6D8F5"; e.currentTarget.style.background = "white"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = handoffEmail.trim() ? "#e2e8f0" : "#fca5a5"; e.currentTarget.style.background = "#f8fafc"; }}
                    onKeyDown={(e) => e.key === "Enter" && handoffEmail.trim() && submitHandoff()}
                  />
                  {!handoffEmail.trim() && (
                    <p style={{ fontSize: 11, color: "#ef4444" }}>請填寫 Email，商家才能回覆您。</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={submitHandoff}
                    disabled={handoffSubmitting || !handoffEmail.trim()}
                    style={{
                      flex: 1, padding: "11px 0", borderRadius: 12, border: "none",
                      cursor: handoffEmail.trim() && !handoffSubmitting ? "pointer" : "not-allowed",
                      fontSize: 13, fontWeight: 600, color: "#1e293b",
                      background: handoffEmail.trim() && !handoffSubmitting ? "#A6D8F5" : "#cbd5e1",
                      opacity: handoffSubmitting ? 0.7 : 1,
                    }}>
                    {handoffSubmitting ? "送出中…" : "確認送出"}
                  </button>
                  <button
                    onClick={() => setShowEmailStep(false)}
                    style={{
                      padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0",
                      background: "white", cursor: "pointer", fontSize: 13, color: "#94a3b8",
                    }}>
                    返回
                  </button>
                </div>
              </>
            ) : (
              <>
                <textarea
                  value={handoffSummary}
                  onChange={(e) => setHandoffSummary(e.target.value)}
                  rows={8}
                  style={{
                    flex: 1, width: "100%", borderRadius: 12, border: "1.5px solid #e2e8f0",
                    padding: "12px 14px", fontSize: 13, color: "#1e293b", lineHeight: 1.7,
                    resize: "vertical", outline: "none", background: "#f8fafc", fontFamily: "inherit",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#A6D8F5"; e.currentTarget.style.background = "white"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={requestEmail}
                    disabled={!handoffSummary.trim()}
                    style={{
                      flex: 1, padding: "11px 0", borderRadius: 12, border: "none", cursor: "pointer",
                      fontSize: 13, fontWeight: 600, color: "#1e293b",
                      background: handoffSummary.trim() ? "#A6D8F5" : "#cbd5e1",
                    }}>
                    送給商家
                  </button>
                  <button
                    onClick={copySummary}
                    disabled={!handoffSummary.trim()}
                    style={{
                      padding: "11px 16px", borderRadius: 12, border: "1.5px solid #e2e8f0",
                      background: handoffCopied ? "#f0fdf4" : "white", cursor: "pointer",
                      fontSize: 13, fontWeight: 600,
                      color: handoffCopied ? "#16a34a" : "#64748b",
                    }}>
                    {handoffCopied ? "已複製" : "複製"}
                  </button>
                  <button
                    onClick={() => setShowHandoffModal(false)}
                    style={{
                      padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0",
                      background: "white", cursor: "pointer", fontSize: 13, color: "#94a3b8",
                    }}>
                    取消
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%,100%{transform:translateY(0);opacity:.5}
          50%{transform:translateY(-4px);opacity:1}
        }
        @keyframes fadeIn {
          from{opacity:0;transform:translateY(4px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes pulse {
          0%,100%{transform:scale(1);opacity:0.8}
          50%{transform:scale(1.2);opacity:1}
        }
      `}</style>
    </div>
  );
}
