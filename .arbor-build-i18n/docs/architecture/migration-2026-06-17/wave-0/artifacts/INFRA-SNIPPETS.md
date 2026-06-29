# Wave-0 Infra Snippets — REL-6 + SEC-8

**Date:** 2026-06-17
**Scope:** Two ready-to-merge infra artifacts produced as NEW files. The repo working tree is dirty with unrelated in-flight work (billing, JITAI, MimicStudio), so **nothing here edits a live tracked file**. Each artifact is a merge source plus the exact apply step below. A human (or a later clean-baseline run) drops them in.

| Artifact (NEW file) | Mission | Merges into (LIVE file — DO NOT auto-edit) |
|---|---|---|
| `firestore-indexes.additions.json` | REL-6 | `/firestore.indexes.json` (repo root) |
| `ci-security-job.yml` | SEC-8 | `.github/workflows/arbor-ci.yml` (+ NEW `.github/dependabot.yml`) |

Grounded against: `spec-C-reliability.md` REL-6 (lines 161–183), `spec-B-security.md` SEC-8 (lines 220–244), the live `firestore.indexes.json`, `arbor-ci.yml`, `arbor-deploy.yml`, `cloudbuild.prod.yaml`, and the real query sites in `app/src`.

---

## A. REL-6 — Firestore composite indexes + TTL / retention

### What the audit found (grounded in real code)
The full query inventory was re-verified against source, not just the spec:

| Site | Query | Index need | Status |
|---|---|---|---|
| `app/src/memory/firestoreMemoryStore.ts:23` | `collectionGroup("memoryEvents").orderBy("createdAt","asc").where("childId","==",…)` | COLLECTION_GROUP composite `(childId ASC, createdAt ASC)` | **Already present** in live file (lines 4–10). This is the index from the prior Gemini-outage fix. **Must not be removed.** |
| `app/src/server/consultRequests.ts:58` | `.where("ownerUid","==",ownerUid).get()` then **client-side** `sort(createdAt desc)` (lines 40,61) | single-field auto-index | Covered. No composite needed *today*. |
| `app/src/server/adminMetrics.ts:78-80` | `entitlements.where("plan"\|"status","==",…)` `.count()` | single-field auto-index | Covered. |
| `app/src/families/familyService.ts:7` | `collectionGroup("members").where("userId","==",uid).limit(1)` | single-field auto-index | Covered. |

**Conclusion:** the only composite-requiring query is already indexed. REL-6 is a documented audit + **pre-emptive future-proofing** + the **`aiQuota` TTL** + the **memory retention decision** — not a pile of new indexes.

### What the additions file declares
`firestore-indexes.additions.json` adds **two pre-emptive composite indexes** (both for near-term reverse-chronological UI features that would otherwise throw `FAILED_PRECONDITION: needs index` on grown data):

1. `memoryEvents` COLLECTION_GROUP `(childId ASC, createdAt DESC)` — for a reverse-chronological memory timeline (mirror of the existing ASC index).
2. `consultRequests` COLLECTION `(ownerUid ASC, createdAt DESC)` — for a server-side reverse-chronological consult inbox (replacing today's client-side sort once the list grows).

It also carries two notes that are **not** expressible as index entries:
- **`__ttl_note__`** — the `aiQuota.expireAt` TTL policy (field is written at `quotaStore.ts:76`; **no TTL policy exists today**). TTL is a gcloud field op, not an index doc — `firebase deploy --only firestore:indexes` will NOT set it.
- **`__memory_retention_note__`** — explicit decision: **NO raw TTL on `memoryEvents`** (it is the durable product record / memory moat). Retention is handled at the app layer via the GDPR erase path (`routes/api.ts:1559` → `eraseChild`) and export (`routes/api.ts:1534`). A fixed-horizon purge, if ever contractually required, must be an app-level scheduled job keyed on `createdAt`, because `memoryEvents` docs intentionally have no `expireAt` field.

### Apply steps (REL-6)
1. **Merge the indexes** into `/firestore.indexes.json`. Two equivalent ways:
   - **Hand-append:** copy the two objects under `__additions__.indexes` into the live file's `indexes` array (append after the existing entry). Keep `fieldOverrides: []`.
   - **Or replace wholesale:** copy `__merged_preview__` (the `indexes` + `fieldOverrides` keys only) over the live file's body. The preview already contains all three indexes in the correct order.
   - **INVARIANT:** the existing `memoryEvents (childId ASC, createdAt ASC)` entry stays verbatim and first. Removing it breaks the live `listEvents()` query.
2. **Validate:** `npx firebase-tools deploy --only firestore:indexes --dry-run --project <PROD_PROJECT_ID>` (or just confirm the file parses). On merge to `main`, indexes ship automatically — `arbor-deploy.yml:111` already runs `firebase deploy --only hosting,firestore`.
3. **Verify live:** `gcloud firestore indexes composite list --project <PROD_PROJECT_ID>` → the two new indexes show `READY`.
4. **Enable the `aiQuota` TTL** (HUMAN / GCP gate — not deployable from the repo):
   - `gcloud firestore fields ttls update expireAt --collection-group=aiQuota --enable-ttl --project <PROD_PROJECT_ID>`
   - Verify: `gcloud firestore fields ttls describe expireAt --collection-group=aiQuota --project <PROD_PROJECT_ID>`
   - Rollback: same command with `--disable-ttl`.
5. **Record** the TTL + retention decision in the DPIA security-measures / storage-limitation section (data-minimisation; GDPR/AVG Art. 5(1)(e); IL Amendment 13).

---

## B. SEC-8 — Supply-chain scanning in CI

### What it adds (grounded in real CI)
Live `arbor-ci.yml` has a single job `app-quality-gates` running `npm ci → lint → test → check:framework → eval:safety → build`. There is **no** dependency/container/secret scanning. `ci-security-job.yml` adds a **separate `security` job** that runs **in parallel, off the fast path** (no `needs:` on the quality gates), with every scan **non-blocking** (`continue-on-error`) until the team promotes it:

- **`npm audit --audit-level=high`** in `app/` (Dependabot complements it).
- **Trivy** filesystem scan (source + lockfile) + **Trivy image** scan of the Cloud Run image, built with the **same `docker build -f app/Dockerfile … .`** invocation as `cloudbuild.prod.yaml:20-27` (context = repo root). Image is local-only, never pushed. SARIF uploaded to the Security tab.
- **Syft SBOM** (CycloneDX) of the image, retained 90 days as a build artifact (EU/B2G tenders increasingly request an SBOM).
- **gitleaks** secret scan (full history, `fetch-depth: 0`), with a license-free CLI fallback commented inline.

Stack is **100% free** in GitHub Actions (Dependabot, npm audit, Trivy, Syft, gitleaks). Snyk is intentionally **not** used (paid) — per SEC-8 the free stack is preferred.

### Apply steps (SEC-8)
1. **Add the `security` job** to `.github/workflows/arbor-ci.yml`:
   - Open `ci-security-job.yml`, take the `security:` block under `jobs:`, and paste it into the `jobs:` map of `arbor-ci.yml` as a **sibling** of `app-quality-gates`. Do **not** add `needs:`, and do **not** put it under the existing job's `defaults.run.working-directory: app` (the security job sets its own per-step working dirs).
   - *(Alternative — Option B in the file header: save the block as a standalone `.github/workflows/arbor-security-scan.yml` and uncomment the `name:`/`on:` keys at the top.)*
2. **Create `.github/dependabot.yml`** (NEW file): copy the inlined block at the bottom of `ci-security-job.yml` (npm `/app` weekly + github-actions `/` weekly, grouped to keep PR noise low).
3. **Enable repo settings** (HUMAN gate — GitHub repo admin, not in-repo): Settings → Code security and analysis → enable **Dependabot alerts**, **Secret scanning**, and **Push protection**. gitleaks in CI is belt-and-suspenders on top of native secret scanning.
4. **For a private repo only:** gitleaks-action needs `GITLEAKS_LICENSE` (org free tier) — or switch to the commented license-free CLI step in the file.
5. **Promote to blocking when ready:** remove `continue-on-error: true` and set Trivy `exit-code: '1'` (and drop the `|| true` on npm audit) once the backlog is triaged. Keep non-blocking for the first ≥1 release so the quality gates stay green.
6. **Verify:** open a PR; the `security` job runs alongside `app-quality-gates`; Trivy SARIF appears in the Security tab; the `arbor-api-sbom` artifact attaches; Dependabot opens its first PRs after `.github/dependabot.yml` lands.

---

## Human / out-of-band gates (cannot be done from the repo)
- **REL-6:** the `aiQuota` TTL enable is a `gcloud firestore fields ttls` op against the **prod project** — requires GCP access.
- **SEC-8:** enabling **Dependabot alerts + Secret scanning + Push protection** is a **GitHub repo-admin setting**; a private-repo gitleaks license is org-level.
- Everything else (index JSON merge, CI job paste, `dependabot.yml` creation) is a plain in-repo edit a clean-baseline run can apply directly.

## Rollback
- **Indexes** are additive; a never-used index is safe to delete. **Never delete** the existing `memoryEvents (childId, createdAt ASC)` entry.
- **TTL:** `--disable-ttl` reverts instantly.
- **CI security job:** delete the job / workflow; gates are non-blocking until explicitly promoted, so it cannot red-line the pipeline in the meantime.
