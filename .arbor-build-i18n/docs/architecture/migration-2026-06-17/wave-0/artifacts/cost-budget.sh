#!/usr/bin/env bash
#
# COST-3 — FinOps baseline for Arbor prod: GCP Budget + threshold alerts + BigQuery billing export.
#
# Provisions, idempotently:
#   1. A Pub/Sub topic (arbor-budget-alerts) for programmatic budget notifications.
#   2. An email notification channel + a Cloud Monitoring/Billing budget on the prod
#      billing account, scoped to the Arbor project, with 50/80/100/120% thresholds.
#   3. An EU multi-region BigQuery dataset (billing_export) that Cloud Billing -> BigQuery
#      export writes standard usage cost into. (The export ENABLE step is console-only on
#      GCP today — see section 4; this script creates the EU dataset it lands in and verifies.)
#
# Why this exists: the Cost Optimization pillar scored lowest (2.5) in the WAF assessment.
# There is no billing-platform config anywhere in the repo today (cloudbuild.prod.yaml only
# deploys Cloud Run). This is the pure-infra mission that closes COST-3. It is a NET COST
# SAVER: budgets/alerts are free; the BigQuery billing-export storage is a few cents/month.
#
# *** THIS SCRIPT IS NOT EXECUTED BY THE MIGRATION AGENT. ***
# A human (or a later clean-baseline run) runs it after editing the BILLING_ACCOUNT_ID and
# ALERT_EMAIL below and confirming MONTHLY_BUDGET_EUR. It mutates GCP billing/BQ state, so
# it must be run with eyes open. It is idempotent where the gcloud API allows (create steps
# tolerate "already exists" and re-runs are safe).
#
# Cross-market guardrail (NL AVG + IL PPL Amendment-13):
#   - The BigQuery dataset MUST be EU multi-region (DATASET_LOCATION=EU). Billing rows are
#     not child PII, but B2G/municipality procurement scrutinises every data sink and the
#     EU location keeps billing metadata in-region. DO NOT change DATASET_LOCATION to US.
#   - No personal data leaves the EU project. The billing export carries cost/usage rows
#     (service, SKU, project, cost), never message content or child attributes.
#
# Pre-reqs on the operator's machine:
#   - gcloud >= 470 authenticated as a user with, on the BILLING ACCOUNT:
#       roles/billing.admin (to create budgets + read the account) and on the PROJECT:
#       roles/bigquery.admin + roles/pubsub.admin + roles/monitoring.notificationChannelEditor.
#       gcloud auth login
#   - The Cloud Billing Budget API + BigQuery API enabled (section 1 enables them).
#
# References (read before running):
#   - cloudbuild.prod.yaml         (region europe-west4, Cloud Run service arbor-api, project = $PROJECT_ID)
#   - app/src/server/admin.ts      (the in-app cost rate table this export reconciles against)
#   - docs/architecture/migration-2026-06-17/wave-0/cost/budget-and-billing-export.md  (the runbook)
#   - docs/architecture/migration-2026-06-17/spec-E-cost.md  (COST-3)
#
set -euo pipefail

# ---------------------------------------------------------------------------
# 0. EDIT THESE — the only operator-supplied values.
# ---------------------------------------------------------------------------
PROJECT_ID="${PROJECT_ID:-arborprd-westeu}"            # GCP prod project (matches secrets.GCP_PROJECT_ID / wif-setup.sh)
BILLING_ACCOUNT_ID="${BILLING_ACCOUNT_ID:-XXXXXX-XXXXXX-XXXXXX}"  # *** REQUIRED *** gcloud billing accounts list
ALERT_EMAIL="${ALERT_EMAIL:-bguy.rubin@gmail.com}"     # founder; receives 50/80/100/120% alerts
MONTHLY_BUDGET_EUR="${MONTHLY_BUDGET_EUR:-300}"        # monthly cap basis. Set above expected beta spend, leave headroom.

# Stable resource names (safe defaults).
REGION="${REGION:-europe-west4}"                        # informational; budget is account-scoped, not region-scoped
DATASET_LOCATION="${DATASET_LOCATION:-EU}"              # *** MUST be EU multi-region. Do not change to US. ***
DATASET_ID="${DATASET_ID:-billing_export}"             # BigQuery dataset the Cloud Billing export lands in
TOPIC_ID="${TOPIC_ID:-arbor-budget-alerts}"            # Pub/Sub topic for programmatic budget notifications
BUDGET_DISPLAY_NAME="${BUDGET_DISPLAY_NAME:-arbor-prod}"
NOTIFICATION_CHANNEL_NAME="${NOTIFICATION_CHANNEL_NAME:-Arbor budget alerts (founder)}"

# Derived — do not edit.
BILLING_ACCOUNT_RESOURCE="billingAccounts/${BILLING_ACCOUNT_ID}"
TOPIC_RESOURCE="projects/${PROJECT_ID}/topics/${TOPIC_ID}"

echo "== COST-3 FinOps baseline =="
echo "  project        : ${PROJECT_ID}"
echo "  billing account: ${BILLING_ACCOUNT_ID}"
echo "  monthly budget : ${MONTHLY_BUDGET_EUR} EUR  (thresholds 50/80/100/120%)"
echo "  alert email    : ${ALERT_EMAIL}"
echo "  BQ dataset     : ${PROJECT_ID}:${DATASET_ID}  (location ${DATASET_LOCATION})"
echo "  pubsub topic   : ${TOPIC_RESOURCE}"
echo

if [[ "${BILLING_ACCOUNT_ID}" == "XXXXXX-XXXXXX-XXXXXX" ]]; then
  echo "ERROR: set BILLING_ACCOUNT_ID first.  gcloud billing accounts list" >&2
  exit 1
fi
if [[ "${DATASET_LOCATION}" != "EU" ]]; then
  echo "ERROR: DATASET_LOCATION must be EU (AVG/PPL in-region requirement). Refusing to run." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Enable required APIs (idempotent).
# ---------------------------------------------------------------------------
echo "== 1. Enabling APIs =="
gcloud services enable \
  cloudbilling.googleapis.com \
  billingbudgets.googleapis.com \
  bigquery.googleapis.com \
  pubsub.googleapis.com \
  monitoring.googleapis.com \
  --project "${PROJECT_ID}"

# ---------------------------------------------------------------------------
# 2. Pub/Sub topic for programmatic budget notifications.
#    The budget publishes a JSON message here on every threshold crossing. A later
#    follow-up (out of COST-3 scope) can subscribe app/src/server/digest.ts so a 120%
#    breach trips the COST-1 global fail-closed token cap automatically.
# ---------------------------------------------------------------------------
echo "== 2. Pub/Sub topic ${TOPIC_ID} =="
gcloud pubsub topics create "${TOPIC_ID}" --project "${PROJECT_ID}" 2>/dev/null \
  || echo "  topic already exists (ok)"

# Allow the Cloud Billing budgets service agent to publish to this topic.
# The billing-budgets P4SA is per project-number.
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
BUDGETS_SA="billing-budgets-p4sa@gcp-sa-billing-budgets.iam.gserviceaccount.com"
gcloud pubsub topics add-iam-policy-binding "${TOPIC_ID}" \
  --project "${PROJECT_ID}" \
  --member="serviceAccount:${BUDGETS_SA}" \
  --role="roles/pubsub.publisher" 2>/dev/null \
  || echo "  budgets P4SA binding already present / will be auto-created on first budget (ok)"

# ---------------------------------------------------------------------------
# 3. Email notification channel (Cloud Monitoring) for human-readable alerts.
#    Budgets natively email billing admins, but an explicit channel lets the founder
#    get alerts without billing-admin role and keeps the routing auditable.
# ---------------------------------------------------------------------------
echo "== 3. Email notification channel =="
EXISTING_CHANNEL="$(gcloud beta monitoring channels list \
  --project "${PROJECT_ID}" \
  --filter="type=email AND labels.email_address=${ALERT_EMAIL}" \
  --format='value(name)' 2>/dev/null | head -n1 || true)"
if [[ -n "${EXISTING_CHANNEL}" ]]; then
  echo "  channel already exists: ${EXISTING_CHANNEL}"
  CHANNEL_NAME="${EXISTING_CHANNEL}"
else
  CHANNEL_NAME="$(gcloud beta monitoring channels create \
    --project "${PROJECT_ID}" \
    --type=email \
    --display-name="${NOTIFICATION_CHANNEL_NAME}" \
    --channel-labels="email_address=${ALERT_EMAIL}" \
    --format='value(name)')"
  echo "  created channel: ${CHANNEL_NAME}"
fi

# ---------------------------------------------------------------------------
# 4. The Budget itself: account-scoped, filtered to the Arbor project, thresholds
#    at 50/80/100/120% of the monthly amount, routed to Pub/Sub + the email channel.
# ---------------------------------------------------------------------------
echo "== 4. Budget ${BUDGET_DISPLAY_NAME} =="
# gcloud creates a fresh budget each time; guard against duplicates by display name.
EXISTING_BUDGET="$(gcloud billing budgets list \
  --billing-account="${BILLING_ACCOUNT_ID}" \
  --filter="displayName=${BUDGET_DISPLAY_NAME}" \
  --format='value(name)' 2>/dev/null | head -n1 || true)"

BUDGET_ARGS=(
  --billing-account="${BILLING_ACCOUNT_ID}"
  --display-name="${BUDGET_DISPLAY_NAME}"
  --budget-amount="${MONTHLY_BUDGET_EUR}EUR"
  --filter-projects="projects/${PROJECT_ID}"
  # Alert when ACTUAL spend crosses each percentage of the monthly amount.
  --threshold-rule=percent=0.5
  --threshold-rule=percent=0.8
  --threshold-rule=percent=1.0
  --threshold-rule=percent=1.2
  # Also alert on FORECASTED 100% so we hear about an overrun before it lands.
  --threshold-rule=percent=1.0,basis=forecasted-spend
  --notifications-rule-pubsub-topic="${TOPIC_RESOURCE}"
  --notifications-rule-monitoring-notification-channels="${CHANNEL_NAME}"
  # Keep billing admins on the default email path too.
  --disable-default-iam-recipients=false
)

if [[ -n "${EXISTING_BUDGET}" ]]; then
  BUDGET_ID="${EXISTING_BUDGET##*/}"
  echo "  budget exists (${BUDGET_ID}); updating thresholds/notifications"
  gcloud billing budgets update "${BUDGET_ID}" "${BUDGET_ARGS[@]}"
else
  gcloud billing budgets create "${BUDGET_ARGS[@]}"
  echo "  budget created"
fi

# ---------------------------------------------------------------------------
# 5. BigQuery EU dataset for the Cloud Billing export.
#    The export ENABLE toggle (Billing -> Billing export -> BigQuery export -> Standard
#    usage cost) is CONSOLE-ONLY on GCP and cannot be set by gcloud/bq today. This step
#    creates the EU dataset the export writes into; section 6 of the runbook covers the
#    one-time console enable that points the export at this dataset.
# ---------------------------------------------------------------------------
echo "== 5. BigQuery dataset ${DATASET_ID} (location ${DATASET_LOCATION}) =="
if bq --project_id="${PROJECT_ID}" show "${DATASET_ID}" >/dev/null 2>&1; then
  echo "  dataset already exists"
  # Hard-verify location is EU; a US dataset here is an AVG/PPL violation.
  LOC="$(bq --project_id="${PROJECT_ID}" --format=prettyjson show "${DATASET_ID}" \
    | grep -o '"location": *"[^"]*"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')"
  if [[ "${LOC}" != "EU" && "${LOC}" != "eu" ]]; then
    echo "ERROR: dataset ${DATASET_ID} is in location '${LOC}', not EU. Cost data must stay in-region." >&2
    echo "       Recreate it: bq rm -r -d ${PROJECT_ID}:${DATASET_ID}  then re-run this script." >&2
    exit 1
  fi
  echo "  location verified EU (ok)"
else
  bq --project_id="${PROJECT_ID}" mk \
    --location="${DATASET_LOCATION}" \
    --dataset \
    --description="Cloud Billing export (standard usage cost) — EU-resident per AVG/PPL. COST-3." \
    "${PROJECT_ID}:${DATASET_ID}"
  echo "  dataset created in ${DATASET_LOCATION}"
fi

cat <<EOF

== Done. Remaining MANUAL step (console-only, ~2 min) ==
GCP does not expose the billing-export enable toggle via CLI. Finish in the console:
  1. Console -> Billing -> (select billing account ${BILLING_ACCOUNT_ID})
  2. Billing export -> BigQuery export -> EDIT SETTINGS on "Standard usage cost"
  3. Project = ${PROJECT_ID}, Dataset = ${DATASET_ID}, SAVE.
  4. (Optional) repeat for "Detailed usage cost" if SKU-level granularity is wanted.

Rows appear within ~24h in:
  ${PROJECT_ID}.${DATASET_ID}.gcp_billing_export_v1_<BILLING_ACCOUNT_ID with _ for ->

Verify next day:
  bq query --use_legacy_sql=false --location=EU \\
    'SELECT service.description AS svc, SUM(cost) AS eur
       FROM \`${PROJECT_ID}.${DATASET_ID}\`.*
      WHERE DATE(_PARTITIONTIME) >= CURRENT_DATE()-1
      GROUP BY svc ORDER BY eur DESC'
Expect Vertex AI, Cloud Run, and Cloud Firestore rows.
EOF
