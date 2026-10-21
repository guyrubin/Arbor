# WIF Migration Runbook — Keyless GitHub Actions Deploys

**Status (2026-10-21):** every step of `arbor-deploy.yml` is keyless-ready, the Firebase Hosting deploy included. The GCP-side setup below must be run once by someone with `roles/iam.workloadIdentityPoolAdmin` on the project. After that, deploys go keyless and the long-lived `GCP_SA_KEY` can be destroyed. The operator's copy with production values is kept outside this public repo.

**Correction to the 2026-06-11 version.** That version said the key path is skipped entirely once WIF is on. It was not: the `promote` job's *Deploy Hosting + Firestore* step read `secrets.GCP_SA_KEY` unconditionally. Deleting the secret after a keyless deploy would have failed the next release at that step, after traffic had already moved to the new API. Fixed on 2026-10-21. A *Firebase auth preflight* now runs before the promote and uses whichever credentials the auth step exported. A guard test in `app/src/server/productionProbe.test.ts` pins it.

## Why

`arbor-deploy.yml` authenticates with a long-lived service-account JSON key stored as the `GCP_SA_KEY` repo secret. Any static key is a standing risk: it can be exfiltrated, it never expires, and any workflow on any branch of this repo can read the secret. Workload Identity Federation (WIF) exchanges GitHub's short-lived OIDC token for GCP credentials at run time. Nothing is stored, so nothing can leak and nothing needs rotating.

The workflow prefers WIF: if the repo **variable** `GCP_WIF_PROVIDER` is set, no step receives `GCP_SA_KEY`.

## One-time GCP setup

Fill in the three values and run (Git Bash on Windows: `export MSYS_NO_PATHCONV=1` first):

```bash
PROJECT_ID="<your-project-id>"
REPO_ID="$(gh api repos/<owner>/<repo> --jq .id)"   # immutable; a renamed or re-created repo cannot match
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA="arbor-deployer@${PROJECT_ID}.iam.gserviceaccount.com"   # the existing deploy SA

# 0) The token exchange needs STS; impersonation needs IAM Credentials.
gcloud services enable sts.googleapis.com iamcredentials.googleapis.com --project="$PROJECT_ID"

# 1) Identity pool + GitHub OIDC provider: this repo's main branch only. Branch pushes
#    (claude/**, codex/**) run workflows too; none of them may mint deploy credentials.
gcloud iam workload-identity-pools create github \
  --project="$PROJECT_ID" --location=global \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc arbor \
  --project="$PROJECT_ID" --location=global \
  --workload-identity-pool=github \
  --display-name="Arbor deploys" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository_id == '${REPO_ID}' && assertion.ref == 'refs/heads/main'"

# 2) Let workflows from this repo impersonate the deploy SA.
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository_id/${REPO_ID}"

# 3) Print the values for the GitHub variables.
echo "GCP_WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/arbor"
echo "GCP_DEPLOY_SA=${SA}"
```

## GitHub-side switch

Set both repo **variables** (Settings → Secrets and variables → Actions → Variables, or `gh variable set`):

| Variable | Value |
| --- | --- |
| `GCP_WIF_PROVIDER` | `projects/<num>/locations/global/workloadIdentityPools/github/providers/arbor` |
| `GCP_DEPLOY_SA` | `arbor-deployer@<project>.iam.gserviceaccount.com` |

From then on every deploy is keyless. Run one manual deploy at once: Actions → Arbor Deploy → Run workflow, on `main`. It redeploys the SHA that is already live. **Pass** requires all of these:

- In both jobs, **Auth keyless (WIF)** succeeds and **Auth key fallback (GCP_SA_KEY)** is skipped.
- *Firebase auth preflight* and *Deploy Hosting + Firestore* succeed, and the log reads `ADC via external_account for arbor-deployer@…`.
- The run is green through *Verify live release identity*.

`arbor-ai-evaluate.yml` authenticates the same way, so dispatch it from `main`.

## Retire the key (do not skip)

Only after a pass:

```bash
gh secret delete GCP_SA_KEY -R <owner>/<repo>
gh secret delete FIREBASE_TOKEN -R <owner>/<repo>   # legacy user token; no workflow reads it

# The deploy SA's user-managed keys: disable first (reversible), delete after the next green release.
gcloud iam service-accounts keys list --iam-account="$SA" --managed-by=user
gcloud iam service-accounts keys disable <KEY_ID> --iam-account="$SA"
gcloud iam service-accounts keys delete <KEY_ID> --iam-account="$SA" --quiet
```

Done = the key list prints nothing. Rotation alone is not retirement.

## Rollback

While the secret and key still exist: unset `GCP_WIF_PROVIDER`, and the workflow falls back to `GCP_SA_KEY`. After retirement, fix the provider or binding instead. Create a fresh key only if truly needed, and delete it after.
