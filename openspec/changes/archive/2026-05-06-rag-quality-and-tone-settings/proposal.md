## Why

五個功能/品質問題需解決：RAG 系統過度拒答（answerability judge 太保守）、AI 回應像機器人逐字複製片段、多輪對話無記憶（playground history 被硬碼為空）、轉人工偵測誤判（「我買錯了」被誤判為轉接請求）、商家無法自訂 AI 語氣風格。

## What Changes

- `backend/app/services/answerability.py`：移除 `partial` 判決，未知結果改預設 `yes`，加「寧可放行」指令，只在 chunk 完全無關時才拒答
- `backend/app/services/pipeline.py`：拒答條件改為僅 `no`（移除 `partial`）；將 `ai_tone`、`ai_style_note` 從 tenant settings 讀出並傳入 LLM
- `backend/app/services/llm.py`：ANSWER_PROMPT 加入語氣指令、對話歷史、允許邏輯推論規則（199元免運→200元可推論免運）；語氣預設三種（formal/friendly/lively）；style_note 以強制規則格式注入
- `backend/app/services/transfer_detector.py`：改用繁體中文 prompt，加明確非轉接範例（「買錯了」、「我想退貨」）
- `backend/app/routers/chat.py`：移除 detail_mode 早返回，統一對話流程使 playground 也有對話歷史；找不到 conversation 改為建立新的，不再回 404
- `backend/app/routers/auth.py`：`SettingsRequest` 加 `ai_tone`、`ai_style_note` 欄位；GET `/settings` 回傳這兩個欄位；PATCH 驗證並儲存
- `frontend/app/(admin)/playground/page.tsx`：新增可收合 AI 語氣面板（formal/friendly/lively/其他四選一 + 補充說明 textarea）；dirty 狀態提示；送出後游標自動回到輸入框
- `frontend/app/(admin)/settings/page.tsx`：移除 AI 語氣設定區塊（搬到 playground）；三個表單分別加 dirty 狀態提示

## Impact

- `backend/app/services/answerability.py`：JUDGE_PROMPT 改寫，verdict 由 5 個減為 4 個，default fallback 由 `no` 改 `yes`
- `backend/app/services/pipeline.py`：拒答條件縮窄，`generate_answer` 呼叫加 `tone` / `style_note` 參數
- `backend/app/services/llm.py`：`ANSWER_PROMPT` 新增 tone_instruction / history_section 變數；`_TONE_PRESETS` dict；`generate_answer` 簽名新增 `history`、`tone`、`style_note` 參數
- `backend/app/services/transfer_detector.py`：prompt 全面改寫
- `backend/app/routers/chat.py`：移除 detail_mode 早返回分支；conversation 找不到改建新的
- `backend/app/routers/auth.py`：SettingsRequest + get_settings + update_settings 各加兩個欄位
- `frontend/app/(admin)/playground/page.tsx`：加 8 個新 state、1 個 useEffect（settings 載入）、1 個 useEffect（游標 focus）、saveAiStyle 函式、AI 語氣面板 JSX
- `frontend/app/(admin)/settings/page.tsx`：加 savedName / savedDialogue / savedSystem snapshot state、三個 isDirty 計算值、三處 amber 提示 JSX
