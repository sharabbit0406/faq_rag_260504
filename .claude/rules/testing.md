# Testing Rules

## Test Commands

| Task | Command |
|------|---------|
| Backend unit tests | `cd backend && uv run pytest` |
| Run single test | `cd backend && uv run pytest path/to/test.py::test_name -v` |
| E2E tests (Playwright) | `python test_webapp.py` (from repo root) |
| Frontend lint | `cd frontend && npm run lint` |
| Frontend build | `cd frontend && npm run build` |

## E2E Test Files (repo root)

Root-level Playwright tests drive a real browser against the running stack:

- `test_webapp.py` — comprehensive end-to-end scenarios (1000+ lines)
- `test_full_flow.py` — complete merchant + end-user journey
- `test_playground.py` — playground-specific flows

These require all three services running (Docker + backend + frontend).

## On Test Failures

When tests fail after a code change, read the error log and fix the root cause before reporting back. Do not report success until tests pass.
