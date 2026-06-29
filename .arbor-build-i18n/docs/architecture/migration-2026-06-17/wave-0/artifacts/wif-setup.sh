#!/usr/bin/env bash
#
# SEC-4 — Workload Identity Federation (WIF) cutover for the Arbor deploy workflow.
#
# Provisions the GitHub-OIDC Workload Identity Pool + Provider, creates/least-privileges
# the deploy service account, binds the GitHub repo as a WIF principal, and sets the two
# repository VARIABLES the already-scaffolded `.github/workflows/arbor-deploy.yml` reads
# (GCP_WIF_PROVIDER + GCP_DEPLOY_SA). The long-lived GCP_SA_KEY is kept as a fallback
# until a WIF deploy is proven green; the LAST section then removes it.
#
# *** THIS SCRIPT IS NOT EXECUTED BY THE MIGRATION AGENT. ***
# A human runs it (or a later clean-baseline run) after reviewing the variables below.
# It is idempotent where the gcloud API allows (create steps tolerate "already exists").
#
# Pre-reqs on the operator's machine:
#   - gcloud >= 470 authenticated as a project Owner / IAM admin:  gcloud auth login
#   - gh (GitHub CLI) authenticated with repo admin on the Arbor repo:  gh auth login
#   - The deploy workflow already merged to main (it is; lines 64-80 are the WIF path).
#
# References (read before running):
#   - .github/workflows/arbor-deploy.yml  (lines 64-80: the conditional WIF auth path)
#   - cloudbuild.prod.yaml                (the build/Run/Hosting/Firestore deploy this SA must perform)
#   - docs/architecture/migration-2026-06-17/wave-0/security/wif-setup-runbook.md
#
set -euo pipefail

# ---------------------------------------------------------------------------
# 0. EDIT THESE — the only operator-supplied values.
# ---------------------------------------------------------------------------
PROJECT_ID="${PROJECT_ID:-arborprd-westeu}"        # GCP prod project (matches secrets.GCP_PROJECT_ID)
GITHUB_REPO="${GITHUB_REPO:-rubin/PPPPtherapy-}"   # owner/repo of the Arbor repository (set to the real slug)
GITHUB_DEFAULT_BRANCH="${GITHUB_DEFAULT_BRANCH:-main}"

# Stable resource names (safe defaults; match the example in arbor-deploy.yml line 5).
POOL_ID="github"
PROVIDER_ID="arbor"
SA_NAME="arbor-deployer"
REGION="${REGION:-europe-west4}"

# Derived — do not edit.
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
POOL_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}"
PROVIDER_RESOURCE="${POOL_RESOURCE}/providers/${PROVIDER_ID}"
# This is the exact value that goes into repo var GCP_WIF_PROVIDER.
WIF_PROVIDER_VAR="${PROVIDER_RESOURCE}"
# The IAM principalSet that maps "any workflow run from GITHUB_REPO" to the WIF identity.
WIF_PRINCIPAL="principalSet://iam.googleapis.com/${POOL_RESOURCE}/attribute.repository/${GITHUB_REPO}"

echo "== SEC-4 WIF setup =="
echo "  project       : ${PROJECT_ID} (number ${PROJECT_NUMBER})"
echo "  github repo   : ${GITHUB_REPO} (branch ${GITHUB_DEFAULT_BRANCH})"
echo "  deploy SA     : ${SA_EMAIL}"
echo "  provider var  : ${WIF_PROVIDER_VAR}"
echo

# ---------------------------------------------------------------------------
# 1. Enable required APIs (idempotent).
# ---------------------------------------------------------------------------
gcloud services enable \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  iam.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  firebasehosting.googleapis.com \
  firestore.googleapis.com \
  firebaserules.googleapis.com \
  --project "${PROJECT_ID}"

# ---------------------------------------------------------------------------
# 2. Create the Workload Identity Pool (idempotent).
# ---------------------------------------------------------------------------
if ! gcloud iam workload-identity-pools describe "${POOL_ID}" \
      --project "${PROJECT_ID}" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "${POOL_ID}" \
    --project "${PROJECT_ID}" \
    --location=global \
    --display-name="GitHub Actions" \
    --description="OIDC federation for GitHub Actions deploys"
else
  echo "Pool ${POOL_ID} already exists — skipping create."
fi

# ---------------------------------------------------------------------------
# 3. Create the OIDC Provider for GitHub, locked to THIS repository.
#    - issuer-uri pins token.actions.githubusercontent.com.
#    - attribute-mapping exposes repository + ref for least-privilege binding.
#    - attribute-condition REFUSES any token not from GITHUB_REPO (defence in depth:
#      even if the principalSet were mis-scoped, the provider rejects other repos).
# ---------------------------------------------------------------------------
if ! gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
      --project "${PROJECT_ID}" --location=global \
      --workload-identity-pool="${POOL_ID}" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
    --project "${PROJECT_ID}" \
    --location=global \
    --workload-identity-pool="${POOL_ID}" \
    --display-name="Arbor GitHub deploy" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == '${GITHUB_REPO}'"
else
  echo "Provider ${PROVIDER_ID} already exists — skipping create."
  echo "  (To change the attribute-condition later: gcloud ... providers update-oidc ${PROVIDER_ID} --attribute-condition=...)"
fi

# ---------------------------------------------------------------------------
# 4. Create / confirm the deploy service account.
# ---------------------------------------------------------------------------
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --project "${PROJECT_ID}" \
    --display-name="Arbor CI deployer (WIF)"
else
  echo "Service account ${SA_EMAIL} already exists — skipping create."
fi

# ---------------------------------------------------------------------------
# 5. Bind the GitHub repo (WIF principalSet) to the deploy SA so the workflow
#    can impersonate it. Scoped to attribute.repository == GITHUB_REPO.
#
#    Tighter option (recommended once proven): restrict to the main branch only by
#    swapping WIF_PRINCIPAL for the ref-scoped principalSet below. The deploy job only
#    runs on push to main / workflow_dispatch, so this is safe:
#      WIF_PRINCIPAL_MAIN="principalSet://iam.googleapis.com/${POOL_RESOURCE}/attribute.ref/refs/heads/${GITHUB_DEFAULT_BRANCH}"
#    Note: ref-scoping blocks workflow_dispatch from non-main refs. Keep repo-scoped if
#    you ever dispatch from a tag/branch.
# ---------------------------------------------------------------------------
gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --project "${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="${WIF_PRINCIPAL}"

# ---------------------------------------------------------------------------
# 6. LEAST-PRIVILEGE roles for the deploy SA. NO Owner / Editor / Firebase Admin /
#    Datastore Owner. Each role maps to one concrete step in arbor-deploy.yml /
#    cloudbuild.prod.yaml:
#
#    roles/cloudbuild.builds.editor   submit `gcloud builds submit` (step "Deploy API")
#    roles/run.admin                  `gcloud run deploy arbor-api` (cloudbuild step)
#    roles/artifactregistry.writer    push arbor-api image to the arbor repo (Docker push step)
#    roles/iam.serviceAccountUser     actAs the Cloud Build SA AND the Cloud Run runtime SA
#                                     (deploy must set/keep the run service identity)
#    roles/firebasehosting.admin      `firebase deploy --only hosting`
#    roles/firebaserules.admin        `firebase deploy --only firestore` (rules release)
#    roles/datastore.indexAdmin       firestore index deploy (firestore.indexes.json)
#    roles/serviceusage.serviceUsageConsumer  required for Firebase CLI / builds API calls
#
#    Deliberately EXCLUDED vs. the old key's grant (arbor-deploy.yml lines 11-13):
#      - Firebase Admin   (over-broad; hosting+rules admin suffice)
#      - Datastore Owner  (the deploy never reads/writes app data; index admin suffices)
# ---------------------------------------------------------------------------
DEPLOY_ROLES=(
  "roles/cloudbuild.builds.editor"
  "roles/run.admin"
  "roles/artifactregistry.writer"
  "roles/iam.serviceAccountUser"
  "roles/firebasehosting.admin"
  "roles/firebaserules.admin"
  "roles/datastore.indexAdmin"
  "roles/serviceusage.serviceUsageConsumer"
)
for role in "${DEPLOY_ROLES[@]}"; do
  echo "  granting ${role} to ${SA_EMAIL}"
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${role}" \
    --condition=None \
    >/dev/null
done

# Tighten actAs: the deploy SA must be able to actAs the Cloud Run RUNTIME SA and the
# Cloud Build SA specifically. roles/iam.serviceAccountUser above is project-wide; if you
# want to scope it down, REMOVE the project-level grant and instead bind per target SA:
#   RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"   # default Cloud Run runtime SA
#   CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
#   for target in "${RUNTIME_SA}" "${CLOUDBUILD_SA}"; do
#     gcloud iam service-accounts add-iam-policy-binding "${target}" \
#       --project "${PROJECT_ID}" \
#       --member="serviceAccount:${SA_EMAIL}" \
#       --role="roles/iam.serviceAccountUser"
#   done
# (Left as project-level by default for first-cutover simplicity; scope down post-green.)

# ---------------------------------------------------------------------------
# 7. Set the repository VARIABLES the workflow reads (NOT secrets — these are
#    non-sensitive resource identifiers). The presence of GCP_WIF_PROVIDER is the
#    switch: `if: vars.GCP_WIF_PROVIDER != ''` (arbor-deploy.yml line 66) selects WIF.
# ---------------------------------------------------------------------------
gh variable set GCP_WIF_PROVIDER --repo "${GITHUB_REPO}" --body "${WIF_PROVIDER_VAR}"
gh variable set GCP_DEPLOY_SA    --repo "${GITHUB_REPO}" --body "${SA_EMAIL}"

echo
echo "== WIF provisioning complete =="
echo "  Set repo vars:"
echo "    GCP_WIF_PROVIDER = ${WIF_PROVIDER_VAR}"
echo "    GCP_DEPLOY_SA    = ${SA_EMAIL}"
echo
echo "  NEXT (do NOT delete the key yet):"
echo "   1. Trigger arbor-deploy.yml via 'Run workflow' (workflow_dispatch) on main."
echo "   2. Confirm the 'auth-wif' step runs (auth-key is skipped) and the deploy is green."
echo "   3. In Cloud Audit Logs, confirm the build ran AS ${SA_EMAIL}."
echo "   4. ONLY THEN run the cutover-finalize section below."

# ===========================================================================
# 8. CUTOVER-FINALIZE  ***RUN ONLY AFTER A WIF DEPLOY IS PROVEN GREEN.***
#    Guarded so a stray full-script run does not delete the fallback prematurely.
#    Run with:  CONFIRM_DELETE_KEY=yes bash wif-setup.sh
# ===========================================================================
if [[ "${CONFIRM_DELETE_KEY:-no}" == "yes" ]]; then
  echo "== Finalizing: removing the long-lived key fallback =="

  # 8a. Delete the GitHub secret so the fallback path can never be taken again.
  gh secret delete GCP_SA_KEY --repo "${GITHUB_REPO}" || echo "  GCP_SA_KEY secret already absent."

  # 8b. Delete the JSON key(s) in IAM for the OLD key-based SA. If the long-lived key
  #     belonged to ${SA_EMAIL}, delete its USER-MANAGED keys (never Google-managed).
  #     Adjust KEY_SA if the old key used a different SA.
  KEY_SA="${KEY_SA:-${SA_EMAIL}}"
  echo "  Listing user-managed keys on ${KEY_SA}:"
  gcloud iam service-accounts keys list \
    --iam-account="${KEY_SA}" \
    --managed-by=user \
    --project "${PROJECT_ID}" \
    --format='value(name)' | while read -r KEY_ID; do
      [[ -z "${KEY_ID}" ]] && continue
      echo "  deleting key ${KEY_ID}"
      gcloud iam service-accounts keys delete "${KEY_ID}" \
        --iam-account="${KEY_SA}" \
        --project "${PROJECT_ID}" \
        --quiet
    done

  echo "== Key fallback removed. CI is now keyless via WIF. =="
  echo "   Apply the comment-cleanup SNIPPET to arbor-deploy.yml (drop the auth-key step + over-broad role doc)."
else
  echo
  echo "  (Skipping key deletion. Re-run with CONFIRM_DELETE_KEY=yes after WIF is green.)"
fi
