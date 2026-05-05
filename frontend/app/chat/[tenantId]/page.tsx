"use client";

import React, { useState, useEffect, useRef } from "react";
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

function BotAvatar() {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-sm"
      style={{ background: "linear-gradient(135deg,#3b82f6,#38bdf8)" }}>🤖</div>
  );
}

export default function ChatPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = React.use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [endUserId, setEndUserId] = useState<string>("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>("智慧客服");
  const [greetingMessage, setGreetingMessage] = useState<string>("您好！我是智慧客服助理，可以回答關於本服務的相關問題。");
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = `end_user_id_${tenantId}`;
    let id = localStorage.getItem(key);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
    setEndUserId(id);
  }, [tenantId]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/chat/widget-config/${tenantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.tenant_name) setTenantName(data.tenant_name);
        if (data?.greeting_message) setGreetingMessage(data.greeting_message);
        if (data?.contact_email) setContactEmail(data.contact_email);
        if (data?.contact_phone) setContactPhone(data.contact_phone);
      }).catch(() => {});

    fetch(`${BASE_URL}/api/chat/suggestions?tenant_id=${tenantId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.questions?.length) setSuggestions(data.questions.slice(0, 4)); })
      .catch(() => {});
  }, [tenantId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading || !endUserId) return;
    setInput("");
    setSuggestions([]);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    inputRef.current?.focus();

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
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `錯誤：${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const showSuggestions = suggestions.length > 0 && messages.length === 0;

  return (
    <div className="flex flex-col h-screen" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background: "#f6f7fb" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3.5 flex items-center gap-3 border-b"
        style={{ background: "white", borderColor: "#e2e8f0" }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#3b82f6,#38bdf8)" }}>🤖</div>
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
              onClick={() => setShowContactMenu((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-1.5 transition-all"
              style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#dbeafe"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff"; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              真人客服
            </button>
            {showContactMenu && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setShowContactMenu(false)} />
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  background: "white", borderRadius: 14, border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 28px rgba(0,0,0,0.10)", zIndex: 20,
                  minWidth: 210, overflow: "hidden",
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", padding: "11px 16px 6px", letterSpacing: "0.5px" }}>聯絡真人客服</p>
                  {contactEmail && (
                    <a href={`mailto:${contactEmail}`}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", textDecoration: "none", color: "#1e293b", fontSize: 13 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#f8fafc"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                      onClick={() => setShowContactMenu(false)}
                    >
                      <span style={{ width: 30, height: 30, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15 }}>✉️</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contactEmail}</span>
                    </a>
                  )}
                  {contactPhone && (
                    <a href={`tel:${contactPhone}`}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", textDecoration: "none", color: "#1e293b", fontSize: 13 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#f8fafc"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                      onClick={() => setShowContactMenu(false)}
                    >
                      <span style={{ width: 30, height: 30, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15 }}>📞</span>
                      <span>{contactPhone}</span>
                    </a>
                  )}
                  <div style={{ height: 6 }} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

        {/* Greeting */}
        <div className="flex gap-2.5">
          <BotAvatar />
          <div className="max-w-[80%]">
            <div className="rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-800 shadow-sm"
              style={{ background: "white", border: "1px solid #e2e8f0" }}>
              <p className="whitespace-pre-wrap">{greetingMessage}</p>
            </div>
            {showSuggestions && (
              <div className="mt-3 flex flex-col gap-2">
                {suggestions.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)} disabled={loading}
                    className="text-left text-xs px-3.5 py-2 rounded-xl transition-all disabled:opacity-50"
                    style={{ background: "white", border: "1px solid #e2e8f0", color: "#3b82f6", fontWeight: 500 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#93c5fd"; }}
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
            {msg.role === "assistant" && <BotAvatar />}
            <div className={`max-w-[80%] flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className="rounded-2xl px-4 py-3 text-sm shadow-sm"
                style={
                  msg.role === "user"
                    ? { background: "linear-gradient(135deg,#3b82f6,#38bdf8)", color: "white", borderBottomRightRadius: "4px" }
                    : msg.was_refused
                    ? { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderBottomLeftRadius: "4px" }
                    : { background: "white", border: "1px solid #e2e8f0", color: "#1e293b", borderBottomLeftRadius: "4px" }
                }>
                {msg.was_refused && <p className="text-xs font-semibold mb-1 opacity-70">⚠ 拒答</p>}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
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
                          <div className="mt-1 text-xs rounded-xl px-3 py-2 text-blue-700 leading-relaxed"
                            style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                            {c.excerpt}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <BotAvatar />
            <div className="rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm" style={{ background: "white", border: "1px solid #e2e8f0" }}>
              <div className="flex gap-1 items-center h-4">
                {[0, 0.18, 0.36].map((d, idx) => (
                  <span key={idx} className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"
                    style={{ animation: `bounce 1.2s ${d}s infinite`, animationTimingFunction: "ease-in-out" }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 border-t" style={{ background: "white", borderColor: "#e2e8f0" }}>
        <div className="flex items-center gap-2 rounded-2xl px-3 py-1.5 transition-all"
          style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0" }}
          onFocusCapture={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.background = "white"; }}
          onBlurCapture={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="輸入您的問題…"
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none py-1.5 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 flex-shrink-0"
            style={{ background: input.trim() && !loading ? "linear-gradient(135deg,#3b82f6,#38bdf8)" : "#cbd5e1" }}>
            <SendIcon />
          </button>
        </div>
        <p className="text-center text-xs text-slate-300 mt-2">回答來自商家知識庫，由 AI 提供服務</p>
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
