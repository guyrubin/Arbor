# Arbor Private Beta App

This app is the hardened import of the AI Studio React/Gemini prototype. It lives under `app/` so the existing static prototype remains available in `prototype/`.

## What It Implements

- React/Vite parent workspace with behavior logs, milestones, action plans, stories, scholar lenses, handoff briefs, and safety screens.
- Express API with Gemini-backed endpoints.
- Structured AI output for the parent coach: risk level, age band, developmental domains, hypotheses, plan, script, observe, escalate, memory proposal, and handoff notes.
- Six Frames routing in the coach contract: Aim, Two Axes, Story, Shadow, Marriage, and Shepherd.
- Append-only local memory review ledger with pending, approved, rejected, and deleted states.
- `src/framework.json` as the single source of truth for domains, age bands, and Six Frames prompt construction.
- Non-diagnostic safety contract on every generation endpoint.
- Streaming `/api/chat` transport with server-sent events and client-side cancellation for the live parent coach.
- Express hardening with `helmet`, CORS allow-listing, 250kb JSON bodies, and 30 requests/min/IP rate limiting.
- Arbor design-token skin based on the standalone field-notebook direction.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
cp .env.example .env.local
```

3. Set `GEMINI_API_KEY` in `.env.local`.

4. Run the app:

```bash
npm run dev
```

The default local URL is `http://localhost:3000`.

Optional runtime variables:

- `GEMINI_MODEL`: defaults to `gemini-2.5-flash`.
- `CORS_ORIGINS`: comma-separated browser origins allowed to call the API. Defaults to `http://localhost:3000,http://127.0.0.1:3000`.
- `PORT`: defaults to `3000`.

## Memory Review

Generated memory proposals are written to `.data/memory-ledger.json` as pending review items. This file is ignored by Git. The UI shows a parent approval queue, and the server exposes:

- `GET /api/memory/:childId`
- `PATCH /api/memory/:memoryId`

Only approved items should be treated as active child memory.

## Verification

```bash
npm run lint
npm run check:framework
npm run eval:safety
npm run build
```

`GEMINI_MODEL` defaults to `gemini-2.5-flash`, which the Gemini API model docs list as the stable Gemini 2.5 Flash model.
