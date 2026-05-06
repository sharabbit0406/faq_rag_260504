## Why

四個安全與品質問題：API 錯誤訊息洩露後端細節、LLM 回應失敗無 fallback、檔案上傳無大小限制（OOM 風險）、TypeScript `any` 型別失去保護。同時補齊後端 batch 上傳 endpoint。

## What Changes

- `frontend/lib/api.ts`：錯誤訊息統一轉換，不直接回傳原始 HTTP body
- `backend/app/services/llm.py`：`generate_answer` 加雙層保護，處理 LLM API 失敗與空回應
- `backend/app/routers/documents.py`：200MB 檔案大小上限，新增 `POST /batch` 支援多檔一次上傳
- `frontend/lib/auth-context.tsx`：`err: any` 改為 `FirebaseError` 型別

## Impact

- `frontend/lib/api.ts`：加 handleErrorResponse helper，更新 4 個函式
- `backend/app/services/llm.py`：generate_answer 加 try/except
- `backend/app/routers/documents.py`：加 MAX_FILE_SIZE 常數、size 驗證、/batch endpoint
- `frontend/lib/auth-context.tsx`：import FirebaseError，修 2 個 catch 區塊
