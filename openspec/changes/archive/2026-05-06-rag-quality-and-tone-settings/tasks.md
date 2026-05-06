## 1. backend/app/services/answerability.py

- [x] 1.1 移除 `partial` 判決類別，JUDGE_PROMPT 改為只有 yes / social / off_topic / no 四種
- [x] 1.2 加入「寧可放行」指令，`no` 只在 chunk 完全無關時使用
- [x] 1.3 未知 verdict 預設改為 `"yes"`（原為 `"no"`）

## 2. backend/app/services/pipeline.py

- [x] 2.1 拒答條件由 `verdict in ("no", "partial")` 改為 `verdict == "no"`
- [x] 2.2 從 `tenant_settings` 讀取 `ai_tone`、`ai_style_note`
- [x] 2.3 `generate_answer` 呼叫加入 `tone=ai_tone`、`style_note=ai_style_note` 參數

## 3. backend/app/services/llm.py

- [x] 3.1 `ANSWER_PROMPT` 加入 `{tone_instruction}` 變數
- [x] 3.2 `ANSWER_PROMPT` 加入 `{history_section}` 變數
- [x] 3.3 加入允許邏輯推論、語意等價推論規則（減少不必要拒答）
- [x] 3.4 `cannot_answer` 欄位加入 JSON schema，LLM 自報無法回答
- [x] 3.5 新增 `_TONE_PRESETS` dict（formal / friendly / lively）
- [x] 3.6 `generate_answer` 簽名加 `history`、`tone`、`style_note` 參數
- [x] 3.7 custom tone：`style_note` 直接當 `tone_instruction`
- [x] 3.8 style_note 注入格式改為 `【強制規則，必須嚴格遵守，不可忽略】：`

## 4. backend/app/services/transfer_detector.py

- [x] 4.1 改用繁體中文 prompt
- [x] 4.2 加入明確非轉接範例：「買錯了」、「我想退貨」、「我的訂單有問題」→ false
- [x] 4.3 明確只有「我要找人工」、「幫我轉客服」等才為 true

## 5. backend/app/routers/chat.py

- [x] 5.1 移除 `if detail_mode: return ...` 早返回，統一對話建立流程
- [x] 5.2 playground（detail_mode）現在也會建立 / 載入對話並傳歷史給 LLM
- [x] 5.3 找不到 `conversation_id` 改為靜默建立新對話（原為 raise 404）

## 6. backend/app/routers/auth.py

- [x] 6.1 `SettingsRequest` 加 `ai_tone: str | None`、`ai_style_note: str | None`
- [x] 6.2 `get_settings` 回傳 `ai_tone`（預設 "friendly"）、`ai_style_note`（預設 ""）
- [x] 6.3 `update_settings` 驗證 `ai_tone in ("formal", "friendly", "lively", "custom")`，並儲存兩欄位

## 7. frontend/app/(admin)/playground/page.tsx

- [x] 7.1 新增 `TONE_OPTIONS` 常數（formal / friendly / lively / custom）
- [x] 7.2 新增 aiTone、aiStyleNote、savedAiTone、savedAiStyleNote、aiStyleSaving、aiStyleSaved、aiStyleOpen state
- [x] 7.3 `useEffect` on tenant：呼叫 `apiGet("/api/auth/settings")` 載入語氣設定
- [x] 7.4 `saveAiStyle()` 呼叫 `apiPatch("/api/auth/settings", { ai_tone, ai_style_note })`
- [x] 7.5 AI 語氣面板：可收合（預設收合），展開顯示四個選項卡片 + custom textarea
- [x] 7.6 收合狀態顯示目前語氣 label 與 dirty 提示（● 未儲存）
- [x] 7.7 游標修正：`useEffect(() => { if (!loading) inputRef.current?.focus() }, [loading])`

## 8. frontend/app/(admin)/settings/page.tsx

- [x] 8.1 移除 AI 語氣設定整區（state、save 函式、JSX）
- [x] 8.2 新增 savedName、savedDialogue、savedSystem snapshot state
- [x] 8.3 新增 nameIsDirty、dialogueIsDirty、systemIsDirty 計算值
- [x] 8.4 各表單儲存成功後更新對應 saved snapshot
- [x] 8.5 三個表單各加 amber「● 有未儲存的變更」提示
