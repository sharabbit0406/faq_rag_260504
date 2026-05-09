"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch } from "@/lib/api";

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

  const [dialogue, setDialogue] = useState({ greeting_message: "", refusal_message: "" });
  const [savedDialogue, setSavedDialogue] = useState({ greeting_message: "", refusal_message: "" });
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

  const nameIsDirty = name.trim() !== savedName && !nameSaving;
  const dialogueIsDirty = JSON.stringify(dialogue) !== JSON.stringify(savedDialogue) && !dialogueSaving;
  const systemIsDirty = JSON.stringify(system) !== JSON.stringify(savedSystem) && !systemSaving;

  useEffect(() => {
    if (tenant) { setName(tenant.name); setSavedName(tenant.name); }
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    apiGet<TenantSettings>("/api/auth/settings")
      .then((data) => {
        const d = { greeting_message: data.greeting_message, refusal_message: data.refusal_message };
        const s = { daily_llm_limit: data.daily_llm_limit, contact_email: data.contact_email || "", contact_phone: data.contact_phone || "" };
        setDialogue(d); setSavedDialogue(d);
        setSystem(s); setSavedSystem(s);
      })
      .catch(() => {})
      .finally(() => { setDialogueLoading(false); setSystemLoading(false); });
  }, [tenant]);

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
      await apiPatch("/api/auth/settings", { greeting_message: dialogue.greeting_message, refusal_message: dialogue.refusal_message });
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

      {/* 終端用戶連結 */}
      {tenant && (
        <Section title="終端用戶連結">
          <CopyRow label="對話頁面" value={`http://localhost:3000/chat/${tenant.id}`} href={`http://localhost:3000/chat/${tenant.id}`} />
          <CopyRow label="Widget 嵌入碼（iframe）"
            value={`<iframe src="http://localhost:3000/widget/${tenant.id}" width="380" height="600" frameborder="0"></iframe>`} />
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
