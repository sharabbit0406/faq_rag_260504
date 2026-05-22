"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiUpload } from "@/lib/api";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

function StyledInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
      onFocus={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

function StyledTextarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props}
      className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none resize-none transition-all"
      onFocus={(e) => { e.currentTarget.style.borderColor = "#38bdf8"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

function SaveButton({ loading, label = "儲存" }: { loading: boolean; label?: string }) {
  return (
    <button type="submit" disabled={loading}
      className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
      style={{ background: "linear-gradient(135deg,#3b82f6,#38bdf8)" }}>
      {loading ? "儲存中…" : label}
    </button>
  );
}

function SaveStatus({ saved, error }: { saved: boolean; error: string }) {
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (saved) return <p className="text-sm text-emerald-600 font-medium">已儲存 ✓</p>;
  return null;
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <pre
        className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-x-auto leading-relaxed"
        style={{ fontFamily: "ui-monospace,'Cascadia Code',monospace", color: "#334155", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
      >{code}</pre>
      <button
        type="button"
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-2.5 right-2.5 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
      >
        {copied ? "已複製 ✓" : "複製"}
      </button>
    </div>
  );
}

function getEmbedCode(tab: string, widgetUrl: string, embedScriptUrl: string, tenantId: string): string {
  switch (tab) {
    case "script":
      return `<!-- 智慧客服 Widget -->\n<script src="${embedScriptUrl}" data-tenant="${tenantId}"></script>`;
    case "float":
      return `<style>
  #faq-btn {
    position: fixed; bottom: 24px; right: 24px;
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(135deg, #1d4ed8, #38bdf8);
    color: #fff; border: none; font-size: 24px;
    cursor: pointer; z-index: 9999;
    box-shadow: 0 4px 20px rgba(29,78,216,.4);
  }
  #faq-win {
    position: fixed; bottom: 92px; right: 24px;
    width: 360px; height: 520px; border-radius: 20px;
    overflow: hidden; z-index: 9998; opacity: 0;
    pointer-events: none; transform: scale(.95) translateY(12px);
    box-shadow: 0 12px 48px rgba(0,0,0,.18);
    transition: transform .25s, opacity .2s;
  }
  #faq-win.open { opacity: 1; pointer-events: auto; transform: none; }
  #faq-win iframe { width: 100%; height: 100%; border: none; }
</style>

<button id="faq-btn">💬</button>
<div id="faq-win">
  <iframe src="${widgetUrl}" title="客服助理"></iframe>
</div>
<script>
  var b = document.getElementById('faq-btn');
  var w = document.getElementById('faq-win');
  var o = false;
  b.onclick = function () {
    o = !o;
    w.classList.toggle('open', o);
    b.textContent = o ? '✕' : '💬';
  };
</script>`;
    case "inline":
      return `<div style="width:380px; height:600px; border-radius:16px;
  overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.12);">
  <iframe src="${widgetUrl}"
    style="width:100%; height:100%; border:none;"
    title="客服助理">
  </iframe>
</div>`;
    case "sidebar":
      return `<style>
  #faq-sidebar {
    position: fixed; right: 0; top: 0; height: 100vh; width: 360px;
    background: white; z-index: 9999;
    box-shadow: -4px 0 24px rgba(0,0,0,.12);
    transform: translateX(100%);
    transition: transform .3s cubic-bezier(.4,0,.2,1);
  }
  #faq-sidebar.open { transform: translateX(0); }
  #faq-sidebar iframe { width: 100%; height: 100%; border: none; }
  #faq-sidebar-btn {
    position: fixed; right: 0; top: 50%;
    transform: translateY(-50%);
    background: linear-gradient(180deg, #1d4ed8, #38bdf8);
    color: #fff; border: none;
    border-radius: 8px 0 0 8px;
    padding: 14px 8px; cursor: pointer; z-index: 10000;
    writing-mode: vertical-rl; font-size: 13px;
    font-weight: 600; letter-spacing: 2px;
    transition: right .3s;
  }
</style>

<div id="faq-sidebar">
  <iframe src="${widgetUrl}" title="客服助理"></iframe>
</div>
<button id="faq-sidebar-btn">客服</button>
<script>
  var btn = document.getElementById('faq-sidebar-btn');
  var sidebar = document.getElementById('faq-sidebar');
  var open = false;
  btn.onclick = function () {
    open = !open;
    sidebar.classList.toggle('open', open);
    btn.style.right = open ? '360px' : '0';
  };
</script>`;
    default:
      return "";
  }
}

function CopyRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 break-all text-blue-600 hover:underline font-mono">
            {value}
          </a>
        ) : (
          <code className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 break-all text-slate-700 font-mono">{value}</code>
        )}
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shrink-0">
          {copied ? "已複製 ✓" : "複製"}
        </button>
      </div>
    </div>
  );
}

interface TenantSettings {
  refusal_message: string; greeting_message: string;
  daily_llm_limit: number; contact_email?: string; contact_phone?: string;
  custom_suggestions?: string[];
  avatar_url?: string;
  loading_text?: string;
}

export default function SettingsPage() {
  const { tenant, user, logout, refreshTenant } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState("");

  const [pwSent, setPwSent] = useState(false);
  const [pwSending, setPwSending] = useState(false);
  const [pwError, setPwError] = useState("");

  const [dialogue, setDialogue] = useState({ greeting_message: "", refusal_message: "", custom_suggestions: ["", "", ""] as string[], loading_text: "" });
  const [savedDialogue, setSavedDialogue] = useState({ greeting_message: "", refusal_message: "", custom_suggestions: ["", "", ""] as string[], loading_text: "" });
  const [dialogueLoading, setDialogueLoading] = useState(true);
  const [dialogueSaving, setDialogueSaving] = useState(false);
  const [dialogueSaved, setDialogueSaved] = useState(false);
  const [dialogueError, setDialogueError] = useState("");

  const [system, setSystem] = useState({ daily_llm_limit: 100, contact_email: "", contact_phone: "" });
  const [savedSystem, setSavedSystem] = useState({ daily_llm_limit: 100, contact_email: "", contact_phone: "" });
  const [systemLoading, setSystemLoading] = useState(true);
  const [systemSaving, setSystemSaving] = useState(false);
  const [systemSaved, setSystemSaved] = useState(false);
  const [systemError, setSystemError] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [origin, setOrigin] = useState("");
  const [embedTab, setEmbedTab] = useState<"script" | "float" | "inline" | "sidebar">("script");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const settingsLoadedRef = useRef(false);
  const nameIsDirty = name.trim() !== savedName && !nameSaving;
  const dialogueIsDirty = JSON.stringify(dialogue) !== JSON.stringify(savedDialogue) && !dialogueSaving;
  const systemIsDirty = JSON.stringify(system) !== JSON.stringify(savedSystem) && !systemSaving;

  useEffect(() => {
    if (tenant) { setName(tenant.name); setSavedName(tenant.name); }
  }, [tenant]);

  useEffect(() => {
    if (!tenant || settingsLoadedRef.current) return;
    settingsLoadedRef.current = true;
    apiGet<TenantSettings>("/api/auth/settings")
      .then((data) => {
        const saved = data.custom_suggestions ?? [];
        const padded = [...saved, "", "", "", "", ""].slice(0, Math.max(3, saved.length));
        const d = { greeting_message: data.greeting_message, refusal_message: data.refusal_message, custom_suggestions: padded, loading_text: data.loading_text || "" };
        const s = { daily_llm_limit: data.daily_llm_limit, contact_email: data.contact_email || "", contact_phone: data.contact_phone || "" };
        setDialogue(d); setSavedDialogue(d);
        setSystem(s); setSavedSystem(s);
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
      })
      .catch(() => {})
      .finally(() => { setDialogueLoading(false); setSystemLoading(false); });
  }, [tenant]);

  async function uploadAvatar(file: File) {
    setAvatarUploading(true); setAvatarError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const token = await (await import("@/lib/firebase")).auth.currentUser?.getIdToken();
      const res = await fetch(`${BASE}/api/auth/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`${res.status}: ${txt}`);
      }
      const data = await res.json();
      setAvatarUrl(data.avatar_url);
    } catch (err: any) {
      console.error("uploadAvatar error:", err);
      setAvatarError(err.message || "上傳失敗");
    }
    finally { setAvatarUploading(false); }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === savedName) return;
    setNameSaving(true); setNameError(""); setNameSaved(false);
    try {
      await apiPatch("/api/auth/profile", { name: trimmed });
      await refreshTenant(); setSavedName(trimmed); setNameSaved(true); setTimeout(() => setNameSaved(false), 3000);
    } catch (err: any) { setNameError(err.message || "儲存失敗"); }
    finally { setNameSaving(false); }
  }

  async function saveDialogue(e: React.FormEvent) {
    e.preventDefault();
    setDialogueSaving(true); setDialogueError(""); setDialogueSaved(false);
    try {
      const cleanSuggestions = dialogue.custom_suggestions.filter((s) => s.trim());
      await apiPatch("/api/auth/settings", {
        greeting_message: dialogue.greeting_message,
        refusal_message: dialogue.refusal_message,
        custom_suggestions: cleanSuggestions,
        loading_text: dialogue.loading_text,
      });
      setSavedDialogue({ ...dialogue }); setDialogueSaved(true); setTimeout(() => setDialogueSaved(false), 3000);
    } catch (err: any) { setDialogueError(err.message || "儲存失敗"); }
    finally { setDialogueSaving(false); }
  }

  async function saveSystem(e: React.FormEvent) {
    e.preventDefault();
    setSystemSaving(true); setSystemError(""); setSystemSaved(false);
    try {
      await apiPatch("/api/auth/settings", { daily_llm_limit: system.daily_llm_limit, contact_email: system.contact_email, contact_phone: system.contact_phone });
      setSavedSystem({ ...system }); setSystemSaved(true); setTimeout(() => setSystemSaved(false), 3000);
    } catch (err: any) { setSystemError(err.message || "儲存失敗"); }
    finally { setSystemSaving(false); }
  }

  if (dialogueLoading || systemLoading) {
    return <div className="py-16 text-center text-sm text-slate-400">載入中…</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">設定</h1>
        <p className="text-sm text-slate-500 mt-1">管理您的商家資訊與客服設定</p>
      </div>

      {/* 商家資訊 */}
      <Section title="商家資訊">
        {/* Avatar upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">客服頭像</label>
          <p className="text-xs text-slate-400">顯示在聊天視窗的 AI 頭像，建議使用正方形圖片。未上傳時顯示預設機器人圖示。</p>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{ background: avatarUrl ? "transparent" : "linear-gradient(135deg,#3b82f6,#38bdf8)", border: "2px solid #e2e8f0" }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="頭像預覽" className="w-full h-full object-cover" />
                : <span className="text-2xl">🤖</span>}
            </div>
            <div className="space-y-1.5">
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }} />
              <button type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                {avatarUploading ? "上傳中…" : avatarUrl ? "更換圖片" : "上傳圖片"}
              </button>
              <p className="text-xs text-slate-400">JPG / PNG / WebP，最大 2MB</p>
              {avatarError && <p className="text-xs text-red-500">{avatarError}</p>}
            </div>
          </div>
        </div>

        <form onSubmit={saveName} className="space-y-3">
          <Field label="店家名稱">
            <div className="flex gap-2">
              <StyledInput value={name} onChange={(e) => setName(e.target.value)} placeholder="店家名稱" required className="flex-1" />
              <button type="submit" disabled={nameSaving || !nameIsDirty}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all whitespace-nowrap shrink-0"
                style={{ background: "linear-gradient(135deg,#3b82f6,#38bdf8)" }}>
                {nameSaving ? "儲存中…" : "儲存"}
              </button>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {nameIsDirty && <span className="text-xs text-amber-500 font-medium">● 有未儲存的變更</span>}
              <SaveStatus saved={nameSaved} error={nameError} />
            </div>
          </Field>
        </form>

        <Field label="登入 Email" hint="Email 為登入識別，無法直接修改">
          <StyledInput value={user?.email ?? ""} disabled />
        </Field>

        <Field label="密碼" hint="系統會寄送重設連結到您的 Email">
          {pwSent ? (
            <p className="text-sm text-emerald-600 font-medium">重設密碼信件已寄出，請查收 {user?.email}</p>
          ) : (
            <div className="space-y-2">
              <button type="button"
                onClick={async () => {
                  if (!user?.email) { setPwError("找不到登入 Email，請重新登入後再試"); return; }
                  setPwSending(true); setPwError("");
                  try { await sendPasswordResetEmail(auth, user.email); setPwSent(true); }
                  catch (err: any) { setPwError(err.message || "寄送失敗，請稍後再試"); }
                  finally { setPwSending(false); }
                }}
                disabled={pwSending}
                className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                {pwSending ? "寄送中…" : "寄送重設密碼信"}
              </button>
              {pwError && <p className="text-sm text-red-600">{pwError}</p>}
            </div>
          )}
        </Field>
      </Section>

      {/* 對話設定 */}
      <form onSubmit={saveDialogue}>
        <Section title="對話設定">
          <Field label="歡迎訊息" hint="用戶開啟對話視窗時，AI 會先說這句話">
            <StyledTextarea rows={3} value={dialogue.greeting_message}
              onChange={(e) => setDialogue((s) => ({ ...s, greeting_message: e.target.value }))}
              placeholder="您好！我是智慧客服助理…" required />
          </Field>
          <Field label="拒答訊息" hint="知識庫無法回答時顯示此訊息">
            <StyledTextarea rows={4} value={dialogue.refusal_message}
              onChange={(e) => setDialogue((s) => ({ ...s, refusal_message: e.target.value }))}
              placeholder="抱歉，目前資料庫中找不到相關資訊…" required />
          </Field>

          <Field label="引導提問泡泡" hint="歡迎語下方顯示的快速提問按鈕，最多 5 個。空白的欄位會自動忽略；未設定時系統自動從知識庫產生。">
            <div className="space-y-2">
              {dialogue.custom_suggestions.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-4 shrink-0">{i + 1}</span>
                  <StyledInput
                    value={q}
                    onChange={(e) => setDialogue((s) => {
                      const next = [...s.custom_suggestions];
                      next[i] = e.target.value;
                      return { ...s, custom_suggestions: next };
                    })}
                    placeholder={`泡泡 ${i + 1}（選填）`}
                  />
                  {dialogue.custom_suggestions.length > 3 && (
                    <button type="button"
                      onClick={() => setDialogue((s) => ({ ...s, custom_suggestions: s.custom_suggestions.filter((_, idx) => idx !== i) }))}
                      className="text-slate-300 hover:text-red-400 transition-colors shrink-0 text-lg leading-none">
                      ×
                    </button>
                  )}
                </div>
              ))}
              {dialogue.custom_suggestions.length < 5 && (
                <button type="button"
                  onClick={() => setDialogue((s) => ({ ...s, custom_suggestions: [...s.custom_suggestions, ""] }))}
                  className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                  ＋ 新增泡泡
                </button>
              )}
            </div>
          </Field>

          <Field label="等待回覆提示文字" hint="AI 思考中時顯示的文字，留空則使用預設「AI 回覆中，請稍候…」">
            <StyledInput
              value={dialogue.loading_text}
              onChange={(e) => setDialogue((s) => ({ ...s, loading_text: e.target.value }))}
              placeholder="AI 回覆中，請稍候…"
              maxLength={80}
            />
          </Field>

          <div className="flex items-center gap-3 pt-1">
            <SaveButton loading={dialogueSaving} />
            {dialogueIsDirty && <span className="text-xs text-amber-500 font-medium">● 有未儲存的變更</span>}
            <SaveStatus saved={dialogueSaved} error={dialogueError} />
          </div>
        </Section>
      </form>

      {/* 系統設定 */}
      <form onSubmit={saveSystem}>
        <Section title="系統設定">
          <Field label="每日 LLM 呼叫上限" hint="超過上限後當日不再呼叫 Gemini API。設 0 為不限制">
            <div className="flex items-center gap-2">
              <StyledInput type="number" min={0} max={10000} value={system.daily_llm_limit}
                onChange={(e) => setSystem((s) => ({ ...s, daily_llm_limit: parseInt(e.target.value) || 0 }))}
                style={{ width: "120px" }} />
              <span className="text-sm text-slate-400">次 / 天</span>
            </div>
          </Field>
          <Field label="客服聯絡 Email" hint="用戶點擊信箱即可寄信給您">
            <StyledInput type="email" value={system.contact_email}
              onChange={(e) => setSystem((s) => ({ ...s, contact_email: e.target.value }))}
              placeholder="support@example.com" />
          </Field>
          <Field label="客服聯絡電話" hint="用戶點擊電話即可直接撥號">
            <StyledInput type="tel" value={system.contact_phone}
              onChange={(e) => setSystem((s) => ({ ...s, contact_phone: e.target.value }))}
              placeholder="+886-2-12345678" />
          </Field>
          <div className="flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>💡</span>
            <p className="text-xs text-blue-700 leading-relaxed">
              至少填入 <strong>Email 或電話其中一項</strong>，用戶對話頁面才會顯示「真人客服」按鈕。兩項都填則同時提供兩種聯絡方式。
            </p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <SaveButton loading={systemSaving} />
            {systemIsDirty && <span className="text-xs text-amber-500 font-medium">● 有未儲存的變更</span>}
            <SaveStatus saved={systemSaved} error={systemError} />
          </div>
        </Section>
      </form>

      {/* 嵌入設定 */}
      {tenant && (
        <Section title="嵌入設定">
          <CopyRow
            label="對話頁面連結"
            value={`${origin}/chat/${tenant.id}`}
            href={`${origin}/chat/${tenant.id}`}
          />

          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">嵌入客服視窗</p>
            <p className="text-xs text-slate-400 mb-4">
              選擇嵌入樣式，將程式碼貼到您網站的{" "}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">&lt;/body&gt;</code> 標籤前
            </p>

            {/* Tab bar */}
            <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{ background: "#f1f5f9" }}>
              {(
                [
                  { key: "script",  label: "一鍵嵌入", badge: "推薦" },
                  { key: "float",   label: "浮動按鈕",  badge: "" },
                  { key: "inline",  label: "固定內嵌",  badge: "" },
                  { key: "sidebar", label: "側邊欄",    badge: "" },
                ] as { key: "script"|"float"|"inline"|"sidebar"; label: string; badge: string }[]
              ).map(({ key, label, badge }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEmbedTab(key)}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg transition-all"
                  style={
                    embedTab === key
                      ? { background: "white", color: "#1d4ed8", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                      : { color: "#64748b" }
                  }
                >
                  {label}
                  {badge && (
                    <span className="ml-1 text-blue-400" style={{ fontSize: 10 }}>{badge}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Description */}
            <p className="text-xs text-slate-400 mb-3">
              {embedTab === "script"  && "最簡單的方式，一行 script 標籤即可完成，自動建立右下角浮動按鈕"}
              {embedTab === "float"   && "純 HTML/CSS/JS 浮動按鈕，點擊右下角 💬 展開聊天視窗"}
              {embedTab === "inline"  && "嵌入到頁面固定區塊，適合獨立客服頁面或嵌入說明文件"}
              {embedTab === "sidebar" && "從右側滑入的側邊欄，點擊「客服」標籤展開"}
            </p>

            <CodeBlock
              code={getEmbedCode(
                embedTab,
                `${origin}/widget/${tenant.id}`,
                `${origin}/embed.js`,
                tenant.id,
              )}
            />
          </div>
        </Section>
      )}

      {/* 帳號操作 */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100">
          <h2 className="text-sm font-semibold text-red-600">帳號操作</h2>
        </div>
        <div className="px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">登出帳號</p>
            <p className="text-xs text-slate-400 mt-0.5">登出後需重新以 Email 登入</p>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/login"); }}
            className="text-sm px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
            登出
          </button>
        </div>
      </div>
    </div>
  );
}
