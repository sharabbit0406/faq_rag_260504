# Frontend Rules

## Next.js Version Warning

This project uses **Next.js 16.2.4** which has breaking changes vs. earlier versions. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Do not assume APIs or file conventions match your training data.

## Directory Structure

- `app/(admin)/` — Merchant dashboard (protected routes, Firebase auth required)
- `app/chat/[tenantId]/` — Public chat widget (anonymous Firebase auth)
- `app/widget/[tenantId]/` — Embeddable chat widget variant

## Auth & API Client

- Auth state managed via `lib/auth-context.tsx` (React Context); JWT sent to backend as Bearer token
- `lib/api.ts` — HTTP client that auto-injects Firebase Bearer tokens; **always use this for all backend calls**

## UI Primitives

shadcn/ui components + Tailwind CSS 4 + React 19

## Chat Widget Handoff Modal (`app/chat/[tenantId]/page.tsx`)

When the user has existing messages and clicks「真人客服」:
1. A bottom-sheet modal opens (centered on screen, not anchored to bottom)
2. Calls `generate-summary` endpoint
3. Lets the user edit the summary
4. Either submits to backend or copies to clipboard

The input field remains enabled during AI loading so users can pre-type their next message.
