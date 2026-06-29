# Arbor AI Pipeline

## Current state

Arbor screens obvious safety risks, calls an AI model, renders structured guidance, and proposes memory for parent review.

## Target state

```mermaid
flowchart TD
  Input[Parent concern] --> Safety[Deterministic safety pre-screen]
  Safety --> Memory[Approved child memory]
  Memory --> Wiki[Arbor AI Wiki source cards]
  Wiki --> Router[Model router]
  Router --> Generate[Structured generation]
  Generate --> Validate[Zod validation]
  Validate --> PostSafety[Safety and no-diagnosis checks]
  PostSafety --> Response[Parent response]
  Response --> Proposal[Memory proposal]
```

## Migration path

`/api/chat` now retrieves approved memory, AI Wiki source cards, calls the configured model route, and validates with Zod.

## M1 acceptance gates

- Invalid structured output fails safely.
- `sourceCardsUsed` is present in the coach contract.
- High-risk content bypasses generation and routes to escalation copy.
