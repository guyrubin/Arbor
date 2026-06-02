# ADR 0004: Model Routing With Claude Primary

## Status

Accepted.

## Context

Issue #6 separates Arbor’s model choice from endpoint logic. Different routes have different risk, cost, and quality needs. `/api/chat` is high-stakes parent guidance and requires the most nuanced safety behavior. Story, analysis, and handoff routes can use cheaper structured models when appropriate.

## Decision

Arbor uses a router abstraction for all model calls. The primary target for `/api/chat` is Claude via Vertex Model Garden when available and approved. Gemini fallback remains configured. Story generation uses Gemini 2.5 Flash. Behavior analysis and handoff generation use Gemini 2.5 Pro/Flash or the best-cost structured model behind the same router.

Endpoint code must not instantiate model clients directly.

## Consequences

Model choice becomes configuration, not application logic. Arbor can A/B test prompts and providers by route. Safety evals must cover route-specific behavior, especially no-diagnosis and escalation behavior for `/api/chat`.

## Alternatives

Gemini-only routing was rejected because GCP does not mean single-model lock-in. Per-endpoint direct SDK usage was rejected because it blocks audit, testing, and provider swaps.
