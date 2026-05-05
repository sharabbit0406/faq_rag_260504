"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/dashboard",  icon: "▣",  label: "管理概覽" },
  { href: "/knowledge",  icon: "◈",  label: "知識庫" },
  { href: "/unanswered", icon: "◎",  label: "未解問題" },
  { href: "/playground", icon: "◉",  label: "對話測試" },
  { href: "/settings",   icon: "◐",  label: "設定" },
];

function SidebarContent({
  pathname, tenant, initials, onLinkClick,
}: {
  pathname: string; tenant: { name: string }; initials: string; onLinkClick?: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "20px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#1d4ed8,#38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>✦</div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>智慧客服</p>
          <p style={{ fontSize: 11, color: "#94a3b8" }}>管理後台</p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 12, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} onClick={onLinkClick}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10,
                fontSize: 13, fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap",
                ...(active
                  ? { background: "linear-gradient(135deg,#1d4ed8,#38bdf8)", color: "white" }
                  : { color: "#64748b" }),
              }}
              onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = "#f1f5f9"; (e.currentTarget as HTMLAnchorElement).style.color = "#1e293b"; } }}
              onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "#64748b"; } }}
            >
              <span style={{ fontSize: 15, width: 20, textAlign: "center", flexShrink: 0 }}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Tenant */}
      <div style={{ padding: 12, borderTop: "1px solid #e2e8f0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "#f8fafc", whiteSpace: "nowrap" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#1d4ed8,#38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
          <p style={{ fontSize: 12, color: "#475569", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>{tenant.name}</p>
        </div>
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !tenant)) router.push("/login");
  }, [user, tenant, loading, router]);

  if (loading || !user || !tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#f6f7fb" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-xl"
            style={{ background: "linear-gradient(135deg,#1d4ed8,#38bdf8)" }}>✦</div>
          <p className="text-sm text-slate-500">載入中…</p>
        </div>
      </div>
    );
  }

  const initials = tenant.name.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f6f7fb", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Desktop sidebar wrapper（panel + toggle tab） ── */}
      <div className="hidden md:flex flex-row flex-shrink-0 h-full" style={{ position: "relative", zIndex: 10 }}>
        {/* Sidebar panel */}
        <aside
          style={{
            width: collapsed ? 0 : 240,
            overflow: "hidden",
            transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
            background: "white",
            borderRight: collapsed ? "none" : "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            flexShrink: 0,
          }}
        >
          <SidebarContent pathname={pathname} tenant={tenant} initials={initials} />
        </aside>

        {/* Toggle tab：始終可見，箭頭指示方向 */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "展開側邊欄" : "收起側邊欄"}
          style={{
            width: 22,
            background: "white",
            border: "1px solid #e2e8f0",
            borderLeft: "none",
            borderRadius: "0 8px 8px 0",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 0.15s",
            padding: 0,
            outline: "none",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "white"; }}
        >
          {/* 收起時朝右（→），展開時朝左（←） */}
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{
              transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
              transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* ── Mobile sidebar（slide-in） ── */}
      <aside
        className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:hidden fixed z-30 flex flex-col h-full transition-transform duration-300`}
        style={{ width: 240, background: "white", borderRight: "1px solid #e2e8f0" }}
      >
        <SidebarContent pathname={pathname} tenant={tenant} initials={initials} onLinkClick={() => setMobileOpen(false)} />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center px-5 gap-4 border-b flex-shrink-0"
          style={{ background: "white", borderColor: "#e2e8f0" }}>
          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* 用戶對話區 快捷按鈕 */}
          <a
            href={`/chat/${tenant.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 border text-sm font-medium transition-all"
            style={{ background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8", textDecoration: "none" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#dbeafe"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#eff6ff"; }}
          >
            <span style={{ fontSize: 15 }}>💬</span>
            <span className="hidden sm:inline">用戶對話區</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>

          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg,#1d4ed8,#38bdf8)" }}>{initials}</div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">{tenant.name}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}
