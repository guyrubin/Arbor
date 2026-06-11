# WIF Migration Runbook — Keyless GitHub Actions Deploys

**Status:** workflow is WIF-ready (2026-06-11). The GCP-side setup below must be run once by someone with `roles/iam.workloadIdentityPoolAdmin` on the project; then deploys go keyless and the long-lived `GCP_SA_KEY` can be destroyed.

## Why

`arbor-deploy.yml` currently authenticates with a long-lived service-account JSON key stored as the `GCP_SA_KEY` repo secret. A key that was previously exposed was rotated, but any static key is a standing risk (exfiltration, no automatic expiry). Workload Identity Federation (WIF) exchanges GitHub's short-lived OIDC token for GCP credentials at run time — nothing to store, nothing to leak, nothing to rotate.

The workflow already prefers WIF: if the repo **variable** `GCP_WIF_PROVIDER` is set, the key path is skipped entirely.

## One-time GCP setup

Replace `PROJECT_ID`, `GITHUB_ORG/REPO` (e.g. `guyrubin/PPPPtherapy-`) and run:

```bash
PROJECT_ID="<your-project-id>"
REPO="<github-org>/<github-repo>"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA="arbor-deployer@${PROJECT_ID}.iam.gserviceaccount.com"   # the existing deploy SA

# 1) Identity pool + GitHub OIDC provider (restricted to this repo).
gcloud iam workload-identity-pools create github \
  --project="$PROJECT_ID" --location=global \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc arbor \
  --project="$PROJECT_ID" --location=global \
  --workload-identity-pool=github \
  --display-name="Arbor deploys" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == '${REPO}'"

# 2) Let workflows from this repo (main branch) impersonate the deploy SA.
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"

# 3) Print the provider resource name for the GitHub variable.
echo "GCP_WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/arbor"
echo "GCP_DEPLOY_SA=${SA}"
```

## GitHub-side switch

In the repo: Settings → Secrets and variables → Actions → **Variables**:

| Variable | Value |
| --- | --- |
| `GCP_WIF_PROVIDER` | `projects/<num>/locations/global/workloadIdentityPools/github/providers/arbor` |
| `GCP_DEPLOY_SA` | `arbor-deployer@<project>.iam.gserviceaccount.com` |

Trigger a manual deploy (Actions → Arbor Deploy → Run workflow) and confirm the `auth-wif` step ran (the `auth-key` step shows as skipped).

## Retire the key (do not skip)

Once a WIF deploy has succeeded:

```bash
# List keys on the deploy SA — confirm which are user-managed.
gcloud iam service-accounts keys list --iam-account="$SA" --managed-by=user

# Destroy every user-managed key (including the previously exposed-then-rotated one).
gcloud iam service-accounts keys delete <KEY_ID> --iam-account="$SA" --quiet
```

Then delete the `GCP_SA_KEY` secret from GitHub. Verify the old exposed key is gone from the list above — rotation alone is not retirement.

## Rollback

Unset the `GCP_WIF_PROVIDER` variable; the workflow falls back to `GCP_SA_KEY` (requires a key to exist again — create a fresh one only if truly needed, and delete it after).
