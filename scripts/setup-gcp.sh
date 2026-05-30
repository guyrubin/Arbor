#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Arbor — GCP First-Time Setup Script
# Run once to bootstrap the project before Terraform takes over.
# Usage:
#   chmod +x scripts/setup-gcp.sh
#   ./scripts/setup-gcp.sh
#
# Prerequisites:
#   - gcloud CLI installed and authenticated  (gcloud auth login)
#   - firebase CLI installed                  (npm i -g firebase-tools)
#   - Billing account ready in GCP Console
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── CONFIG — edit these before running ───────────────────────────────────────
PROJECT_ID="${ARBOR_PROJECT_ID:-arbor-prod-$(head -c4 /dev/urandom | xxd -p)}"
BILLING_ACCOUNT="${ARBOR_BILLING_ACCOUNT:?Set ARBOR_BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX}"
REGION="${ARBOR_REGION:-europe-west4}"
ARBOR_ENV="${ARBOR_ENV:-prod}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           Arbor GCP Bootstrap — Private Beta                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Project ID     : $PROJECT_ID"
echo "  Billing Account: $BILLING_ACCOUNT"
echo "  Region         : $REGION"
echo "  Arbor Env      : $ARBOR_ENV"
echo ""
read -p "  Press Enter to continue or Ctrl-C to abort..."

# ── 1. Create the GCP project ─────────────────────────────────────────────────
echo ""
echo "[1/9] Creating GCP project..."
gcloud projects create "$PROJECT_ID" --name="Arbor Parenting Platform" || echo "  (project already exists, continuing)"
gcloud config set project "$PROJECT_ID"

# ── 2. Link billing ───────────────────────────────────────────────────────────
echo ""
echo "[2/9] Linking billing account..."
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"

# ── 3. Enable APIs ────────────────────────────────────────────────────────────
echo ""
echo "[3/9] Enabling required GCP APIs (this takes ~90 seconds)..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  firebasehosting.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  identitytoolkit.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com

# ── 4. Artifact Registry ──────────────────────────────────────────────────────
echo ""
echo "[4/9] Creating Artifact Registry repository..."
gcloud artifacts repositories create arbor \
  --repository-format=docker \
  --location="$REGION" \
  --description="Arbor Docker images" || echo "  (already exists)"

# ── 5. Cloud Run service account ─────────────────────────────────────────────
echo ""
echo "[5/9] Creating Cloud Run service account..."
SA_EMAIL="arbor-cloudrun@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts create arbor-cloudrun \
  --display-name="Arbor Cloud Run SA" \
  --project="$PROJECT_ID" || echo "  (already exists)"

# Grant required roles
for ROLE in \
  roles/aiplatform.user \
  roles/datastore.user \
  roles/storage.objectAdmin \
  roles/secretmanager.secretAccessor \
  roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" --quiet
done

# ── 6. Cloud Storage export bucket ───────────────────────────────────────────
echo ""
echo "[6/9] Creating Cloud Storage export bucket..."
BUCKET="${PROJECT_ID}-arbor-exports"
gcloud storage buckets create "gs://${BUCKET}" \
  --location="$REGION" \
  --uniform-bucket-level-access \
  --project="$PROJECT_ID" || echo "  (already exists)"

# 90-day auto-delete lifecycle policy
cat > /tmp/lifecycle.json << 'EOF'
{"rule":[{"action":{"type":"Delete"},"condition":{"age":90}}]}
EOF
gcloud storage buckets update "gs://${BUCKET}" --lifecycle-file=/tmp/lifecycle.json

# ── 7. Firestore (Native mode) ───────────────────────────────────────────────
echo ""
echo "[7/9] Creating Firestore database (Native mode)..."
gcloud firestore databases create \
  --location="$REGION" \
  --project="$PROJECT_ID" || echo "  (already exists)"

# ── 8. Firebase project setup ─────────────────────────────────────────────────
echo ""
echo "[8/9] Initialising Firebase project..."
firebase use --add || firebase projects:addfirebase "$PROJECT_ID" || echo "  (Firebase may already be set up)"
echo ""
echo "  ⚠  Firebase Auth requires manual steps in the Firebase Console:"
echo "     1. Go to https://console.firebase.google.com/project/${PROJECT_ID}/authentication"
echo "     2. Click 'Get started' → Enable 'Google' and 'Email/Password' providers"
echo "     3. Copy the Web App config (apiKey, authDomain, appId) for .env.local / Cloud Run"
echo ""

# ── 9. Cloud Build permissions ───────────────────────────────────────────────
echo ""
echo "[9/9] Granting Cloud Build deploy permissions..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

for ROLE in roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${CB_SA}" \
    --role="$ROLE" --quiet
done

# ── Connect GitHub repo to Cloud Build ───────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Bootstrap complete! Next steps:"
echo ""
echo "  1. Connect GitHub repo to Cloud Build:"
echo "     https://console.cloud.google.com/cloud-build/triggers?project=${PROJECT_ID}"
echo "     → Connect Repository → guyrubin/PPPPtherapy- → Create Trigger"
echo "     → Branch: main | Config: cloudbuild.yaml"
echo "     → Substitutions: _REGION=$REGION, _ARBOR_ENV=$ARBOR_ENV"
echo "     → Add env vars: GCP_PROJECT_ID=$PROJECT_ID, FIREBASE_PROJECT_ID=$PROJECT_ID"
echo "     → GCS_BUCKET_NAME=${BUCKET}"
echo ""
echo "  2. Add Firebase client config to app/.env.local:"
echo "     VITE_FIREBASE_API_KEY=<from Firebase Console>"
echo "     VITE_FIREBASE_AUTH_DOMAIN=${PROJECT_ID}.firebaseapp.com"
echo "     VITE_FIREBASE_PROJECT_ID=${PROJECT_ID}"
echo "     VITE_FIREBASE_APP_ID=<from Firebase Console>"
echo ""
echo "  3. Deploy:"
echo "     Push to main → Cloud Build triggers automatically"
echo "     OR manually: cd app && npm run build && docker build..."
echo ""
echo "  Cloud Run URL will be:"
echo "     https://arbor-api-<hash>-ew.a.run.app"
echo "     (also visible at: gcloud run services describe arbor-api --region $REGION)"
echo "═══════════════════════════════════════════════════════════════"
