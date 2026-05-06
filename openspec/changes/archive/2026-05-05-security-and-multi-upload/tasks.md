## 1. frontend/lib/api.ts

- [x] 1.1 新增 handleErrorResponse(res) helper，依 status code 回傳友善訊息
- [x] 1.2 apiGet / apiPost / apiDelete / apiPatch 改用 handleErrorResponse

## 2. backend/app/services/llm.py

- [x] 2.1 加 import logging / logger
- [x] 2.2 generate_answer 包整個函式在 try/except，處理空 raw 與 LLM 例外

## 3. backend/app/routers/documents.py

- [x] 3.1 加 MAX_FILE_SIZE = 200MB 常數
- [x] 3.2 upload_document 在 read() 後驗證大小，超限回 413
- [x] 3.3 新增 POST /batch endpoint，接受 list[UploadFile]

## 4. frontend/lib/auth-context.tsx

- [x] 4.1 import FirebaseError from 'firebase/app'
- [x] 4.2 signup() 兩個 catch 區塊改用正確型別
