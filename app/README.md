# Arbor Private Beta App

This app is the hardened import of the AI Studio React/Gemini prototype. It lives under `app/` so the existing static prototype remains available in `prototype/`.

## What It Implements

- React/Vite parent workspace with behavior logs, milestones, action plans, stories, scholar lenses, handoff briefs, and safety screens.
- Express API with Gemini-backed endpoints.
- Structured AI output for the parent coach: risk level, age band, developmental domains, hypotheses, plan, script, observe, escalate, memory proposal, and handoff notes.
- Non-diagnostic safety contract on every generation endpoint.
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

## Verification

```bash
npm run lint
npm run eval:safety
```

`GEMINI_MODEL` defaults to `gemini-2.5-flash`, which the Gemini API model docs list as the stable Gemini 2.5 Flash model.
