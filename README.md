# Arbor / PPPPtherapy

Arbor is a private-beta parent support product for child-development concerns. The first release is intentionally narrow: help a parent turn one hard moment into a safe next step, a practical script, an approved child-memory update, a follow-up log, and a privacy-aware handoff summary.

## Current Artifacts

- `docs/arbor-prd.md` - product requirements, positioning, MVP scope, safety requirements, roadmap, and metrics.
- `docs/developmental-ai-operating-model.md` - source-grounded child-development framework and AI operating model.
- `mockups/arbor-platform-mockup.html` - static product mockup for the private-beta parent support loop.
- `prototype/arbor-private-beta-app.html` - interactive app prototype with intake, developmental routing, AI plan generation, memory approval, handoff, and eval screens.
- `app/` - imported AI Studio React/Gemini app, hardened behind a non-diagnostic developmental AI contract.

## Private Beta Loop

1. Parent intake
2. Safety triage
3. Same-day parent plan
4. Parent-approved child memory
5. Follow-up log
6. Teacher, professional, or co-parent handoff

## MVP Guardrails

- No diagnosis or treatment claims.
- No unsupervised child-facing AI in the MVP.
- Explicit escalation guidance on every AI response.
- Parent-controlled export and deletion of child data.
- Manual expert review for high-risk beta scenarios.

## Developmental AI Principles

- Every concern routes through child-development domains, age-band logic, safety triage, and a practical parent action.
- The AI response is generated as structured data first, then rendered into calm parent-facing guidance.
- Saved child memory contains parent-approved observations, not diagnostic labels.
- Prompt, model, and knowledge changes require targeted evals before release.

## React App

The production-direction prototype now lives in `app/`. It keeps the AI Studio implementation separate from the no-build static prototype while adding Arbor guardrails:

- `GEMINI_MODEL` defaults to `gemini-2.5-flash`.
- `/api/chat` returns structured coach data plus rendered parent guidance, including Six Frames routing.
- `app/src/framework.json` is the app source of truth for developmental domains, age bands, and Six Frames prompt construction.
- Every generation endpoint includes the non-diagnostic developmental AI contract.
- The app includes an append-only local memory review ledger under `.data/` for pending, approved, rejected, and deleted memory states.
- `npm run eval:safety` checks for stale model, over-clinical copy regressions, frame routing, and memory-review structure.

Run locally:

```bash
cd app
npm install
cp .env.example .env.local
npm run dev
```

## Prototype Design Principles

- Start on the usable app workspace, not a marketing landing page.
- Use the downloaded `Arbor-standalone.html` design language: warm paper, true ink, signal-orange clay, Delft blue, sage, rectilinear radii, hairline grids, mono labels, and editorial serif accents.
- Keep the product feeling like a daily field notebook: evidence-first, calm, precise, and parent-readable.
- Keep product actions concrete: generate plan, review memory, prepare handoff, and inspect eval gates.
- Treat the child-development framework as interaction design, not background copy.

## Two registers — Six Frames + operational layer

The product is described in two complementary vocabularies that map onto each other. The PRD's *Six Frames* are the philosophical register — what we are forming the child into and why. The operational layer above (domain / age band / parent intervention / memory field / safety rule / eval scenario) is the engineering register — how each capability is built and verified. Every feature should be expressible in both.

| Six Frames (philosophy) | Operational layer (engineering) |
|---|---|
| The Aim — articulated direction (Family Charter, Developmental Arc, Reckoning) | Domain + age band per response; AI output calibrated against parent-authored values |
| The Two Axes — restore the paternal half (Responsibility Ladder, Friction Scripts, Hard Thing) | Parent intervention field; safety rule that distinguishes age-appropriate stretch from over-load |
| The Story — meaning, ritual, transmission (Family Story Canon, Ritual Architecture, Truth Practice) | Memory field that captures parent-approved narrative; ritual templates in plan generation |
| The Shadow — let the dark in (Hard Conversations, Dark Emotions) | Safety rule that allows hard topics with structured scaffolding rather than deflecting |
| The Marriage — partner pair, repair (Partner Pair, Style Conflict, Rupture Repair) | Account model; conflict workflow; co-parent handoff fields |
| The Shepherd — one integrator (Family Shepherd, Family Council) | Professional handoff and consent contract; structured AI output fed to a human integrator |
