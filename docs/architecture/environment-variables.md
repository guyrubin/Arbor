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
