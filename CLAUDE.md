# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-tenant FAQ RAG SaaS. Merchants upload documents → AI answers end-user questions via a chat widget.  
Stack: FastAPI (Python 3.11+) + Next.js 16.2.4 + PostgreSQL + Qdrant + Vertex AI (Gemini 2.5 Flash).

## Detailed Rules by Area

- **Backend architecture, RAG pipeline, DB models, handoff flow:** read `.claude/rules/backend.md`
- **Frontend structure, Next.js notes, chat widget:** read `.claude/rules/frontend.md`
- **Infrastructure, env vars, Docker ports:** read `.claude/rules/infrastructure.md`
- **Testing conventions and commands:** read `.claude/rules/testing.md`

## Starting the Dev Environment

Run all three in separate terminals:

```powershell
# Terminal 1 — databases
docker compose up -d

# Terminal 2 — backend (wait for "Application startup complete.")
cd backend
uv run uvicorn app.main:app --reload --port 8000

# Terminal 3 — frontend (wait for "Ready in ...ms", then http://localhost:3000)
cd frontend
npm run dev
```

To clear Python cache before starting backend:
```powershell
Get-ChildItem -Recurse -Filter "__pycache__" | Remove-Item -Recurse -Force
```

## Git 工作流程規範

每完成一個有意義的功能、修復或變更後，**必須** 執行 commit + push，確保進度不遺失：

```powershell
git add <相關檔案>
git commit -m "type: 清晰描述做了什麼及為什麼"
git push
```

**提交訊息格式：** `type: 簡短描述`（type 可為 `feat` / `fix` / `docs` / `refactor` / `test` / `chore`）

- 每次對話結束前若有未提交的變更，主動提醒使用者提交
- 不可使用模糊訊息（如 `update`、`fix bug`）；須說明**改了什麼**、**為什麼改**
- Push 到 GitHub 後確認遠端已更新

## Common Commands

| Task | Command |
|------|---------|
| Frontend lint | `cd frontend && npm run lint` |
| Frontend build | `cd frontend && npm run build` |
| Backend tests | `cd backend && uv run pytest` |
| Run single test | `cd backend && uv run pytest path/to/test.py::test_name -v` |
| DB migrations (generate) | `cd backend && uv run alembic revision --autogenerate -m "description"` |
| DB migrations (apply) | `cd backend && uv run alembic upgrade head` |
| E2E tests (Playwright) | `python test_webapp.py` (from repo root) |
