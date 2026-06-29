# Arbor M1 System Context

## Current state

The current private-beta app is a single Express service serving API routes and the built frontend.

## Target state

```mermaid
flowchart TD
  Browser[Arbor Browser Client] --> Hosting[Firebase Hosting]
  Hosting -->|/api rewrite| Run[Cloud Run Express API]
  Browser --> Auth[Firebase Auth]
  Run --> Vertex[Vertex AI]
  Run --> Firestore[Firestore]
  Run --> Wiki[Arbor AI Wiki in Git]
```

## Migration path

Keep Express as the orchestration unit. Add Firebase Auth middleware after anonymous onboarding is implemented.

## M1 acceptance gates

- Cloud Run health and API routes deploy as one service.
- Firebase Hosting rewrites `/api/*` to Cloud Run.
- No Cloud Functions rewrite for Arbor orchestration.
