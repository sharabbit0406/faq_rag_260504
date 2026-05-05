"use client";

import React, { useState, useEffect, useRef } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
  was_refused?: boolean;
}

interface WidgetConfig {
  tenant_name: string;
  contact_email?: string;
  contact_phone?: string;
  support_cta?: string;
  greeting_message: string;
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function BotAvatar() {
  return (
    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zm-3 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
      </svg>
    </div>
  );
}

export default function WidgetPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = React.use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [endUserId, setEndUserId] = useState<string>("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [config, setConfig] = useState<WidgetConfig>({
    tenant_name: "客服助理",
    greeting_message: "您好！我是智慧客服助理，很高興為您服務。請問有什麼我可以幫助您的嗎？",
  });
  const [showContactMenu, setShowContactMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = `end_user_id_${tenantId}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    setEndUserId(id);
  }, [tenantId]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/chat/widget-config/${tenantId}`)
      .then((res) => res.json())
      .then((data: WidgetConfig) => {
        setConfig(data);
        setMessages([{ role: "assistant", content: data.greeting_message }]);
      })
      .catch(() => {
        setMessages([{ role: "assistant", content: "您好！我是智慧客服助理，有什麼可以幫您的嗎？" }]);
      });
  }, [tenantId]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/chat/suggestions?tenant_id=${tenantId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.questions)) setSuggestions(data.questions.slice(0, 4));
      })
      .catch(() => {});
  }, [tenantId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (question?: string) => {
    const text = (question ?? input).trim();
    if (!text || loading || !endUserId) return;

    setInput("");
    setSuggestions([]);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    inputRef.current?.focus();

    try {
      const res = await fetch(`${BASE_URL}/api/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          conversation_id: conversationId,
          question: text,
          end_user_id: endUserId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "請求失敗");

      if (data.conversation_id && data.conversation_id !== "greeting") {
        setConversationId(data.conversation_id);
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, was_refused: data.was_refused },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "發生錯誤，請稍後再試。" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const contactEmail = config.contact_email || "support@example.com";
  const supportCta = config.support_cta || "聯繫人工客服";
  const isFirstMessage = messages.length === 1 && messages[0].role === "assistant";

  const renderContent = (text: string) => {
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const phoneRegex = /((?:\+?886|0)\d[\d\-\s]{7,})/g;

    const combined = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|((?:\+?886|0)\d[\d\-\s]{7,})/g;
    const parts: React.ReactNode[] = [];
    let last = 0;
    let match;

    while ((match = combined.exec(text)) !== null) {
      if (last < match.index) parts.push(text.slice(last, match.index));
      if (emailRegex.test(match[0])) {
        parts.push(<a key={match.index} href={`mailto:${match[0]}`} className="underline opacity-80 hover:opacity-100">{match[0]}</a>);
      } else if (phoneRegex.test(match[0])) {
        parts.push(<a key={match.index} href={`tel:${match[0].replace(/\s/g, "")}`} className="underline opacity-80 hover:opacity-100">{match[0]}</a>);
      }
      last = match.index + match[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length ? parts : text;
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#f6f7fb" }}
    >
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #3b82f6 0%, #38bdf8 100%)", flexShrink: 0 }}
        className="px-4 py-3 flex items-center gap-3 shadow-sm"
      >
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">
          🤖
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate">{config.tenant_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="text-white/70 text-xs">由AI服務</span>
          </div>
        </div>
        {/* 真人客服按鈕 + 彈出選單 */}
        {(config.contact_email || config.contact_phone) && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setShowContactMenu((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold rounded-lg px-2.5 py-1.5 transition-all"
              style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.32)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.2)"; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              真人客服
            </button>
            {showContactMenu && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setShowContactMenu(false)} />
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 20,
                  minWidth: 200, overflow: "hidden",
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", padding: "10px 14px 6px", letterSpacing: "0.5px" }}>聯絡真人客服</p>
                  {config.contact_email && (
                    <a href={`mailto:${config.contact_email}`}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", textDecoration: "none", color: "#1e293b", fontSize: 13 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#f1f5f9"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                      onClick={() => setShowContactMenu(false)}
                    >
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✉️</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{config.contact_email}</span>
                    </a>
                  )}
                  {config.contact_phone && (
                    <a href={`tel:${config.contact_phone}`}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", textDecoration: "none", color: "#1e293b", fontSize: 13 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#f1f5f9"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
                      onClick={() => setShowContactMenu(false)}
                    >
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📞</span>
                      <span>{config.contact_phone}</span>
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            {msg.role === "assistant" && <BotAvatar />}

            <div className={`max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div
                className="rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed break-words shadow-sm"
                style={
                  msg.role === "user"
                    ? { background: "linear-gradient(135deg, #3b82f6, #38bdf8)", color: "white", borderBottomRightRadius: "4px" }
                    : msg.was_refused
                    ? { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", borderBottomLeftRadius: "4px" }
                    : { background: "white", color: "#1e293b", borderBottomLeftRadius: "4px", border: "1px solid #e2e8f0" }
                }
              >
                <p className="whitespace-pre-wrap">{renderContent(msg.content)}</p>
                {msg.was_refused && (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="flex items-center gap-1 mt-2 text-orange-600 font-medium text-xs hover:underline"
                  >
                    <span>✉</span> {supportCta}
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* 推薦問題 */}
        {isFirstMessage && suggestions.length > 0 && (
          <div className="flex flex-col gap-2 pl-8">
            {suggestions.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="text-left text-xs px-3.5 py-2 rounded-xl border transition-all"
                style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  color: "#3b82f6",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#93c5fd";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "white";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* 打字中動畫 */}
        {loading && (
          <div className="flex gap-2">
            <BotAvatar />
            <div className="bg-white border border-e2e8f0 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm"
              style={{ border: "1px solid #e2e8f0" }}>
              <div className="flex gap-1 items-center h-3">
                {[0, 0.18, 0.36].map((d, idx) => (
                  <span
                    key={idx}
                    className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"
                    style={{ animation: `bounce 1.2s ${d}s infinite`, animationTimingFunction: "ease-in-out" }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-3 py-3" style={{ background: "white", borderTop: "1px solid #e2e8f0" }}>
        <div className="flex items-center gap-2 rounded-2xl px-3 py-1.5"
          style={{ background: "#f1f5f9", border: "1.5px solid transparent", transition: "border-color 0.2s" }}
          onFocusCapture={(e) => (e.currentTarget.style.borderColor = "#38bdf8")}
          onBlurCapture={(e) => (e.currentTarget.style.borderColor = "transparent")}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="輸入您的問題…"
            disabled={loading}
            className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none disabled:opacity-50 py-1"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: input.trim() && !loading ? "linear-gradient(135deg, #3b82f6, #38bdf8)" : "#cbd5e1",
              color: "white",
              transform: input.trim() && !loading ? "scale(1)" : "scale(0.9)",
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
