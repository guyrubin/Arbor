# Arbor Model Routing

## Current state

Local development can use the Gemini developer API.

## Target state

Production Arbor uses Vertex AI through `VertexModelProvider`.

| Arbor endpoint | Route | Default target |
|---|---|---|
| `/api/chat` | `coach_high_stakes` | `VERTEX_MODEL_CHAT` |
| `/api/generate-story` | `creative_low_risk` | `VERTEX_MODEL_STORY` |
| `/api/analyze-behavior` | `analysis_structured` | `VERTEX_MODEL_ANALYSIS` |
| `/api/generate-handoff` | `handoff_structured` | `VERTEX_MODEL_HANDOFF` |

## Migration path

Keep `GeminiDevProvider` for local development. Set `MODEL_PROVIDER=vertex` in stage/prod.

## M1 acceptance gates

- Endpoint code does not instantiate model clients directly.
- Route-level model and temperature choices are centralized.
- Production config fails if Vertex is not selected.
