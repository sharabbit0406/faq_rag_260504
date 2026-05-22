"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Document, DocumentStatus } from "@/lib/types";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const map: Record<DocumentStatus, { label: string; bg: string; color: string }> = {
    pending:    { label: "等待中",  bg: "#f1f5f9", color: "#64748b" },
    processing: { label: "索引中…", bg: "#e8f4fc", color: "#5ba8d4" },
    done:       { label: "完成",   bg: "#f0fdf4", color: "#16a34a" },
    failed:     { label: "失敗",   bg: "#fef2f2", color: "#dc2626" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function FileIcon({ type }: { type: string }) {
  const isPdf = type === "pdf";
  const isSheet = ["csv", "xlsx", "xls"].includes(type);
  const bg = isPdf ? "#fef2f2" : isSheet ? "#f0fdf4" : "#f8fafc";
  const color = isPdf ? "#ef4444" : isSheet ? "#16a34a" : "#64748b";
  const icon = isPdf ? "📄" : isSheet ? "📊" : "📝";
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" style={{ background: bg, color }}>
      {icon}
    </div>
  );
}

export default function KnowledgePage() {
  const { tenant } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const fetchDocs = useCallback(async () => {
    if (!tenant) return;
    try {
      const data = await apiGet<Document[]>("/api/documents/");
      setDocs(data);
      data.forEach((d) => {
        if ((d.status === "pending" || d.status === "processing") && !pollingRef.current[d.id]) startPolling(d.id);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "未知錯誤";
      alert(`載入文件列表失敗：${msg}`);
    }
  }, [tenant]);

  useEffect(() => {
    fetchDocs();
    return () => { Object.values(pollingRef.current).forEach(clearInterval); };
  }, [fetchDocs]);

  function startPolling(docId: string) {
    pollingRef.current[docId] = setInterval(async () => {
      try {
        const s = await apiGet<{ id: string; status: DocumentStatus; chunk_count: number; error_message?: string }>(
          `/api/documents/${docId}/status`
        );
        setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, status: s.status, chunk_count: s.chunk_count, error_message: s.error_message } : d));
        if (s.status === "done" || s.status === "failed") {
          clearInterval(pollingRef.current[docId]); delete pollingRef.current[docId];
        }
      } catch {
        clearInterval(pollingRef.current[docId]); delete pollingRef.current[docId];
      }
    }, 2000);
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploadingCount((n) => n + list.length);
    try {
      const form = new FormData();
      list.forEach((f) => form.append("files", f));
      const results = await apiPost<{ id: string; filename: string; status: string }[]>(
        "/api/documents/batch", form, true
      );
      const now = new Date().toISOString();
      const newDocs: Document[] = results.map((r, i) => ({
        id: r.id,
        filename: list[i].name,
        file_type: list[i].name.split(".").pop() ?? "",
        size_bytes: list[i].size,
        status: "pending",
        chunk_count: 0,
        created_at: now,
      }));
      setDocs((prev) => [...newDocs, ...prev]);
      newDocs.forEach((d) => startPolling(d.id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "未知錯誤";
      alert(`上傳失敗：${msg}`);
    } finally {
      setUploadingCount((n) => n - list.length);
    }
  }
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = "";
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  async function deleteDoc(docId: string) {
    if (!confirm("確定要刪除此文件？刪除後無法復原。")) return;
    await apiDelete(`/api/documents/${docId}`);
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    if (pollingRef.current[docId]) { clearInterval(pollingRef.current[docId]); delete pollingRef.current[docId]; }
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">知識庫管理</h1>
        <p className="text-sm text-slate-500 mt-1">上傳 FAQ 文件，系統自動建立向量索引供 AI 檢索。</p>
      </div>

      {/* Upload zone */}
      <div
        className="mb-6 rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer"
        style={{
          borderColor: dragging ? "#A6D8F5" : "#cbd5e1",
          background: dragging ? "#e8f4fc" : "white",
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl"
          style={{ background: dragging ? "#c8e8f8" : "#f1f5f9" }}>
          {uploadingCount > 0 ? "⏳" : "📁"}
        </div>
        <p className="font-semibold text-slate-700 mb-1">
          {uploadingCount > 0 ? `上傳中… (${uploadingCount} 個檔案)` : "拖曳檔案至此，或點擊選擇"}
        </p>
        <p className="text-sm text-slate-400">支援 PDF、CSV、Excel（xlsx/xls）、TXT，可一次選擇多個</p>
        <input ref={fileInputRef} type="file" accept=".pdf,.csv,.xlsx,.xls,.txt"
          className="hidden" onChange={onFileChange} multiple />
      </div>

      {/* Document list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">已上傳文件</h2>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">{docs.length} 份</span>
        </div>

        {docs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">📂</p>
            <p className="text-sm text-slate-400">尚未上傳任何文件</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <FileIcon type={doc.file_type} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate text-sm">{doc.filename}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatBytes(doc.size_bytes)}
                    {doc.status === "done" && <span className="text-slate-500"> · {doc.chunk_count} 個片段</span>}
                    {doc.error_message && <span className="text-red-500"> · {doc.error_message}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={doc.status} />
                  <button
                    onClick={() => deleteDoc(doc.id)}
                    disabled={doc.status === "processing"}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    刪除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
