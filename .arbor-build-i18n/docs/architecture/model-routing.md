# Arbor Model Routing

## Current state

Local development can use the Gemini developer API.

## Target state

Production Arbor uses Vertex AI through the Arbor model router. `coach_high_stakes` routes to Claude on Vertex by default; lower-risk structured and creative routes use Gemini on Vertex.

| Arbor endpoint | Route | Default target |
|---|---|---|
| `/api/chat` | `coach_high_stakes` | `VERTEX_MODEL_CHAT`, default `claude-3-5-sonnet@anthropic` via `ClaudeVertexProvider` |
| `/api/generate-story` | `creative_low_risk` | `VERTEX_MODEL_STORY`, default Gemini Flash |
| `/api/analyze-behavior` | `analysis_structured` | `VERTEX_MODEL_ANALYSIS`, default Gemini |
| `/api/generate-handoff` | `handoff_structured` | `VERTEX_MODEL_HANDOFF`, default Gemini |

## Migration path

Keep `GeminiDevProvider` for local development. Set `MODEL_PROVIDER=vertex` in stage/prod.

Claude on Vertex uses the Anthropic publisher `rawPredict` endpoint, `anthropic_version: "vertex-2023-10-16"`, and tool-use structured output. Gemini routes use the Vertex generative model SDK.

## M1 acceptance gates

- Endpoint code does not instantiate model clients directly.
- Route-level model and temperature choices are centralized.
- Production config fails if Vertex is not selected.
