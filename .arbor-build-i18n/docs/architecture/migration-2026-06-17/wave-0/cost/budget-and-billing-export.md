# COST-3 — GCP Budget, Alerts & BigQuery Billing Export (FinOps baseline)

**Mission:** COST-3 (Spec E — Cost Optimization, the lowest-scoring WAF pillar at 2.5).
**Date:** 2026-06-17 · **Owner:** Founder / FinOps · **Type:** pure managed-service config, zero app code.
**Artifact (run this):** [`../artifacts/cost-budget.sh`](../artifacts/cost-budget.sh) — *not executed by the migration agent; a human runs it.*
**Grounding:** `cloudbuild.prod.yaml` (region `europe-west4`, Cloud Run service `arbor-api`, project = `$PROJECT_ID`), `app/src/server/admin.ts` (cost rate table), `app/src/ai/usage.ts` + `app/src/server/usageRollup.ts` (COST-2 token telemetry this reconciles against).

> **Why this mission exists.** There is no billing-platform config anywhere in the repo today — `cloudbuild.prod.yaml` only deploys Cloud Run, and the only cost visibility in the product is the in-app `usageRollup/{date}` Firestore doc surfaced at `GET /api/admin/overview`. That tells us *modelled* token cost from our own rate table; it does **not** tell us what Google actually bills for Vertex AI, Cloud Run, Firestore, egress, and storage. COST-3 closes that gap with (1) a hard budget + threshold alerts so a runaway never goes unnoticed, and (2) a BigQuery billing export so real spend is queryable and reconcilable against our token rollups.

---

## 0. What gets created

| Resource | Name (default) | Scope | Cost |
| :--- | :--- | :--- | :--- |
| Pub/Sub topic | `arbor-budget-alerts` | prod project | free |
| Email notification channel | "Arbor budget alerts (founder)" → `bguy.rubin@gmail.com` | Cloud Monitoring | free |
| Cloud Billing budget | `arbor-prod` | billing account, **filtered to the Arbor project** | free |
| BigQuery dataset | `billing_export` | **EU multi-region** | ~cents/month storage |

**Net effect on spend: SAVER.** Budgets and alerts are free; the billing-export table is a few cents/month of BigQuery storage at beta scale. No min-instances, no Redis, no new always-on infra.

---

## 1. Cross-market guardrails (NL AVG + IL PPL) — read before running

- **The BigQuery dataset MUST be EU multi-region** (`DATASET_LOCATION=EU`). The script hard-fails if it is anything else and refuses to run, and re-verifies the location if the dataset already exists. Billing rows are **not** child PII — they are cost/usage records (service, SKU, project, cost), never message content or child attributes — but B2G/municipality procurement scrutinises *every* data sink, and keeping billing metadata in-region is the defensible posture. EU residency also satisfies Israel's EU-adequacy stance, so there is no IL-specific conflict.
- **No personal data leaves the EU project.** The export contains no `userUid`, no prompt/response content. (The per-user *modelled* cost slice from COST-2 lives in Firestore `usageByUser/{uid}_{date}`, admin-gated and TTL'd — it is **not** part of this billing export and must never be joined into a non-EU sink.)
- **B2G-readiness:** soft gate. Procurement checklists ask for demonstrable cost governance; "spend is monitored against a hard budget with alerts" is exactly that control. PPL Amendment-13 (database accountability) is likewise satisfied — billing export carries no personal data, so no registration burden.

---

## 2. Budget thresholds & rationale

The budget is set on a **monthly amount** (`MONTHLY_BUDGET_EUR`, default **300 EUR** — set this above expected beta spend with headroom; tune as volume grows). Alerts fire on **actual** spend crossing each percentage, plus one **forecasted** 100% rule so an overrun is flagged before it lands:

| Threshold | Basis | What it means / who acts |
| :---: | :--- | :--- |
| **50%** | actual | Early heads-up. Normal mid-month checkpoint; no action unless trend is steep. |
| **80%** | actual | Watch. Confirm the burn matches user growth, not a leak (check `byProvider`/`byRoute` in `/api/admin/overview`). |
| **100%** | actual | Budget reached. Review the top cost service in the BigQuery export; decide whether to raise the budget or investigate. |
| **120%** | actual | Overrun. Hard signal something is wrong (runaway loop, abuse, mis-routed model). This is the trigger to consider the **COST-1 global fail-closed** token cap. |
| **100%** | **forecasted** | Projected to exceed by month-end — gives lead time to act before the actual 100% hit. |

**Synergy with COST-1 (follow-up, out of COST-3 scope):** the budget publishes a JSON message to `arbor-budget-alerts` on every crossing. A later follow-up can subscribe `app/src/server/digest.ts` so a **120% breach automatically flips `AI_GLOBAL_CAP_FAIL_CLOSED=true`**, hard-stopping AI spend during an incident. The Pub/Sub topic and the budgets-P4SA publish binding are created now so that wiring is a pure add-on later.

---

## 3. Routing of alerts

Two delivery paths, both configured by the script:
1. **Pub/Sub** (`arbor-budget-alerts`) — programmatic, for the COST-1 follow-up and any future automation. The Cloud Billing budgets service agent (`billing-budgets-p4sa@gcp-sa-billing-budgets.iam.gserviceaccount.com`) is granted `roles/pubsub.publisher` on the topic.
2. **Email** — the founder gets a Cloud Monitoring email channel (`bguy.rubin@gmail.com`) so alerts arrive without needing billing-admin role. Default IAM (billing admins) email path is left enabled as a backstop.

---

## 4. BigQuery billing export — the one console-only step

`bq`/`gcloud` **cannot** toggle the billing-export enable switch on GCP today. The script creates the EU dataset the export writes into; the enable itself is a ~2-minute console step:

1. Console → **Billing** → select billing account.
2. **Billing export** → **BigQuery export** → **EDIT SETTINGS** on **"Standard usage cost"**.
3. Project = the Arbor prod project, Dataset = `billing_export`, **SAVE**.
4. *(Optional)* repeat for **"Detailed usage cost"** if SKU-level granularity is wanted later.

Rows appear within **~24h** in `gcp_billing_export_v1_<BILLING_ACCOUNT_ID>` inside `billing_export`. Verify next day:

```sql
SELECT service.description AS svc, SUM(cost) AS eur
FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX_XXXXXX_XXXXXX`
WHERE DATE(_PARTITIONTIME) >= CURRENT_DATE() - 1
GROUP BY svc
ORDER BY eur DESC;
```

Expect **Vertex AI**, **Cloud Run**, and **Cloud Firestore** rows (those are the three services `arbor-api` drives).

---

## 5. Daily cost-by-service query (real Google spend)

Run-anytime, against the export. `_PARTITIONTIME` partition-prunes for cheap scans.

```sql
-- Daily cost by GCP service, last 30 days, EUR.
SELECT
  DATE(usage_start_time) AS day,
  service.description     AS service,
  ROUND(SUM(cost), 2)     AS cost_eur,
  ROUND(SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)), 2) AS credits_eur,
  ROUND(SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)), 2) AS net_eur
FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX_XXXXXX_XXXXXX`
WHERE _PARTITIONTIME >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 31 DAY)
GROUP BY day, service
ORDER BY day DESC, net_eur DESC;
```

---

## 6. Per-route / per-user / per-day cost dashboard query (ties to COST-2 telemetry)

The real billing export is service-level — it knows "Vertex AI cost €X today" but **not** which app *route* or *user* drove it. That dimension lives in our own COST-2 telemetry: `app/src/ai/usage.ts` `recordUsage()` emits one structured **`ai.usage`** Cloud Logging line per model call, carrying `route / provider / model / promptTokens / outputTokens / totalTokens / userUid / requestId`. To get a per-route/user/day **cost** view we apply the same rate table the app uses (`app/src/server/admin.ts` `RATES_EUR_PER_M`) to those token counts.

### 6a. Prerequisite — sink the `ai.usage` logs to BigQuery (one-time)

The `ai.usage` lines are in Cloud Logging, not BigQuery, until a log sink routes them. Create an EU dataset + sink (also runnable as a small extension of the script):

```bash
# EU dataset for the app-usage logs (keep app telemetry in-region too).
bq --project_id="$PROJECT_ID" mk --location=EU --dataset \
  --description="ai.usage log sink (COST-2 per-route/user token telemetry)" \
  "$PROJECT_ID:ai_usage_logs"

# Route only the structured ai.usage lines from the arbor-api Cloud Run service.
gcloud logging sinks create arbor-ai-usage-sink \
  "bigquery.googleapis.com/projects/$PROJECT_ID/datasets/ai_usage_logs" \
  --project "$PROJECT_ID" \
  --log-filter='resource.type="cloud_run_revision"
    AND resource.labels.service_name="arbor-api"
    AND jsonPayload.message="ai.usage"'

# Grant the sink's writer identity append rights on the dataset (printed by the create above).
# bq update --source <perms.json> "$PROJECT_ID:ai_usage_logs"   # add the sink SA as WRITER
```

Cloud Logging writes these into date-sharded tables `run_googleapis_com_stdout_YYYYMMDD` (or `jsonpayload`-typed tables) in `ai_usage_logs`. Field paths below assume the structured payload lands under `jsonPayload`.

### 6b. The dashboard query — cost by route × user × day

Applies the **same rates as `admin.ts`** (`vertex_claude` €2.8 in / €14 out per 1M; `vertex_gemini` / `gemini_dev` €0.07 in / €0.30 out per 1M) so this slice reconciles with `estimateCostEur` and `/api/admin/overview`.

```sql
-- Per-route / per-user / per-day modelled AI cost (EUR), last 7 days.
-- Source: ai.usage Cloud Logging lines (app/src/ai/usage.ts) sinked to BigQuery.
-- Rates mirror app/src/server/admin.ts RATES_EUR_PER_M (single source of truth).
WITH rates AS (
  SELECT 'vertex_claude' AS provider, 2.8  AS in_per_m, 14.0 AS out_per_m UNION ALL
  SELECT 'vertex_gemini',             0.07,             0.30          UNION ALL
  SELECT 'gemini_dev',                0.07,             0.30
),
usage AS (
  SELECT
    DATE(timestamp)                          AS day,
    jsonPayload.route                        AS route,
    jsonPayload.provider                     AS provider,
    jsonPayload.userUid                      AS user_uid,
    CAST(jsonPayload.promptTokens AS INT64)  AS prompt_tokens,
    CAST(jsonPayload.outputTokens AS INT64)  AS output_tokens
  FROM `PROJECT_ID.ai_usage_logs.run_googleapis_com_stdout_*`
  WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
    AND jsonPayload.message = 'ai.usage'
)
SELECT
  u.day,
  u.route,
  u.provider,
  u.user_uid,
  COUNT(*)                  AS calls,
  SUM(u.prompt_tokens)      AS prompt_tokens,
  SUM(u.output_tokens)      AS output_tokens,
  ROUND(
    SUM(u.prompt_tokens) / 1e6 * MAX(r.in_per_m) +
    SUM(u.output_tokens) / 1e6 * MAX(r.out_per_m)
  , 4)                      AS cost_eur
FROM usage u
LEFT JOIN rates r USING (provider)
GROUP BY u.day, u.route, u.provider, u.user_uid
ORDER BY u.day DESC, cost_eur DESC;
```

**Roll-up variants** (drop dimensions from `GROUP BY`):
- **Cost by route/day** — remove `u.user_uid` from `SELECT`/`GROUP BY`. This is the per-route slice COST-2 surfaces in `/api/admin/overview.usageToday.byRoute`.
- **Top-N users by cost today** — add `WHERE u.day = CURRENT_DATE()`, drop `route`, `ORDER BY cost_eur DESC LIMIT 20`. Matches the COST-2 `topUsers` slice.
- **Cost by provider/day** — the Claude-vs-Flash split that feeds the COST-4 routing eval (Claude output is ~47× Flash's rate: €14 vs €0.30 per 1M).

> **Privacy note (NL/IL):** `user_uid` makes the per-user variant personal-data-adjacent. Keep `ai_usage_logs` in **EU**, admin-query-only, and short-TTL the tables (set a partition expiration on the dataset). Do not export the user-level slice outside the EU project. The route/day and provider/day rollups carry no `user_uid` and are safe for wider dashboards.

---

## 7. Reconciliation — modelled token cost vs real Google bill

The point of having both halves is to catch drift between what we *think* AI costs (token rate table) and what Google *actually* bills. Run weekly:

```sql
-- Vertex AI real bill (billing export) vs modelled AI cost (ai.usage telemetry), by day.
WITH billed AS (
  SELECT DATE(usage_start_time) AS day, ROUND(SUM(cost), 2) AS vertex_billed_eur
  FROM `PROJECT_ID.billing_export.gcp_billing_export_v1_XXXXXX_XXXXXX_XXXXXX`
  WHERE service.description = 'Vertex AI'
    AND _PARTITIONTIME >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
  GROUP BY day
),
modelled AS (
  SELECT
    DATE(timestamp) AS day,
    ROUND(
      SUM(CAST(jsonPayload.promptTokens AS INT64)) / 1e6 * 0.07 +
      SUM(CAST(jsonPayload.outputTokens AS INT64)) / 1e6 * 0.30
    , 2) AS modelled_flash_eur
  FROM `PROJECT_ID.ai_usage_logs.run_googleapis_com_stdout_*`
  WHERE jsonPayload.message = 'ai.usage'
    AND _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY))
  GROUP BY day
)
SELECT b.day, b.vertex_billed_eur, m.modelled_flash_eur,
       ROUND(b.vertex_billed_eur - m.modelled_flash_eur, 2) AS gap_eur
FROM billed b LEFT JOIN modelled m USING (day)
ORDER BY b.day DESC;
```

A persistent gap means the rate table in `admin.ts` is stale, a provider is mis-attributed, or there's non-AI Vertex usage — investigate and re-tune `RATES_EUR_PER_M`.

---

## 8. Run, verify, rollback

**Run** (after editing `BILLING_ACCOUNT_ID` and confirming `MONTHLY_BUDGET_EUR`):
```bash
BILLING_ACCOUNT_ID=XXXXXX-XXXXXX-XXXXXX \
PROJECT_ID=arborprd-westeu \
ALERT_EMAIL=bguy.rubin@gmail.com \
MONTHLY_BUDGET_EUR=300 \
bash docs/architecture/migration-2026-06-17/wave-0/artifacts/cost-budget.sh
```

**Verify:**
- Console → Billing → Budgets & alerts shows `arbor-prod` with the four percentage rules.
- Lower a *copy* budget to a tiny amount in a sandbox to confirm a threshold email + Pub/Sub message fire.
- Next day: the cost-by-service query (§5) returns Vertex AI / Cloud Run / Firestore rows.
- After the log sink (§6a): the per-route query (§6b) returns rows for `chat`, `generate-story`, etc.
- **No `tsc`/build/CI impact** — zero app code changed; CI stays green by construction.

**Rollback:** delete the budget (`gcloud billing budgets delete <id> --billing-account=<BA>`), disable the export in the console, and `bq rm -r -d <proj>:billing_export` (and `:ai_usage_logs`). No app impact.

---

## 9. Apply steps (for the human / clean-baseline run)

These were deliberately **not** done here (dirty working tree; no GCP/prod mutation allowed):

1. **Run the script** with real `BILLING_ACCOUNT_ID` (see §8). Requires `roles/billing.admin` on the account + `roles/bigquery.admin`/`roles/pubsub.admin` on the project. **Human gate (GCP console/spend).**
2. **Enable the BigQuery billing export** in the console (§4) — the one CLI-impossible step. **Human gate.**
3. *(Optional, for §6 dashboard)* create the `ai.usage` log sink + EU `ai_usage_logs` dataset (§6a). Sink-writer IAM grant on the dataset is required.
4. **Commit the IaC** on a clean baseline — the spec calls for `infra/billing/README.md`, `infra/billing/budget.tf` (a `google_billing_budget` + `google_pubsub_topic` + `google_bigquery_dataset` location `"EU"` stub), and a cross-link from `docs/deployment-production.md`. This artifact script + runbook is the drop-in source for those; promote it into `infra/billing/` when the tree is clean.
5. **Add the comment-only note** to `cloudbuild.prod.yaml` that budget + export are managed out-of-band (IaC), not by the deploy — see the snippet below. *(Not applied here: hard rule against modifying tracked files.)*

### Snippet — comment to add to `cloudbuild.prod.yaml` (top `# Notes:` block)

```yaml
# - Cost governance (GCP budget, threshold alerts, BigQuery billing export) is managed
#   OUT OF BAND via docs/architecture/migration-2026-06-17/wave-0/artifacts/cost-budget.sh
#   (COST-3), NOT by this deploy. No env change here. Budget thresholds 50/80/100/120%;
#   BigQuery billing-export dataset MUST be EU multi-region (AVG/PPL in-region).
```
