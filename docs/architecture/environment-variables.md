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

## Operations alerts and voice allowance (optional, default off)

| Variable | Purpose |
|---|---|
| `OPS_ALERT_OWNER` | B-AIOPS-03: the named human on every incident (`off` → "unassigned") |
| `OPS_ALERT_WEBHOOK_URL` | B-AIOPS-03 (secret): https webhook that receives each incident as `{ "text": … }`; `off` → structured log only |
| `AI_PREPAY_LEDGER` | B-AIOPS-03: JSON `{"credit","currency","since","perLiveMinute"}` for the readable AI Studio balance and its 20 % alarm; `off` → no balance |
| `LIVE_FREE_MINUTES_PER_DAY` / `LIVE_PAID_MINUTES_PER_DAY` | B-AIOPS-02: family daily voice allowance (defaults 3 / 20) |
| `LIVE_RESERVATION_MINUTES` | B-AIOPS-02: Live token slice, capped at 5 |
| `LIVE_RECONCILE_CREDIT` | B-AIOPS-02: `observed` opts into expiry credit; default charges the full slice |

Runbook: `docs/ops/incident-alerts.md`.

## M1 acceptance gates

- `ARBOR_ENV=prod` rejects local memory.
- `ARBOR_ENV=prod` rejects non-Vertex model provider.
- Local dev mode remains explicit.
