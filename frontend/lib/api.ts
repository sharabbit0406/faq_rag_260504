import { auth } from "./firebase";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getAuthHeader(forceRefresh = false): Promise<Record<string, string>> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken(forceRefresh);
  return { Authorization: `Bearer ${token}` };
}

async function fetchWithAuth(input: string, init: RequestInit, retry = true): Promise<Response> {
  const headers = await getAuthHeader();
  const res = await fetch(input, { ...init, headers: { ...init.headers, ...headers } });
  if (res.status === 401 && retry) {
    // Token may be stale — force refresh and try once more
    const freshHeaders = await getAuthHeader(true);
    return fetch(input, { ...init, headers: { ...init.headers, ...freshHeaders } });
  }
  return res;
}

async function handleErrorResponse(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type");
  try {
    if (contentType?.includes("application/json")) {
      const json = await res.json();
      if (json.detail) return String(json.detail);
    }
  } catch { /* ignore parse errors */ }
  if (res.status === 500) return "伺服器錯誤，請稍後再試";
  if (res.status === 401) return "認證失敗，請重新登入";
  if (res.status === 403) return "無權限進行此操作";
  if (res.status === 404) return "找不到資源";
  if (res.status === 413) return "檔案過大，請確認檔案大小限制";
  return `請求失敗（${res.status}）`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(`${BASE_URL}${path}`, {});
  if (!res.ok) throw new Error(await handleErrorResponse(res));
  return res.json();
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers = await getAuthHeader();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers, // no Content-Type — let browser set multipart boundary
    body: formData,
  });
  if (!res.ok) throw new Error(await handleErrorResponse(res));
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown, multipart = false): Promise<T> {
  const baseHeaders: Record<string, string> = multipart
    ? {}
    : { "Content-Type": "application/json" };
  const bodyInit = multipart ? (body as FormData) : JSON.stringify(body);
  const res = await fetchWithAuth(`${BASE_URL}${path}`, {
    method: "POST",
    headers: baseHeaders,
    body: bodyInit,
  });
  if (!res.ok) throw new Error(await handleErrorResponse(res));
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetchWithAuth(`${BASE_URL}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await handleErrorResponse(res));
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithAuth(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await handleErrorResponse(res));
  return res.json();
}
