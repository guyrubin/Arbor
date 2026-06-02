# Arbor — Production Deployment Runbook (GCP)

Production Arbor runs as two pieces:

| Piece | Service | Serves |
| :--- | :--- | :--- |
| API | Cloud Run `arbor-api` (europe-west4) | Express server (`dist/server.cjs`) under `/api/**` |
| Client | Firebase Hosting | Built SPA from `app/dist`, rewrites `/api/**` → Cloud Run |

> The Cloud Run container only runs the API. The browser bundle is served by
> Firebase Hosting (`firebase.json` → `hosting.public: app/dist`).

---

## 0. Prerequisites (one-time)

- `gcloud` CLI installed and authenticated: `gcloud auth login`
- `firebase-tools` installed and authenticated: `firebase login`
- A production GCP project (`<PROD_PROJECT_ID>`) with billing enabled.
- Enabled APIs: Cloud Build, Cloud Run, Artifact Registry, Vertex AI, Firestore,
  Firebase Hosting.
- Artifact Registry repo `arbor` in the deploy region:
  `gcloud artifacts repositories create arbor --repository-format=docker --location=europe-west4`
- Firestore database provisioned (Native mode) and `firestore.rules` /
  `firestore.indexes.json` deployed.
- The Cloud Run runtime service account granted: `roles/datastore.user`,
  `roles/aiplatform.user`, and Firebase Auth admin (for `verifyIdToken`).

## 1. Configuration invariants (enforced by `app/src/config/env.ts`)

Production **refuses to boot** unless all of the following hold:

- `MODEL_PROVIDER=vertex`
- `MEMORY_ADAPTER=firestore`
- `ENABLE_LOCAL_MEMORY_ADAPTER=false`
- `GCP_PROJECT_ID` and `FIREBASE_PROJECT_ID` are both set

`cloudbuild.prod.yaml` sets all of these (project ids default to `$PROJECT_ID`)
plus `REQUIRE_AUTH=true`. On Cloud Run the Admin SDK verifies ID tokens using the
service account's Application Default Credentials, so no service-account key
secrets are required.

## 2. Deploy the API (Cloud Run)

```bash
gcloud builds submit \
  --config cloudbuild.prod.yaml \
  --substitutions=_REGION=europe-west4 \
  --project <PROD_PROJECT_ID>
```

Set the Gemini/Vertex and any extra secrets via Cloud Run (or Secret Manager) —
e.g. `GEMINI_API_KEY` is **not** used in prod (Vertex is the provider).

## 3. Build + deploy the client (Firebase Hosting)

The browser Firebase config is compiled into the bundle at build time, so the
`VITE_FIREBASE_*` vars **must be present when `npm run build` runs**:

```bash
cd app
VITE_HAS_GEMINI_API=true \
VITE_FIREBASE_API_KEY=... \
VITE_FIREBASE_AUTH_DOMAIN=<PROD_PROJECT_ID>.firebaseapp.com \
VITE_FIREBASE_PROJECT_ID=<PROD_PROJECT_ID> \
VITE_FIREBASE_STORAGE_BUCKET=<PROD_PROJECT_ID>.appspot.com \
VITE_FIREBASE_APP_ID=... \
  npm run build
cd ..
firebase deploy --only hosting,firestore --project <PROD_PROJECT_ID>
```

> If `VITE_FIREBASE_*` are omitted, the client runs in open **sandbox mode** (no
> login gate) — fine for demos, not for production.

## 4. Post-deploy verification

- `curl https://<hosting-domain>/api/health` (or the chat route) returns 200.
- Loading the site shows the **LoginScreen** (Firebase configured → auth-gated).
- A signed-in request to `/api/chat` succeeds; an unauthenticated one returns 401
  (because `REQUIRE_AUTH=true`).
- Firestore shows `/users/{uid}/children/...` after first sign-in.

## 5. Rollback

```bash
gcloud run services update-traffic arbor-api --to-revisions <PREV_REVISION>=100 \
  --region europe-west4 --project <PROD_PROJECT_ID>
firebase hosting:rollback --project <PROD_PROJECT_ID>
```
