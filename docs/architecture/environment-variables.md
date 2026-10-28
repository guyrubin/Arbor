# Arbor Environment Variables

## Current state

Local development reads `.env` through `dotenv`.

## Target state

Production config is explicit and fail-closed.

## Required variables

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Node runtime mode |
| `ARBOR_ENV` | `local`, `dev`, `stage`, or `prod` |
| `GCP_PROJECT_ID` | GCP project for Vertex and Cloud Run |
| `GCP_REGION` | Default GCP region |
| `VERTEX_LOCATION` | Vertex AI location |
| `VERTEX_MODEL_CHAT` | Coach route model |
| `VERTEX_MODEL_STORY` | Story route model |
| `VERTEX_MODEL_ANALYSIS` | Analysis route model |
| `FIREBASE_PROJECT_ID` | Firebase project |
| `FIRESTORE_DATABASE_ID` | Firestore database id |
| `ENABLE_LOCAL_MEMORY_ADAPTER` | Local JSON adapter guard |
| `ENABLE_HIGH_RISK_REVIEW_QUEUE` | High-risk review feature flag |

## M1 acceptance gates

- `ARBOR_ENV=prod` rejects local memory.
- `ARBOR_ENV=prod` rejects non-Vertex model provider.
- Local dev mode remains explicit.

## Live voice residency exception (B-GA-06, 28 Oct 2026)

`LIVE_GLOBAL_EXCEPTION_UNTIL` (alias `LIVE_RESIDENCY_EXCEPTION_UNTIL`) is the last day, inclusive and in UTC, on which production may mint Live voice tokens on Google's global endpoint. Every other AI route stays EU-only in production.

- **Scope.** Decision G-V1 (Guy, 8 Oct 2026): production is the Israel-only pilot, so the exception runs to Gate A. It widens only the parent realtime-audio route (`app/src/ai/liveResidency.ts`). A child-audience request is never served by the global path. Any non-Israel market needs the EU path first (B-AIOPS-05).
- **Expiry.** 2027-03-31. The code default (`LIVE_GLOBAL_EXCEPTION_UNTIL` in `app/src/ai/liveResidency.ts`), the screen's fallback (`app/src/lib/liveResidency.ts`) and the production env value are the same day. Before 28 Oct the code default was still 2026-10-31.
- **Fallback.** From 2027-04-01 00:00 UTC, `decideLive` answers `policy_denied`, `/live/availability` reports unavailable, `/live/token` answers 503, and the browser keeps the EU speech-to-text → text → speech loop. The data-use panel stops printing a date. Setting `off`, an empty value or a malformed date removes the exception at once (fail closed). Turning on `LIVE_VERTEX_EU` puts the EU path first, and it remains available after the expiry.
- **Evidence.** `app/src/ai/liveResidency.test.ts` covers the shared day, the last instant, the first instant after it, the scope and the fail-closed values, and checks the prod env value against the code default. `app/src/routes/liveToken.policy.test.ts` runs the same rules through the real router.
