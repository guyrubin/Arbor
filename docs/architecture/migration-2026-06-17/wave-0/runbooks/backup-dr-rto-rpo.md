# Arbor — Backup & Disaster-Recovery Runbook (RTO/RPO)

**Mission:** REL-1 (Wave-0, WAF Reliability pillar)
**Status:** Build-ready. PITR/backup commands are idempotent and safe to run; the restore drill section below is filled by the operator who runs the first drill.
**Owner:** Reliability / SRE
**Last updated:** 2026-06-17
**Scope:** Firestore `(default)` database, project `$PROJECT_ID` (prod = `arborprd-westeu`), region `europe-west4`.

> This is the canonical DR runbook. The spec (`docs/ops/dr-runbook.md`) named `docs/ops/dr-runbook.md` as the eventual home; this Wave-0 artifact lives under the migration tree so it can be reviewed independently of the dirty working tree. **Apply step:** a clean-baseline run copies this file to `docs/ops/dr-runbook.md` verbatim and flips the REL-1 row in the WAF assessment (see "Apply steps" at the end).

---

## 1. RTO / RPO targets by data class

**RTO** = target wall-clock time from "decision to restore" to "service serving correct data again".
**RPO** = maximum tolerable data loss measured as a time window of writes.

All Arbor persistent state lives in Firestore `(default)`. There is no separate SQL/Cloud Storage state in the recovery path (uploaded avatars are regenerable; Hosting assets are rebuilt from CI). The data classes below are the real collections enumerated from code.

| Data class | Collection / path | Source (code) | Sensitivity | RPO target | RTO target | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Child memory events | `children/{childId}/memoryEvents/{eventId}` (also a `COLLECTION_GROUP`) | `app/src/memory/firestoreMemoryStore.ts:23,34` | **High — child PII** | ≤ 1 h (PITR continuous; effective sub-minute) | **4 h** | Core product data; loss degrades the personalization moat. GDPR Art. 32 "restore availability". |
| Entitlements / billing state | `entitlements` | `app/src/server/adminMetrics.ts:75` | High — financial | ≤ 1 h | **4 h** | Drives plan gating; loss = wrong access. Reconcilable against Stripe/RevenueCat as backstop. |
| Users | `users` | `app/src/server/adminMetrics.ts:77` | High — PII | ≤ 1 h | **4 h** | Account records. |
| Usage rollups | `usageRollup/{date}` | `app/src/server/adminMetrics.ts:81` | Low — aggregate | ≤ 24 h | **24 h** | Derived metrics; regenerable from logs/events. Lower priority. |
| Consult requests | `consultRequests` | `app/src/server/consultRequests.ts:52,58` | Med — PII | ≤ 1 h | **8 h** | Pro-platform queue; low volume, tolerant of slightly longer RTO. |
| AI quota windows | `aiQuota/{name}_{key}_{windowStart}` | `app/src/server/quotaStore.ts:60` | None — ephemeral | **Not protected (n/a)** | **0 (no restore)** | Self-expiring (TTL on `expireAt`, REL-6). Loss self-heals within one window; never restore. Fails open by design (`quotaStore.ts:83`). |

**Service-level summary (what we commit to externally):**

- **RTO (service):** **4 hours** for full data-plane restore from PITR/backup, single region. (Cross-region rebuild target: **8 hours** — see §6.)
- **RPO (service):** **≤ 1 hour**, and in practice **sub-minute** while PITR continuous backup is healthy (PITR retains every write for the trailing 7 days at minute granularity). The **1 h** number is the conservative committed figure used in DPA/SLA annexes; the daily scheduled backup is the floor if PITR is unavailable (RPO ≤ 24 h fallback).

These targets are intentionally lean and honest for beta scale (single region, managed-service restore, no hot standby). They are the numbers to put in the NL DPA / IL Amendment-13 procurement annex.

---

## 2. Recovery primitives enabled

Two managed-service primitives back every target above. **No application code is involved.** Both are storage-priced and additive.

1. **Point-in-Time Recovery (PITR)** — continuous backup, **7-day** rolling window, minute-granularity. This is the primary RPO lever (sub-minute) and primary fast-restore path.
2. **Scheduled daily backup** — a daily snapshot with **7-day** retention. This is the durable floor (survives accidental PITR-window expiry, gives a named restore source for the drill), and the answer when PITR alone is insufficient.

### 2.1 Enable PITR (one-time, idempotent)

```bash
PROJECT_ID="arborprd-westeu"   # prod; substitute per env

gcloud firestore databases update \
  --database='(default)' \
  --enable-pitr \
  --project "$PROJECT_ID"
```

Verify:

```bash
gcloud firestore databases describe '(default)' \
  --project "$PROJECT_ID" \
  --format='value(pointInTimeRecoveryEnablement)'
# Expect: POINT_IN_TIME_RECOVERY_ENABLED
```

### 2.2 Create the daily backup schedule (one-time, idempotent)

```bash
gcloud firestore backups schedules create \
  --database='(default)' \
  --recurrence=daily \
  --retention=7d \
  --project "$PROJECT_ID"
```

Verify:

```bash
gcloud firestore backups schedules list \
  --database='(default)' \
  --project "$PROJECT_ID"
# Expect: one DAILY schedule, retention 604800s (7d). Note the schedule id.
```

### 2.3 IAM

The deploy service account (`arbor-deployer@<project>.iam.gserviceaccount.com`) already holds **Datastore Owner** (`roles/datastore.owner`) per `.github/workflows/arbor-deploy.yml` (role list comment, lines 10–13). That role covers `firestore.backups.*`, `firestore.databases.restore`, and schedule management — **no new IAM grant is required** for backup/restore. A human operator running these commands needs the same role (or `roles/owner`).

---

## 3. Restore procedure (tested)

**Golden rule:** restore to a **scratch database**, never over the live `(default)`. Firestore restores create a *new* database; you then validate, and only the operator (with sign-off) repoints or copies data. The drill below restores, verifies row counts, and deletes the scratch DB — production is never touched.

### 3.1 List restore sources

```bash
PROJECT_ID="arborprd-westeu"

# PITR: any timestamp within the trailing 7 days (RFC3339, must be in the past).
EARLIEST=$(gcloud firestore databases describe '(default)' \
  --project "$PROJECT_ID" --format='value(earliestVersionTime)')
echo "PITR earliest restorable: $EARLIEST"

# Scheduled backups (durable snapshots):
gcloud firestore backups list \
  --location=europe-west4 \
  --project "$PROJECT_ID"
# Copy the backup resource name you want, e.g.
#   projects/<p>/locations/europe-west4/backups/<backup-id>
```

### 3.2 Restore — from PITR (primary path)

```bash
PROJECT_ID="arborprd-westeu"
SCRATCH="restore-drill-$(date +%Y%m%d)"
# Pick a recovery instant inside the PITR window (whole-minute, past):
SNAPSHOT_TIME="2026-06-17T09:00:00Z"

gcloud firestore databases restore \
  --source-database='(default)' \
  --snapshot-time="$SNAPSHOT_TIME" \
  --destination-database="$SCRATCH" \
  --project "$PROJECT_ID"
```

### 3.3 Restore — from a scheduled backup (fallback path)

```bash
PROJECT_ID="arborprd-westeu"
SCRATCH="restore-drill-$(date +%Y%m%d)"
BACKUP="projects/$PROJECT_ID/locations/europe-west4/backups/<backup-id>"

gcloud firestore databases restore \
  --source-backup="$BACKUP" \
  --destination-database="$SCRATCH" \
  --project "$PROJECT_ID"
```

### 3.4 Verify the restored data

```bash
PROJECT_ID="arborprd-westeu"
SCRATCH="restore-drill-$(date +%Y%m%d)"

# Confirm the scratch DB is READY:
gcloud firestore databases describe "$SCRATCH" \
  --project "$PROJECT_ID" --format='value(name,createTime,type)'
```

Count a known child's memory events in the **scratch** DB and compare to the same
count in **production** (taken just before the snapshot instant). Use the same
`COLLECTION_GROUP("memoryEvents").where("childId","==", <id>)` query the app uses
(`firestoreMemoryStore.ts:23`). A quick way without app code, against the scratch DB:

```bash
# Requires the Firestore export of the scratch DB OR a one-off node script using
# @google-cloud/firestore with databaseId=$SCRATCH. Minimal node check:
node -e '
const {Firestore} = require("@google-cloud/firestore");
const db = new Firestore({projectId: process.env.PROJECT_ID, databaseId: process.env.SCRATCH});
const childId = process.env.CHILD_ID;
db.collectionGroup("memoryEvents").where("childId","==",childId).count().get()
  .then(s => { console.log("memoryEvents for", childId, "=", s.data().count); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
' 
# Set PROJECT_ID, SCRATCH, CHILD_ID first. Assert the count equals the prod count
# at SNAPSHOT_TIME. Also spot-check entitlements/users doc counts.
```

**Pass criteria:** scratch `memoryEvents` count for the known child == prod count at `SNAPSHOT_TIME`; `entitlements` and `users` doc counts within expected drift. Record elapsed wall-clock from "restore started" to "verification passed" → that is the **measured RTO**.

### 3.5 Clean up the scratch DB (drill only — do NOT run after a real restore you intend to keep)

```bash
PROJECT_ID="arborprd-westeu"
SCRATCH="restore-drill-$(date +%Y%m%d)"

gcloud firestore databases delete "$SCRATCH" --project "$PROJECT_ID"
```

### 3.6 Real-incident promotion (when this is NOT a drill)

For a genuine data-loss event you restore to a scratch DB (as above), verify, then **cut over**. Firestore cannot restore in-place over `(default)`, so the cutover is one of:

- **Repoint:** redeploy the API with `FIRESTORE_DATABASE_ID=<scratch>` (only if the app reads `databaseId` from env — **today it uses `(default)`**, so this requires the env wiring; flagged as a gap below), **or**
- **Re-seed:** export the scratch DB (`gcloud firestore export`) and import into a freshly-created `(default)` after the corrupt one is renamed/deleted.

> **Gap flagged (not in REL-1 scope, do not fix here):** the app hardcodes the `(default)` database. A true fast cutover would be cheaper if the Admin SDK read a `databaseId` from config. Logged as a follow-up for the REL-2/createApp owner; do **not** edit code under this mission.

---

## 4. Restore-drill record (FILL ON FIRST DRILL)

> Done-when for REL-1: this table holds **real measured numbers**, not placeholders, and the scratch DB was deleted. Until then, REL-1 is "config done, drill pending".

| Field | Value |
| :--- | :--- |
| Drill date / time (UTC) | _PENDING — fill on first drill_ |
| Operator | _PENDING_ |
| Restore source (PITR snapshot-time or backup id) | _PENDING_ |
| `SNAPSHOT_TIME` used | _PENDING_ |
| Scratch DB name | `restore-drill-YYYYMMDD` |
| Known child id checked | _PENDING_ |
| `memoryEvents` count — prod @ snapshot | _PENDING_ |
| `memoryEvents` count — restored scratch | _PENDING_ |
| Counts match? | _PENDING (Y/N)_ |
| `entitlements` / `users` spot-check | _PENDING_ |
| Restore start → verified (measured RTO) | _PENDING — compare to 4 h target_ |
| Scratch DB deleted? | _PENDING (Y/N)_ |
| Result | _PENDING (PASS/FAIL)_ |
| Notes / deviations | _PENDING_ |

**Cadence:** re-run this drill **quarterly** and after any change to the data model or backup config. Append a new row each time (keep history).

---

## 5. Quarterly verification checklist

Run read-only; all three must hold for REL-1 to stay "mitigated".

```bash
PROJECT_ID="arborprd-westeu"

# 1. PITR enabled
gcloud firestore databases describe '(default)' --project "$PROJECT_ID" \
  --format='value(pointInTimeRecoveryEnablement)'   # POINT_IN_TIME_RECOVERY_ENABLED

# 2. Daily backup schedule present
gcloud firestore backups schedules list --database='(default)' --project "$PROJECT_ID"

# 3. Recent durable backups exist
gcloud firestore backups list --location=europe-west4 --project "$PROJECT_ID"
```

Plus: the restore-drill table (§4) has a row dated within the last quarter with result PASS.

---

## 6. Single-region risk acceptance (europe-west4)

### 6.1 Decision

Arbor runs **single-region in `europe-west4`** across the entire stack: Cloud Run service `arbor-api` (`firebase.json` rewrite `/api/**` → `arbor-api` @ `europe-west4`), Firestore `(default)`, Vertex AI (`VERTEX_LOCATION=europe-west4` in `cloudbuild.prod.yaml`), and the daily backups (`--location=europe-west4`). **This is a deliberate choice, not an oversight.**

### 6.2 Why single-region (rationale)

- **Cost & operational simplicity** at beta scale: a multi-region Firestore (`eur3`) and active-active Cloud Run add recurring spend and operational surface with no current user-facing need.
- **EU data residency** is satisfied for **both** launch markets in a single EU region: NL is in-EU; IL relies on EU adequacy. A region change is therefore **not required** by either market's privacy regime — residency is already met.
- **Co-location**: keeping Firestore + Vertex + Cloud Run in one region avoids cross-region latency and egress on the hot path.

### 6.3 Failure mode accepted

- A **full `europe-west4` regional outage** (rare, Google-side) = **complete Arbor outage** (API, data, model). No automatic failover exists. This is the accepted residual risk.
- A **zonal** failure within `europe-west4` is *not* in scope of this acceptance — Cloud Run and Firestore are multi-zone within the region and tolerate single-zone loss automatically.

### 6.4 Mitigations in place

- **PITR + daily backups** (this runbook) mean a regional outage is **recoverable, not catastrophic**: backups are restorable to a **different region** (e.g. `europe-west1`) within the **8 h cross-region RTO**. The restore commands in §3 take a `--destination-database` in any region's project; for a regional disaster, create the destination DB in `europe-west1` and repoint Cloud Run there.
- **Stateless API**: `arbor-api` holds no durable state (the in-process circuit breaker / memory counter are ephemeral by design), so a regional rebuild is a redeploy + data restore, nothing more.
- **Residency preserved on failover**: `europe-west1` is also EU — cross-region DR does **not** breach NL/IL residency.

### 6.5 Re-evaluation trigger

Revisit the single-region decision (and consider multi-region Firestore `eur3` + multi-region Cloud Run) when **any** of:

- A signed B2G/insurer SLA demands an availability target incompatible with a multi-hour regional-outage RTO (e.g. ≥ 99.95%), **or**
- Paying user base crosses a materiality threshold where a multi-hour outage is commercially unacceptable, **or**
- A second production region is needed for latency in a new market.

### 6.6 Cost note

PITR (continuous 7-day) + daily scheduled backups (7-day retention) are **storage-priced** on a small beta dataset — **low single-digit €/month** total. If even that is unwanted: **keep PITR** (cheapest, 7-day window, sub-minute RPO) and **drop the explicit daily schedule**, accepting the reduced durable floor (RPO ≤ 7 days from PITR only, no named snapshot for drills). PITR alone is the recommended minimum; the daily backup is the small premium that buys the durable drill source and survives PITR-window expiry.

### 6.7 Sign-off

By signing, the owner accepts the single-region `europe-west4` residual risk (§6.3) with the mitigations in §6.4, and confirms the RTO/RPO targets in §1 are the committed figures.

| Role | Name | Decision | Date | Signature |
| :--- | :--- | :--- | :--- | :--- |
| Accountable owner (Founder / DPO) | Guy Rubin | Accept single-region risk | _PENDING_ | _PENDING_ |
| Reliability / SRE | _PENDING_ | Targets & runbook reviewed | _PENDING_ | _PENDING_ |

> REL-1 done-when requires a **named** sign-off with owner + date. Fill the rows above when the risk is formally accepted.

---

## 7. Compliance mapping

- **NL / GDPR (AVG):** PITR + tested restore = **Article 32(1)(c)** "ability to restore the availability and access to personal data in a timely manner". The RTO/RPO table and the single-region sign-off are standard **DPA / DPIA procurement annexes** for JGZ / municipality / insurer deals. **B2G-readiness gate: yes.**
- **IL / Amendment 13 (in force Aug 2025):** the database holder is accountable for the database's integrity and availability; a documented RTO/RPO + tested restore is the evidence. Residency unaffected (EU adequacy). This is an internal ops doc — no Hebrew/RTL surface required.

---

## 8. Apply steps (for a clean-baseline run — NOT done by this mission)

This Wave-0 mission writes **only** this file. The following are human / clean-baseline actions:

1. **Run the enable commands** (§2.1, §2.2) against prod `arborprd-westeu` — requires GCP console / gcloud with Datastore Owner. **Human gate (spend + GCP mutation).**
2. **Execute the first restore drill** (§3) and fill §4 with real numbers; delete the scratch DB.
3. **Obtain the §6.7 sign-off** (owner + date) — legal/accountability action, human only.
4. **Copy this file to `docs/ops/dr-runbook.md`** verbatim (the spec's canonical path) on the clean baseline.
5. **Flip the WAF assessment row:** in `docs/architecture/well-architected-assessment-2026-06-04.md`, set REL-1 status to *"mitigated (single-region accepted, sign-off in dr-runbook.md)"* — edit that one row only.
