# Deployment Rules & Known Pitfalls

## 一鍵重新部署

```powershell
cd deploy
.\redeploy.ps1
```

腳本會依序：build backend → push → deploy backend → build frontend → push → deploy frontend。

---

## 已知坑（每次部署都可能踩到）

### 1. gcloud 不在 PATH
gcloud 安裝位置不在系統 PATH，每次 PowerShell 執行前必須先加入：
```powershell
$env:PATH = "C:\Users\sha\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;$env:PATH"
```

### 2. `--set-env-vars` 特殊字元解析失敗
DATABASE_URL 含 `:` 和 `?`，在 PowerShell 傳給 gcloud 時會被誤解析，導致 exit code 2。
**解法：永遠用 `--env-vars-file deploy/backend-full-env.yaml`**，不要在命令列直接傳 env vars。

### 3. Docker push 需要 Artifact Registry 認證
```powershell
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
```
通常只需執行一次，但如果 docker config 被重置就要重跑。

### 4. DB Migration 需要 Cloud SQL Auth Proxy

**Proxy 不在 PATH，需手動下載（已下載到 `C:\tmp\cloud-sql-proxy.exe`）。**

啟動步驟：
```powershell
# port 5542 被 Windows/Hyper-V 保留，改用 15432
C:\tmp\cloud-sql-proxy.exe claude-code-faq-rag-260504:us-central1:faqrag-postgres --port=15432
```

Migration 指令（另開 terminal）：
```powershell
$env:DATABASE_URL = "postgresql+asyncpg://faqrag:XDa8ihpLZGrIqHn4sB3W@localhost:15432/faqrag"
cd backend
uv run alembic upgrade head
```

### 5. ADC（Application Default Credentials）未設定
Cloud SQL Proxy 啟動時若出現 `default credentials were not found`：

```powershell
# 建立 ADC 檔（從已登入的 gcloud 帳號轉換，只需做一次）
$adc = Get-Content "C:\Users\sha\AppData\Roaming\gcloud\legacy_credentials\sharinnayun0406@gmail.com\adc.json" | ConvertFrom-Json
$json = '{"client_id":"' + $adc.client_id + '","client_secret":"' + $adc.client_secret + '","refresh_token":"' + $adc.refresh_token + '","type":"authorized_user","universe_domain":"googleapis.com"}'
[System.IO.File]::WriteAllText("C:\Users\sha\AppData\Roaming\gcloud\application_default_credentials.json", $json, [System.Text.UTF8Encoding]::new($false))
```

> **注意：** 必須用 `.NET WriteAllText` 寫入，`Out-File -Encoding utf8` 會加 BOM 導致 proxy 解析失敗（`invalid character '簿'`）。

### 6. Windows 保留埠範圍
下列埠在此機器被 Windows/Hyper-V 保留，**無法使用**：
- 5432（PostgreSQL 預設） → 本機 DB 改用 **5830**
- 5542（之前嘗試的 proxy 埠）→ proxy 改用 **15432**

### 7. Frontend TypeScript Build 錯誤
`as const` 陣列若項目欄位不一致，TypeScript 會在 Docker build 時報型別錯誤。
**本機 lint 不一定能抓到**（因為 eslint 不等於 tsc），在 `docker build` 時才會噴。
先跑 `cd frontend && npm run build` 確認後再 build image。

---

## 部署架構

| 服務 | URL |
|------|-----|
| Frontend | `https://faqrag-frontend-953754688378.us-central1.run.app` |
| Backend  | `https://faqrag-backend-953754688378.us-central1.run.app` |
| Backend (舊 URL，仍有效) | `https://faqrag-backend-l5jxtxzjha-uc.a.run.app` |

- **Project ID:** `claude-code-faq-rag-260504`
- **Region:** `us-central1`
- **Artifact Registry:** `us-central1-docker.pkg.dev/claude-code-faq-rag-260504/faqrag`
- **Cloud SQL instance:** `claude-code-faq-rag-260504:us-central1:faqrag-postgres`
- **DB password:** `XDa8ihpLZGrIqHn4sB3W`

---

## 每次部署前 checklist

- [ ] `backend-full-env.yaml` 的 env 值有沒有需要更新？
- [ ] 有新的 Alembic migration 嗎？→ 部署後要跑 proxy + `alembic upgrade head`
- [ ] Frontend 有改 `NEXT_PUBLIC_*` env 嗎？→ 需要重 build image（build arg 寫死在 image 裡）
- [ ] `cd frontend && npm run build` 先在本機確認無 TypeScript 錯誤
