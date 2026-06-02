# Arbor GCP Deployment

## Current state

Arbor runs locally through `npm run dev` and builds with `npm run build`.

## Target state

- Express API runs on Cloud Run.
- React frontend runs on Firebase Hosting.
- Firebase Hosting rewrites `/api/*` to Cloud Run.

## Manual setup

1. Create or select a GCP project.
2. Enable Vertex AI, Cloud Run, Artifact Registry, Firebase Hosting, Firestore, Cloud Logging, Error Reporting, and Trace.
3. Create an `arbor-api` service account.
4. Grant least-privilege roles for Vertex AI user, Firestore user, logging writer, and Secret Manager secret accessor.
5. Deploy from `cloudbuild.yaml`.

`cloudbuild.yaml` builds from the repository root with `-f app/Dockerfile` so the server-only `knowledge/` corpus is available to the Cloud Run image. The Dockerfile copies `knowledge/` into `/app/knowledge` and sets `ARBOR_KNOWLEDGE_PATH=/app/knowledge`.

## M1 acceptance gates

- `app/Dockerfile` builds the API/frontend artifact.
- `/api/architecture/knowledge` reports a non-zero card count after deployment.
- `firebase.json` rewrites `/api/**` to Cloud Run.
- Stage/prod env vars select Vertex and Firestore.
