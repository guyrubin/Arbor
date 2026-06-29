# SEC-4 — Workload Identity Federation Cutover Runbook

**Mission:** SEC-4 (Wave 0, Spec B Security)
**Objective:** Make the Arbor deploy workflow authenticate to GCP **keyless** via Workload Identity Federation (WIF), delete the long-lived `GCP_SA_KEY`, and least-privilege the deploy service account.
**Date:** 2026-06-17
**Severity:** High · **Effort:** S · **Rollback:** unset repo vars → workflow auto-falls back to key path.

> This runbook is the human/clean-baseline execution guide. The migration agent did **not** run any `gcloud`/`gh` commands and did **not** modify any tracked file. The exact provisioning commands live in the companion script `../artifacts/wif-setup.sh` (also not executed).

---

## 0. Why this is mostly GCP-side (no workflow rewrite)

The deploy workflow is **already scaffolded for WIF**. In `.github/workflows/arbor-deploy.yml`:

- `permissions: id-token: write` (line 39) — the OIDC token the exchange needs.
- The **WIF auth step** is conditional on the repo var being set (lines 64-70):
  ```yaml
  - id: auth-wif
    if: vars.GCP_WIF_PROVIDER != ''
    uses: google-github-actions/auth@v2
    with:
      workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
      service_account: ${{ vars.GCP_DEPLOY_SA }}
  ```
- The **key fallback** is the mutually-exclusive branch (lines 75-79):
  ```yaml
  - id: auth-key
    if: vars.GCP_WIF_PROVIDER == ''
    uses: google-github-actions/auth@v2
    with:
      credentials_json: ${{ secrets.GCP_SA_KEY }}
  ```
- The Hosting/Firestore step already consumes whichever produced a credentials file (line 109):
  `GOOGLE_APPLICATION_CREDENTIALS: ${{ steps.auth-wif.outputs.credentials_file_path || steps.auth-key.outputs.credentials_file_path }}`

**Therefore: setting the repo variable `GCP_WIF_PROVIDER` is the on-switch.** No executable workflow change is required to cut over. The only workflow change is an optional, post-green **comment + dead-step cleanup** (SNIPPET in §6).

What the deploy actually does (so we can scope roles to exactly these, no more):
1. `gcloud builds submit --config cloudbuild.prod.yaml` → Cloud Build builds + pushes the image and runs `gcloud run deploy arbor-api` (`cloudbuild.prod.yaml` lines 19-49).
2. `npm run build` (client) — no GCP auth.
3. `firebase deploy --only hosting,firestore` (line 111) — Hosting release + Firestore **rules** release + **indexes**.

---

## 1. Prerequisites

| Need | Detail |
|---|---|
| `gcloud` | Authenticated as project **Owner/IAM Admin** on the prod project (default `arborprd-westeu`, = `secrets.GCP_PROJECT_ID`). |
| `gh` CLI | Authenticated with **admin** on the Arbor repo (to set Variables and delete the secret). |
| Repo merged | The WIF path (lines 64-80) is already on `main`. Nothing to merge. |
| Real values | Confirm the **GCP project id** and the **`owner/repo` slug** before running the script (the script defaults `GITHUB_REPO=rubin/PPPPtherapy-` — **edit to the real slug**). |

---

## 2. What gets created (resource map)

| Resource | Name / value |
|---|---|
| Workload Identity **Pool** | `github` → `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github` |
| OIDC **Provider** | `arbor`, issuer `https://token.actions.githubusercontent.com` |
| Provider **attribute-condition** | `assertion.repository == '<owner>/<repo>'` (rejects every other repo) |
| Attribute mapping | `google.subject=assertion.sub`, `attribute.repository=assertion.repository`, `attribute.ref=assertion.ref` |
| Deploy **SA** | `arbor-deployer@<project>.iam.gserviceaccount.com` |
| WIF **principalSet** | `principalSet://…/attribute.repository/<owner>/<repo>` granted `roles/iam.workloadIdentityUser` on the SA |
| Repo **Variable** `GCP_WIF_PROVIDER` | `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/providers/arbor` |
| Repo **Variable** `GCP_DEPLOY_SA` | `arbor-deployer@<project>.iam.gserviceaccount.com` |

**Two layers of repo-locking** (defence in depth): (a) the provider `attribute-condition` refuses any OIDC token whose `repository` claim isn't ours; (b) the `principalSet` only grants impersonation to that same repository attribute. A leaked provider name alone cannot be used from another repo.

---

## 3. Least-privilege role matrix (deploy SA)

No `Owner`, `Editor`, `Firebase Admin`, or `Datastore Owner`. Each role is justified by a concrete deploy step:

| Role | Why it's needed | Replaces (over-broad) |
|---|---|---|
| `roles/cloudbuild.builds.editor` | `gcloud builds submit` (step "Deploy API") | — |
| `roles/run.admin` | `gcloud run deploy arbor-api` (cloudbuild step) | — |
| `roles/artifactregistry.writer` | push `arbor-api` image to the `arbor` AR repo | — |
| `roles/iam.serviceAccountUser` | actAs the Cloud Build SA **and** the Cloud Run **runtime** SA | (was implicit in broad grant) |
| `roles/firebasehosting.admin` | `firebase deploy --only hosting` | **Firebase Admin** |
| `roles/firebaserules.admin` | `firebase deploy --only firestore` (rules release) | **Firebase Admin** |
| `roles/datastore.indexAdmin` | Firestore **index** deploy (`firestore.indexes.json`) | **Datastore Owner** |
| `roles/serviceusage.serviceUsageConsumer` | Firebase CLI / Builds API service-usage checks | — |

> **Old key grant (to retire)** per `arbor-deploy.yml` lines 11-13: *Cloud Build Editor, Cloud Run Admin, Artifact Registry Writer, Service Account User, **Firebase Admin, Datastore Owner***. The last two are the over-grant this matrix removes.

**Optional tighter actAs:** `roles/iam.serviceAccountUser` is granted project-wide above for first-cutover simplicity. To scope it down, remove the project-level grant and instead bind the deploy SA as `serviceAccountUser` on exactly the two target SAs — the default Cloud Run runtime SA (`<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`) and the Cloud Build SA (`<PROJECT_NUMBER>@cloudbuild.gserviceaccount.com`). The commented block in §6/§7 of `wif-setup.sh` does exactly this.

---

## 4. Execution sequence (keep the key until green, then delete)

1. **Review & edit** `../artifacts/wif-setup.sh` — set `PROJECT_ID` and `GITHUB_REPO` to the real values.
2. **Run provisioning** (sections 1-7 of the script):
   ```bash
   PROJECT_ID=arborprd-westeu GITHUB_REPO=<owner>/<repo> bash docs/architecture/migration-2026-06-17/wave-0/artifacts/wif-setup.sh
   ```
   This creates the pool/provider/SA, binds the principalSet, grants the least-privilege roles, and **sets `GCP_WIF_PROVIDER` + `GCP_DEPLOY_SA`**. It does **not** delete the key (guarded by `CONFIRM_DELETE_KEY`).
3. **Prove WIF works (key still present as safety net):**
   - GitHub → Actions → **Arbor Deploy** → **Run workflow** on `main` (`workflow_dispatch`).
   - Confirm the **`auth-wif`** step runs and **`auth-key`** is skipped (it will be, because `GCP_WIF_PROVIDER` is now non-empty).
   - Confirm the full deploy is green: Cloud Run `arbor-api` revision served, Hosting released, Firestore rules+indexes deployed.
   - In **Cloud Logging / Audit Logs**, filter `protoPayload.authenticationInfo.principalEmail="arbor-deployer@<project>.iam.gserviceaccount.com"` to confirm the build ran **as the deploy SA** (not the old key identity).
4. **Finalize (delete the key) — only after step 3 is green:**
   ```bash
   CONFIRM_DELETE_KEY=yes PROJECT_ID=arborprd-westeu GITHUB_REPO=<owner>/<repo> \
     bash docs/architecture/migration-2026-06-17/wave-0/artifacts/wif-setup.sh
   ```
   Section 8 then (a) `gh secret delete GCP_SA_KEY`, and (b) deletes the **user-managed** JSON key(s) on the SA in IAM. (If the old key belonged to a *different* SA, pass `KEY_SA=<that-sa-email>`.)
5. **Apply the workflow comment-cleanup SNIPPET** (§6) to drop the now-dead `auth-key` step and the stale over-broad role comment.

**Rollback at any point before step 4:** delete/empty the `GCP_WIF_PROVIDER` repo variable (`gh variable delete GCP_WIF_PROVIDER --repo <owner>/<repo>`). The `if:` conditions flip the workflow straight back to the key path. Keep `GCP_SA_KEY` until you have run a green WIF deploy — that is the entire point of step 4 being gated.

---

## 5. Verification checklist

- [ ] `gcloud iam workload-identity-pools providers describe arbor --location=global --workload-identity-pool=github` shows the issuer + `attribute.repository` condition.
- [ ] `gcloud iam service-accounts get-iam-policy arbor-deployer@<project>.iam.gserviceaccount.com` shows `roles/iam.workloadIdentityUser` bound to the repo principalSet only.
- [ ] Project IAM shows the 8 least-privilege roles on the SA and **no** Owner/Editor/Firebase Admin/Datastore Owner.
- [ ] Repo Variables `GCP_WIF_PROVIDER` + `GCP_DEPLOY_SA` are set; `GCP_SA_KEY` secret is **absent** post-finalize.
- [ ] A `workflow_dispatch` deploy ran `auth-wif`, skipped `auth-key`, and completed Cloud Run + Hosting + Firestore.
- [ ] Audit Logs confirm the deploy principal = the deploy SA.
- [ ] No user-managed keys remain: `gcloud iam service-accounts keys list --iam-account=<sa> --managed-by=user` returns empty.

---

## 6. SNIPPET — `.github/workflows/arbor-deploy.yml` comment + dead-step cleanup (apply post-green; do NOT pre-apply)

> Apply **only after** the WIF deploy is proven and the key is deleted — removing the fallback before WIF is green would brick the deploy. This is a *human edit*; the migration agent left the file untouched.

**6a. Replace the AUTH comment header (lines 3-13)** with the keyless-only version:

```yaml
# AUTH (keyless — Workload Identity Federation, no stored key):
#   Repository VARS (Settings → Secrets and variables → Actions → Variables):
#     GCP_WIF_PROVIDER   projects/<num>/locations/global/workloadIdentityPools/github/providers/arbor
#     GCP_DEPLOY_SA      arbor-deployer@<project>.iam.gserviceaccount.com
#   The deploy SA holds least-privilege roles only (see
#   docs/architecture/migration-2026-06-17/wave-0/security/wif-setup-runbook.md):
#     Cloud Build Editor, Cloud Run Admin, Artifact Registry Writer,
#     Service Account User, Firebase Hosting Admin, Firebase Rules Admin,
#     Datastore Index Admin, Service Usage Consumer.
#   GCP_SA_KEY has been deleted; there is no long-lived key path.
```

**6b. Remove the now-dead fallback step (lines 72-79)** entirely:

```yaml
      # Keyless auth via Workload Identity Federation (no stored key).
      - id: auth-wif
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}
          service_account: ${{ vars.GCP_DEPLOY_SA }}
```

i.e. delete the `if: vars.GCP_WIF_PROVIDER != ''` guard on `auth-wif` (no longer needed once it's the only path) **and** delete the whole `auth-key` step (the `- id: auth-key … credentials_json: ${{ secrets.GCP_SA_KEY }}` block).

**6c. Simplify the Hosting/Firestore credentials line (line 109)** since only `auth-wif` exists now:

```yaml
          GOOGLE_APPLICATION_CREDENTIALS: ${{ steps.auth-wif.outputs.credentials_file_path }}
```

> Until 6a-6c are applied the workflow still works correctly with WIF (the `||` and conditionals are harmless with the key gone); the cleanup is hygiene, not function.

---

## 7. Compliance notes

- **NL (GDPR / AVG Art. 32):** keyless CI + documented least-privilege is a concrete answer to a B2G procurement security questionnaire — municipalities / JGZ / insurers routinely require *"no long-lived cloud keys"*. Record this control in the DPIA's security-measures section.
- **IL (Privacy Protection Law / Amendment 13):** supports the operator's "reasonable security measures" + accountability expectations. No market-specific UI.
- **Standing-credential risk removed:** the JSON key was a theft target with broad rights; WIF tokens are short-lived and repo-scoped, eliminating that liability.

---

## 8. Cost / risk

- **Cost:** zero. WIF is free; deleting the key removes a liability, not a billed resource.
- **Human gate:** YES — this requires GCP IAM admin + GitHub repo admin and a real deploy. No agent can self-execute it.
- **Blast radius:** the deploy SA can build/deploy the API, release Hosting, and release Firestore rules/indexes — and nothing else. It cannot read/write app data (no Datastore data role) or administer Firebase broadly.
