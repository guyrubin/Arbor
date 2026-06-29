# CMEK Evaluation & Decision Record — Firestore + Cloud Storage

**Mission:** SEC-9 (Wave-0, Security / NIST CSF 2.0)
**Status:** **DECISION = DEFER.** Google-managed encryption (GMEK) is retained for the consumer launch. CMEK is **not adopted now**; this record is the ready-to-execute activation runbook, triggered by a signed B2G contract clause.
**Date:** 2026-06-17
**Author:** Principal Engineer / Compliance Lead, Architecture Advisory
**Scope:** Cloud Firestore (`firestoreDatabaseId = "(default)"`, `europe-west4`) and the Firebase Cloud Storage bucket holding child photos.
**Markets in scope:** Netherlands (GDPR + Dutch AVG/AP, DPIA mandatory) and Israel (Privacy Protection Law + Amendment 13, in force Aug 2025).

> This is a decision-record + dormant runbook. It changes **no** code or infra today. On a B2G trigger it is activated as written. Key destruction is irreversible — see §7.

---

## 1. TL;DR / Decision

| Question | Answer |
|---|---|
| Is CMEK adopted for the consumer launch? | **No. Defer.** |
| Is the current state compliant for NL + IL? | **Yes.** Data at rest is encrypted with **Google-managed keys (GMEK)** by default. GMEK satisfies GDPR/AVG Art. 32 and Israeli law for the consumer launch. CMEK is **not legally required** for either market. |
| When does CMEK become required? | **Only when a B2G contract / DPA clause demands customer-managed keys** (some Dutch municipalities, JGZ/consultatiebureau, schools, or health insurers may require it in procurement). It is a **B2G upsell/gate, not a launch blocker.** |
| Biggest technical constraint? | **Firestore CMEK must be chosen at database creation.** An existing `(default)` database **cannot** be converted in place. Activation requires a **new CMEK-enabled database** + data migration (or a fresh CMEK database per B2G tenant). |
| Biggest risk introduced by CMEK? | **Availability + irreversibility.** A Cloud KMS outage, a revoked/disabled key, or a **destroyed** key makes the data **permanently unreadable**. CMEK trades a small confidence gain for a real availability/operational liability. |
| Cost? | KMS itself is cheap (key version ~**$0.06/mo** + ~**$0.03 / 10k crypto ops**). The real cost is **migration effort + ongoing key-lifecycle operations + the availability dependency**, which is why it is deferred until a contract pays for it. |

**Recommendation:** Stay on Google-managed keys. Keep this runbook dormant. Activate on contract signature using the per-tenant CMEK-database pattern (§5), not an in-place conversion (which is impossible for Firestore).

---

## 2. What is encrypted today (grounded in the real code)

All Arbor data at rest is **already encrypted** with Google-managed keys (GMEK) — this is automatic and free on GCP. The two CMEK-relevant data stores are:

1. **Cloud Firestore** — the system of record for families, children, behavior logs, milestones, plans, AI runs, safety reviews.
   - Database id is configurable: `firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || "(default)"` — `app/src/config/env.ts:111` (type at `:26`). **Prod runs the `(default)` database** (the env var is not set in `cloudbuild.prod.yaml`'s line-49 env string).
   - Region: `europe-west4` (`gcpRegion`/`vertexLocation` defaults, `env.ts:99–100`; `_REGION: europe-west4` in `cloudbuild.prod.yaml`). **EU residency is already met.**

2. **Firebase Cloud Storage** — holds **child photographs**: `uploadChildPhoto()` writes to `users/{uid}/children/{childId}/photos/{ts}.jpg` (`app/src/lib/storage.ts:9–14`). Bucket is `VITE_FIREBASE_STORAGE_BUCKET` (`app/src/lib/firebase.ts:23`, `getStorage` at `:57`).
   - **Note:** child photos are higher-sensitivity PII than the structured Firestore data. If any single store justifies CMEK first under a B2G DPA, it is the **Storage bucket**, because Storage CMEK can be applied **per-bucket without a migration** (unlike Firestore — see §3).

**Out of scope / not persisted by us:** Vertex AI processes redacted, minimized prompts (see SEC-3) transiently; it is not a customer-data-at-rest store we own and is not a CMEK target here. Cloud Run holds no durable customer data.

---

## 3. The hard Firestore constraint — CMEK is a database-creation-time choice

This is the single most important fact in this record and it shapes the entire activation plan.

- **Firestore CMEK can only be set when the database is created.** There is **no in-place conversion** of an existing database from Google-managed to customer-managed keys, and no way to change the key *resource* of an existing CMEK database afterward.
- Our production database is the **`(default)`** database created without CMEK. Therefore activating CMEK is **not** an "enable a flag" operation — it requires:
  - creating a **new** Firestore database (a non-default named database, e.g. `arbor-b2g` or `(<tenant>)`) with `--cmek-config` / `kms-key-name` set **at create time**, in `europe-west4`; **and**
  - a **data migration / backfill** from `(default)` into the CMEK database (or provisioning the B2G tenant on its CMEK database from day one so no migration is needed).
- The app already supports pointing at a non-default database via `FIRESTORE_DATABASE_ID` (`env.ts:111`), so **no app code change** is needed to *use* a CMEK database — only the env var in `cloudbuild.prod.yaml`'s line-49 string and the migration.

**Contrast — Cloud Storage CMEK is easier:** a bucket's default KMS key **can** be set/changed after creation (`gcloud storage buckets update --default-encryption-key=...`). New objects get the new key; existing objects keep their old key until rewritten. So the **Storage** child-photo bucket can adopt CMEK with a key-set + optional object rewrite, **no new bucket and no Firestore-style migration**. This asymmetry should drive the activation order (Storage first, Firestore via new DB).

---

## 4. When CMEK is required vs. not — the trigger model

### 4.1 Not required (current state — consumer launch)
- **NL:** GDPR/AVG Art. 32 requires "appropriate technical measures." **GMEK is an appropriate measure**; the Dutch AP has never mandated customer-managed keys for a consumer app. The mandatory DPIA (children + profiling) is satisfied on encryption by recording that data at rest is encrypted (GMEK) and that EU residency (`europe-west4`) is enforced.
- **IL:** EU adequacy + `europe-west4` residency satisfy the Privacy Protection Law. **Amendment 13** raises accountability and "reasonable security measures" but does **not** require customer-managed keys for the consumer launch. GMEK clears the bar.

### 4.2 Required (the B2G trigger)
Adopt CMEK **only** when a specific, signed (or near-certain) institutional contract obliges it. Concrete trigger clauses to watch for in a DPA / procurement questionnaire:

- "Encryption keys must be **customer-managed** / under the controller's control / held in the controller's KMS."
- "The processor must demonstrate the ability to **revoke access to data by disabling encryption keys**" (a crypto-shredding / kill-switch requirement).
- "Keys must be **rotated on a defined schedule** under the controller's policy."
- Institutional counterparties most likely to ask: Dutch **municipalities (gemeenten)**, **JGZ / consultatiebureau** (youth health), **schools**, and **health insurers (zorgverzekeraars)**; in IL, public-sector or health-adjacent buyers.

**Decision rule:** No such clause → stay on GMEK. Clause present and contract value justifies the operational cost → activate via §5. **Do not** pre-emptively migrate the consumer `(default)` database "to be safe" — it adds availability risk for zero compliance gain.

---

## 5. Activation runbook (execute ONLY on trigger)

Preferred model: **per-tenant CMEK database** for the B2G tenant, leaving the consumer `(default)` database on GMEK untouched. This isolates the availability risk to the tenant who demanded CMEK and avoids migrating consumer data.

All resources in **`europe-west4`** (co-region with data residency — KMS key region must match the data location).

### 5.0 Prerequisites / human-gated
- A signed B2G contract clause requiring CMEK (the trigger). **Legal sign-off.**
- A GCP principal with Owner/Security Admin on the prod project to create KMS + the new database (console/gcloud — **a human, not an agent**).
- Decide ownership of the KMS keys: same project vs. a dedicated **key-management project** (recommended for B2G so key admin is separated from data admin — supports "controller holds the keys" framing).

### 5.1 Create the KMS key ring + key
```bash
# Region MUST equal the data region (europe-west4).
gcloud kms keyrings create arbor-cmek \
  --location=europe-west4 --project=<KMS_PROJECT>

gcloud kms keys create firestore-key \
  --location=europe-west4 --keyring=arbor-cmek \
  --purpose=encryption \
  --rotation-period=90d --next-rotation-time=+90d \
  --project=<KMS_PROJECT>

gcloud kms keys create storage-key \
  --location=europe-west4 --keyring=arbor-cmek \
  --purpose=encryption \
  --rotation-period=90d --next-rotation-time=+90d \
  --project=<KMS_PROJECT>
```

### 5.2 Grant the Google service agents Encrypter/Decrypter on the keys
CMEK is used by the **Firestore** and **Cloud Storage** service agents (not the app/deploy SA directly). Grant `roles/cloudkms.cryptoKeyEncrypterDecrypter` on each key to the relevant service agent:

```bash
# Firestore service agent
gcloud kms keys add-iam-policy-binding firestore-key \
  --location=europe-west4 --keyring=arbor-cmek \
  --member="serviceAccount:service-<PROJECT_NUMBER>@gcp-sa-firestore.iam.gserviceaccount.com" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" --project=<KMS_PROJECT>

# Cloud Storage service agent
gcloud kms keys add-iam-policy-binding storage-key \
  --location=europe-west4 --keyring=arbor-cmek \
  --member="serviceAccount:service-<PROJECT_NUMBER>@gs-project-accounts.iam.gserviceaccount.com" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" --project=<KMS_PROJECT>
```
> The runtime Cloud Run SA does **not** need a KMS role for Firestore/Storage CMEK — the service agents do the envelope encryption transparently. (If a future feature uses the KMS API directly, grant the runtime SA the encrypter/decrypter role on that specific key only — least privilege.)

### 5.3 Firestore — create the CMEK database (NO in-place conversion)
```bash
# A NEW named database — CMEK is fixed at create time and cannot be added later.
gcloud firestore databases create \
  --database=arbor-b2g \
  --location=europe-west4 \
  --type=firestore-native \
  --kms-key-name=projects/<KMS_PROJECT>/locations/europe-west4/keyRings/arbor-cmek/cryptoKeys/firestore-key \
  --project=<PROJECT_ID>
```
Then point the API at it (for the B2G tenant deployment only) by adding to the `cloudbuild.prod.yaml` line-49 env string:
```
@FIRESTORE_DATABASE_ID=arbor-b2g
```
(Already supported by `env.ts:111` — no app code change.)

**Migration (only if existing data must move):** export from `(default)` and import into the CMEK database via managed export/import to GCS, then re-point the env var. For a clean B2G tenant, provision on the CMEK database from day one and skip migration entirely.
```bash
gcloud firestore export gs://<MIGRATION_BUCKET>/export-$(date +%F) \
  --database="(default)" --project=<PROJECT_ID>
gcloud firestore import gs://<MIGRATION_BUCKET>/export-<date> \
  --database=arbor-b2g --project=<PROJECT_ID>
```

### 5.4 Cloud Storage — set the bucket default CMEK key (can be done in place)
```bash
gcloud storage buckets update gs://<CHILD_PHOTOS_BUCKET> \
  --default-encryption-key=projects/<KMS_PROJECT>/locations/europe-west4/keyRings/arbor-cmek/cryptoKeys/storage-key
```
New objects (child photos) are then CMEK-encrypted. To bring existing objects under CMEK, rewrite them (`gcloud storage objects update --encryption-key=...` or a rewrite pass). The Storage rules/path (`users/{uid}/children/{childId}/photos/...`, `storage.ts:11`) are unchanged.

### 5.5 Verify, then prove control
- Read/write against the CMEK Firestore database and upload a child photo to the CMEK bucket in a **staging** project.
- **Prove the CMEK kill-switch:** disable the key version and confirm data becomes inaccessible (this is the capability the B2G clause is buying), then **re-enable** — never destroy during a test (see §7).

---

## 6. Cost

| Item | Cost (europe-west4, indicative) | Notes |
|---|---|---|
| KMS key version (active) | ~**$0.06 / version / month** | 2 keys (Firestore, Storage) ≈ $0.12/mo; rotation adds versions over time, each billed while enabled. |
| KMS crypto operations | ~**$0.03 / 10,000 operations** | Envelope encryption is low-frequency (data-encryption keys are cached); negligible at Arbor's volume. |
| Firestore CMEK storage/ops surcharge | Small uplift on Firestore storage + operations vs. GMEK | Order of a low single-digit % on the Firestore line; immaterial at launch scale. |
| **Migration effort (one-time)** | **Engineering time** | Export/import + re-point + validation. The dominant cost. |
| **Key-lifecycle operations (ongoing)** | **Engineering/ops time** | Rotation policy, monitoring, IAM on the key, incident runbook for a KMS outage. The real recurring cost. |

**Bottom line:** the *infrastructure* cost is trivial (cents/month). The reason to defer is the **migration + operational + availability** cost, which only a paying B2G contract justifies.

---

## 7. Risk register (the case for deferral)

| Risk | Severity | Mitigation / why we defer |
|---|---|---|
| **Destroyed key = permanent data loss.** Destroying a CMEK key version (or scheduling destruction) renders all data encrypted under it **irreversibly unreadable.** | **Critical** | Do not adopt without need. On activation: enforce a long key-destruction scheduled-duration (e.g. 30 days), restrict `cloudkms.cryptoKeyVersions.destroy` via IAM to a break-glass principal, alert on any destroy/disable. **Never** run a destroy in a test — use disable/re-enable. |
| **KMS outage / key disabled = availability incident.** If KMS is unavailable or the key is disabled, Firestore/Storage cannot decrypt and the app fails reads/writes for that tenant. | High | Co-region KMS with data (`europe-west4`); monitor key state + KMS availability; document a recovery runbook. This availability dependency does **not exist** under GMEK — a direct argument for deferral. |
| **Firestore cannot convert in place** — surprises a team mid-contract if not planned. | High (operational) | This record pre-plans the new-database + per-tenant pattern (§3, §5.3) so the trigger does not cause a scramble. |
| **Mis-scoped KMS IAM** (over-granting encrypter/decrypter). | Medium | Grant only the specific service agents on the specific keys (§5.2); separate key-management project for B2G. |
| **False sense of security.** CMEK does not protect data in use or in transit, nor against application-layer access. | Medium | Pair with SEC-3 (redaction/minimization), SEC-5 (Firestore ownership rules), SEC-6 (App Check). CMEK is one control, not a substitute. |

---

## 8. Compliance mapping

- **NIST CSF 2.0:** PR.DS-01 (data-at-rest protection) — **met by GMEK today**; CMEK raises the customer-control posture for PR.DS when contractually required. Relates to PR.AA / GV.SC for the B2G procurement context.
- **GDPR / AVG (NL):** Art. 32 (security of processing) — GMEK is an appropriate measure; **record in the DPIA** that data at rest is encrypted and EU-resident (`europe-west4`), and that CMEK is available on a B2G trigger. CMEK is **not** an Art. 35 DPIA prerequisite for the consumer launch.
- **Israel Amendment 13:** "reasonable security measures" + accountability — GMEK + EU adequacy clears the consumer bar; CMEK is the optional B2G upgrade, same as NL.

**DPIA line to record now:** *"Customer data at rest in Firestore and Cloud Storage is encrypted using Google-managed keys (GMEK), resident in europe-west4. Customer-managed encryption keys (CMEK) have been evaluated (SEC-9) and are deferred; they are activatable per-tenant on a B2G contractual requirement without re-architecture (Firestore via a new CMEK database; Storage via bucket default-key)."*

---

## 9. Dependencies, rollback, sign-off

- **Dependencies:** soft on SEC-4 (keyless deploy) and SEC-6 (App Check) for the full B2G posture; none blocking this doc.
- **Rollback:** N/A for the decision (no change made). CMEK **activation is a forward-only migration** — key destruction is irreversible; a "rollback" from a CMEK tenant means re-exporting to a GMEK database, not flipping a switch.
- **Re-evaluation trigger:** any B2G DPA/procurement clause requiring customer-managed keys, key revocation capability, or controller-defined rotation. Until then: **no action.**

---

### Appendix A — pointers to the real code/infra
- `app/src/config/env.ts:26, :99–100, :111` — `firestoreDatabaseId`, region defaults, `(default)` database.
- `cloudbuild.prod.yaml:18–24` (image/region), line-49 env string (no `FIRESTORE_DATABASE_ID` today; this is where `@FIRESTORE_DATABASE_ID=arbor-b2g` is added on activation), `_REGION: europe-west4`.
- `app/src/lib/firebase.ts:10, :23, :57` — Storage client init / bucket.
- `app/src/lib/storage.ts:9–14` — child-photo upload path `users/{uid}/children/{childId}/photos/{ts}.jpg` (the highest-sensitivity CMEK target).
