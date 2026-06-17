# REL-5 — Cloud Monitoring SLO config (drop-in)

These three JSON files + this README are the **infra-as-code** half of REL-5. The
human-readable definitions, rationale, and error-budget math live in
`../slo/slis-slos-error-budget.md` (canonical → `docs/ops/slo.md` on the clean baseline).

| File | What it is | Apply tool |
| :--- | :--- | :--- |
| `ai-success-log-metric.json` | Log-based COUNTER metric `arbor_model_call_outcome` on REL-2's `model_call` log event. Feeds the AI-success SLO. | `gcloud logging metrics create` |
| `slo-definitions.json` | 4 Service Monitoring SLOs (availability, interactive latency, AI-sync latency, AI success), 30-day rolling, against `arbor-api`. | `gcloud monitoring slos create` (one per `slos[]` entry) |
| `alert-policies.json` | 8 burn-rate alert policies (fast-burn page + slow-burn ticket per SLO), `select_slo_burn_rate`, one notification channel. | `gcloud alpha monitoring policies create` (one per `policies[]` entry) |

> **Nothing here was applied by the Wave-0 agent.** Applying mutates Cloud Monitoring
> in the prod GCP project and requires `roles/monitoring.editor` +
> `roles/logging.configWriter`. That is a human / clean-baseline step.

## Order of operations

1. **REL-2 first.** `arbor_model_call_outcome` has no data until `logger.info("model_call", …)`
   ships. Availability + latency SLOs are independent and can be applied immediately.
2. **Log metric** → **notification channel** → **SLOs** → **alert policies** (alerts reference
   SLO resource names; SLOs reference the log metric).

## Commands

```bash
PROJECT_ID=<prod-project-id>

# 1. Log-based metric (after REL-2 deployed)
gcloud logging metrics create arbor_model_call_outcome \
  --project "$PROJECT_ID" \
  --config-from-file ai-success-log-metric.json

# 2. Notification channel (email = cheapest; capture the returned id)
gcloud beta monitoring channels create --project "$PROJECT_ID" \
  --display-name "Arbor SLO alerts (founder email)" \
  --type email --channel-labels=email_address=bguy.rubin@gmail.com
#   → projects/$PROJECT_ID/notificationChannels/XXXX

# 3. Resolve the arbor-api Service Monitoring service id
gcloud monitoring services list --project "$PROJECT_ID"
#   If arbor-api is not auto-registered:
#   gcloud monitoring services create --service-id arbor-api --display-name "Arbor API" --project "$PROJECT_ID"

# 4. Create each SLO (split slo-definitions.json into one file per slos[] entry, or use the API)
#    SERVICE_ID from step 3, e.g. projects/$PROJECT_ID/services/arbor-api
gcloud monitoring slos create --service <SERVICE_ID> \
  --project "$PROJECT_ID" --slo-from-file <one-slo.json>

# 5. Substitute ${PROJECT_ID}, ${SLO_*} (projects/$PROJECT_ID/services/<svc>/serviceLevelObjectives/<sloId>),
#    and ${NOTIFICATION_CHANNEL_ID} in alert-policies.json, then create each policy
gcloud alpha monitoring policies create --project "$PROJECT_ID" \
  --policy-from-file <one-policy.json>
```

SLO resource-name pattern for the alert substitutions:
`projects/$PROJECT_ID/services/<service-id>/serviceLevelObjectives/<sloId>`
where `<sloId>` ∈ { `arbor-availability`, `arbor-latency-interactive`, `arbor-latency-ai`, `arbor-ai-success` }.

## Burn-rate math (recap — full detail in slo.md §4)

Multi-window, multi-burn-rate (Google SRE pattern):
- **Fast-burn (page):** burn rate > **14.4** over **1h** AND **5m** → ~2% of 30-day budget in 1h.
- **Slow-burn (ticket):** burn rate > **6** over **6h** AND **30m** → ~5% of 30-day budget in 6h.

`select_slo_burn_rate` is baseline-agnostic — it measures budget consumed, so the same
14.4 / 6 factors apply to the 90% latency SLO where a raw error-rate threshold would be >100%.

## OPTION B — log-derived latency SLI (fallback if per-path Cloud Run labels are unavailable)

The latency SLOs in `slo-definitions.json` use the Cloud Run built-in `request_latencies`
distribution at the **service** level. Cloud Run's built-in metric does **not** expose the
request *path*, so it cannot natively separate the interactive class (≤1s) from the AI-sync
class (≤8s) or exclude the SSE routes. Two ways to get clean per-class latency:

1. **Preferred (no app code):** the existing request log (`logger.ts`, `requestObservability`)
   already emits `httpRequest.requestUrl` + `latencyMs` per request. Define a second
   **log-based DISTRIBUTION metric** `arbor_request_latency` with value extractor
   `EXTRACT(jsonPayload.latencyMs)` and a label `route_class` extracted from the URL prefix
   (interactive vs ai_sync vs sse). Then build the two latency SLOs as `distributionCut` on
   that metric filtered by `route_class`, excluding `sse`. This is the **most accurate** option
   and still requires **zero app-code change** (the log line already exists). Add this metric to
   `ai-success-log-metric.json`'s apply step if per-path accuracy is needed at launch.
2. **Accepted simplification at beta:** apply the two service-level latency SLOs as written
   (1s and 8s thresholds against all non-SSE traffic). The 8s SLO is loose enough that the AI
   tail dominates; the 1s SLO will be pessimistic (AI requests count against it) — acceptable
   while AI traffic is a small fraction, revisit at the quarterly review.

The availability and AI-success SLOs are **unaffected** by this — they are exact as written.
