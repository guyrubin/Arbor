# Arbor — SLIs / SLOs / Error Budget + Burn-Rate Alerting (REL-5)

**Mission:** REL-5 (Wave 0, Spec C — Reliability)
**Status:** Build-ready. This is the canonical SLO definition. It is the human-readable
companion to the drop-in Cloud Monitoring config under
`docs/architecture/migration-2026-06-17/wave-0/artifacts/`.
**Owner:** Reliability / SRE
**Last updated:** 2026-06-17
**Service under objective:** `arbor-api` (Cloud Run, `europe-west4`, single region,
`--allow-unauthenticated`), fronted by Firebase Hosting rewrite `/api/**` → service `arbor-api`.

> **Note on apply target.** The spec (REL-5) names `docs/ops/slo.md` and
> `infra/monitoring/*` as the eventual home for this work on the clean baseline.
> This Wave-0 artifact is written under `migration-2026-06-17/wave-0/` to avoid
> touching the dirty tree. The "Apply steps" at the bottom say exactly where each
> file lands on the clean run.

---

## 0. Why these SLOs exist (market framing)

A written availability SLO + error budget is a **direct input to the SLA / DPA annex**
for NL municipality / JGZ-consultatiebureau / school / insurer procurement, and the
AI-success SLI evidences that **AI degradation is monitored** — relevant to the DPIA's
"automated processing reliability" section. For IL (Amendment 13, in force Aug 2025) the
database holder must be **accountable** for service health: SLOs + burn alerts are the
mechanism that lets Arbor *detect* an incident inside the breach-notification window.
Dashboards and alerts are operator-facing (no RTL / Hebrew surface).

These targets are **beta-scale starting values**. They are deliberately reachable on a
single-region, scale-to-zero Cloud Run service and are meant to be **tightened** as
traffic and a B2G SLA commitment arrive. Every target below is a tunable; the alerting
math (multi-window multi-burn-rate) is the part that should not change.

---

## 1. Service architecture facts that shape the SLIs

Grounded in the real code/infra (not assumed):

| Fact | Source | Consequence for SLIs |
| :--- | :--- | :--- |
| One request log line per request, Cloud-Logging-shaped JSON with `httpRequest.status` + `latencyMs` | `app/src/server/logger.ts` `requestObservability` (lines 50–76) | Availability + latency SLIs can ride on **Cloud Run built-in** `request_count` / `request_latencies` — no new app code. |
| AI model outcome is **not** yet a log event | REL-2 adds `logger.info("model_call", { route, provider, outcome, attempt, latencyMs })` | AI-success SLI is a **log-based counter metric** on `jsonPayload.message="model_call"`, label `outcome`. **Hard dependency on REL-2.** |
| `/api/chat` and `/api/voice` stream over **SSE** (long-lived connections) | `app/src/routes/api.ts` `beginSse` at lines 52–59; `/chat` 196, `/voice` 452 | SSE request *latency* = whole stream duration → it would poison a p95 latency SLI. SSE routes are **excluded from the latency SLI** and covered by availability + AI-success instead. |
| `/api/council` is request/response JSON (not SSE) despite being an AI route | `api.ts` 342–446 (`res.json`) | Council **is** a valid latency-SLI route, but it fans out 3+ model calls so it gets a **relaxed latency target** (see §3). |
| Quota store **fails open** on Firestore error (availability over enforcement) | `app/src/server/quotaStore.ts:83` | A Firestore brownout shows up as AI/availability degradation, *not* as 5xx from quota — documented as a known error-budget risk (§6). |
| Provider label values | `usage.ts` / `modelRouter.ts`: `ProviderId` = `gemini_dev` \| `vertex_gemini` \| `vertex_claude` | The AI-success metric's `provider` label takes exactly these values; `coach_high_stakes` routes resolve to `vertex_claude` in prod. |
| Single region `europe-west4`, no failover | `cloudbuild.prod.yaml` | A regional outage = total outage; that risk is **accepted with sign-off in `dr-runbook.md` (REL-1)**, so the availability SLO is a *single-region* SLO. |

---

## 2. The three SLIs (precise definitions)

An SLI is `good events / valid events`. Each is defined so it can be computed from a
signal that **already exists** (or, for AI-success, from REL-2's log event).

### SLI-1 — API Availability
- **Definition:** `count(/api/** responses where status < 500) / count(/api/** responses where status != 429)`.
- **Why exclude 429?** A 429 is rate-limit / quota enforcement working *correctly* — it is
  a "good" outcome of a protective control, not a service failure. Counting it as bad would
  punish the budget for doing its job. (5xx = ours; 4xx other than 429 = client error, still
  "valid+good" because the service responded correctly.)
- **Counted-as-bad:** HTTP `5xx` from `arbor-api`, plus Cloud Run platform `503`s
  (instance unavailable / not ready — ties to REL-4 readiness probe).
- **Signal:** Cloud Run built-in metric
  `run.googleapis.com/request_count`, sliced by `response_code_class`. No app code.
- **Window:** 30-day rolling.

### SLI-2 — Request Latency (non-SSE)
- **Definition:** `count(requests with backend latency ≤ threshold) / count(valid non-SSE requests)`.
- **Excluded:** SSE routes `/api/chat`, `/api/voice` (latency = stream lifetime, not
  server responsiveness). Excluded by filtering them out of the metric (see artifact).
- **Two latency classes** (a single p95 across a fast CRUD route and a 3-model council call is
  meaningless):
  - **Interactive/CRUD class** (`/api/memory/**`, `/api/shares`, `/api/entitlement`,
    `/api/professionals`, `/api/consult-requests`, `/api/admin/**`, health): threshold **1s**.
  - **AI-synchronous class** (`/api/council`, `/api/generate-*`, `/api/extract-log`,
    `/api/vision`, `/api/analyze-behavior`, `/api/generate-handoff`, `/api/score-utterance`):
    threshold **8s** (one or more synchronous model round-trips; council fans out 3+).
- **Signal:** Cloud Run built-in `run.googleapis.com/request_latencies` (distribution),
  thresholded per class. No app code.
- **Window:** 30-day rolling.

### SLI-3 — AI Success Rate
- **Definition:** `count(model_call where outcome="ok") / count(model_call where outcome in {ok, timeout, circuit_open, error})`.
  - **Excluded from denominator:** `outcome="retry"` — a retry that later succeeds is *not* a
    bad event (the request still got a good answer). Counting transient retries as failures
    would double-count and make the SLI track flakiness, not user-visible AI failure.
- **Counted-as-bad:** `timeout`, `circuit_open`, terminal `error` (model exhausted all retries).
- **Signal:** log-based counter metric `logging.googleapis.com/user/arbor_model_call_outcome`
  on filter `jsonPayload.message="model_call"`, label `outcome` (and `provider`, `route` for slicing).
  **Source = REL-2's `logger.info("model_call", …)` emit.**
- **Window:** 30-day rolling.
- **Hard dependency:** REL-2 must be landed for this SLI to have data. Until then, the
  availability + latency SLOs stand alone (they ride on Cloud Run built-ins).

---

## 3. SLO targets + error budgets

30-day rolling window. Error budget = `(1 − SLO) × valid events` (for ratio SLOs the
budget is expressed as the allowed bad-event fraction, and in minutes for the intuitive case).

| # | SLO | Target | Allowed bad fraction | Error budget (per 30 days) |
| :--- | :--- | :--- | :--- | :--- |
| SLO-1 | API availability (non-5xx on `/api/**`, ex-429) | **99.5%** | 0.5% | ≈ **3h 39m** of full-outage-equivalent / 30d |
| SLO-2a | Interactive latency ≤ 1s | **95%** of non-SSE interactive requests | 5% | 5% of interactive requests may exceed 1s |
| SLO-2b | AI-synchronous latency ≤ 8s | **90%** of AI-sync requests | 10% | 10% of AI-sync requests may exceed 8s |
| SLO-3 | AI success rate (`model_call` ok ÷ terminal) | **98%** | 2% | 2% of terminal model calls may be timeout/open/error / 30d |

**Rationale for the numbers (beta, single-region, scale-to-zero):**
- **99.5%** availability ≈ the practical ceiling for a single-region service that scales to
  zero (cold starts + the unmitigated regional-outage risk accepted in `dr-runbook.md`). It is
  also a defensible, *honest* number to put in an NL DPA annex — promising 99.9% on one region
  with no min-instances would be a lie. Upgrade path: set Cloud Run `min-instances ≥ 1` and add
  a second region before committing to 99.9% in a B2G SLA.
- **95% @ 1s** interactive — Firestore reads + Express overhead comfortably fit 1s at p95; the
  5% headroom absorbs cold starts.
- **90% @ 8s** AI-sync — `coach_high_stakes` is Claude 3.5 Sonnet on Vertex; council fans out
  3 model calls. 8s is the `MODEL_TIMEOUT_MS` neighbourhood (REL-2 default 30000ms is the hard
  abort, but the *typical* good response is well under 8s). 90% keeps the SLO honest for the
  long-tail of large prompts.
- **98%** AI success — with REL-2's timeout + bounded retry + circuit-breaker, terminal model
  failures should be rare; 2% budget covers Vertex brownouts and quota blips without paging on
  every transient retry.

**SSE routes (`/api/chat`, `/api/voice`) are covered by SLO-1 (availability — did the stream
open / not 5xx) and SLO-3 (AI success of the underlying model calls), NOT by a latency SLO.**

---

## 4. Burn-rate alerting (multi-window, multi-burn-rate)

We alert on **error-budget burn rate**, not on raw error count. Burn rate = how fast the
30-day budget is being consumed relative to "even" consumption (burn rate 1 = exactly on
track to exhaust the budget in 30 days; burn rate 14.4 = consuming a full day's budget in
~100 min). This is the Google SRE multi-window multi-burn-rate pattern: it pages on real,
fast budget loss and tickets on slow chronic loss, with low false-positive rate.

For each SLO, **two alert policies**:

| Severity | Long window | Short window | Burn-rate threshold | Budget consumed before fire | Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fast burn (page)** | 1h | 5m | **14.4** | ~2% of 30-day budget in 1h | Page on-call (notification channel) — active incident |
| **Slow burn (ticket)** | 6h | 30m | **6** | ~5% of 30-day budget in 6h | Ticket / email — chronic degradation, fix this week |

The **short window is a "still-burning" guard**: the alert fires only if *both* the long
window AND the short window are over threshold, so it auto-resolves quickly once the burn
stops (no flapping, no stale page). Thresholds derived for the SLOs above:

| SLO | Target | Fast-burn condition (1h & 5m) | Slow-burn condition (6h & 30m) |
| :--- | :--- | :--- | :--- |
| SLO-1 availability 99.5% | bad-rate baseline 0.5% | bad-rate > **7.2%** (14.4 × 0.5%) over both windows | bad-rate > **3%** (6 × 0.5%) over both windows |
| SLO-2a latency 95%@1s | baseline 5% slow | slow-rate > **72%** over both windows | slow-rate > **30%** over both windows |
| SLO-2b latency 90%@8s | baseline 10% slow | slow-rate > **100%**→cap at observed; use burn-rate factor on budget (see note) | factor 6 on the 10% budget |
| SLO-3 AI success 98% | baseline 2% bad | AI-bad-rate > **28.8%** over both windows | AI-bad-rate > **12%** over both windows |

> **Note (SLO-2b):** because the allowed-bad fraction is already 10%, a 14.4× fast-burn would
> imply a >100% bad-rate (impossible). For the 90% SLO use the **budget-fraction** form
> directly (Cloud Monitoring SLO burn-rate condition operates on *budget consumed*, not raw
> rate), so the 14.4 / 6 burn-rate factors apply to the budget regardless of the baseline.
> The artifact encodes this with the SLO-native `select_slo_burn_rate` filter, which is
> baseline-agnostic — see `alert-policies.json`.

**Cost-aware routing.** A **single low-cost notification channel** (email to the founder, or a
free Pub/Sub topic that fans into an existing webhook) carries every alert at beta scale. Do
**not** stand up paid PagerDuty / Opsgenie until a B2G SLA requires 24/7 on-call. The upgrade
path (add a PagerDuty channel id to the `notificationChannels` array of the fast-burn policies
only) is one field per policy.

---

## 5. Cloud Monitoring resources (declared as code)

Three drop-in JSON artifacts (apply commands in §7 and in the artifacts `README.md`):

1. **`ai-success-log-metric.json`** — the log-based counter metric on `model_call` (feeds SLO-3).
2. **`slo-definitions.json`** — the three Service Monitoring SLOs (availability, latency, AI-success)
   defined against the `arbor-api` Cloud Run service, request-based, 30-day rolling.
3. **`alert-policies.json`** — six burn-rate alert policies (fast + slow per SLO), using
   `select_slo_burn_rate`, routed to one notification channel.

These live under `docs/architecture/migration-2026-06-17/wave-0/artifacts/` for this Wave-0
run and move to `infra/monitoring/` on the clean baseline (apply step §7).

---

## 6. Known error-budget risks (documented, not yet mitigated)

| Risk | Effect on budget | Status |
| :--- | :--- | :--- |
| **Quota fail-open** (`quotaStore.ts:83`) | A Firestore brownout lets quota over-serve *and* surfaces as AI/latency degradation — burns SLO-2/SLO-3 budget, not SLO-1. Availability looks fine while users see slow/failed AI. | Accepted (availability-over-enforcement by design). Watch SLO-3 burn as the leading indicator of a Firestore issue. |
| **Single region** `europe-west4` | A regional outage burns 100% of the availability budget instantly; no failover. | Accepted with sign-off in `dr-runbook.md` (REL-1). PITR enables cross-region restore within RTO. |
| **Scale-to-zero cold starts** | Cold-start latency eats SLO-2a budget during low-traffic windows. | Accepted at beta. Mitigation = `min-instances ≥ 1` (recurring cost) before tightening SLO-2a. |
| **AI-success SLI blind until REL-2 lands** | SLO-3 has no data source until `model_call` is emitted. | Hard dependency. Availability + latency SLOs are independent and live immediately on Cloud Run built-ins. |

---

## 7. Apply steps (clean-baseline run — a human/clean run does this; no agent mutated infra)

> Requires `gcloud` authenticated against the **prod** project with
> `roles/monitoring.editor` (and `roles/logging.configWriter` for the log metric). None of
> this was executed by the Wave-0 agent.

1. **Move artifacts into the repo's infra tree** (clean baseline):
   ```
   mkdir -p infra/monitoring
   cp docs/architecture/migration-2026-06-17/wave-0/artifacts/ai-success-log-metric.json infra/monitoring/
   cp docs/architecture/migration-2026-06-17/wave-0/artifacts/slo-definitions.json        infra/monitoring/
   cp docs/architecture/migration-2026-06-17/wave-0/artifacts/alert-policies.json          infra/monitoring/
   cp docs/architecture/migration-2026-06-17/wave-0/artifacts/README.md                    infra/monitoring/
   # And place this doc at docs/ops/slo.md (spec REL-5 home).
   cp docs/architecture/migration-2026-06-17/wave-0/slo/slis-slos-error-budget.md docs/ops/slo.md
   ```

2. **Create the log-based metric** (feeds SLO-3; REL-2 must be deployed first so `model_call`
   lines exist):
   ```
   gcloud logging metrics create arbor_model_call_outcome \
     --project "$PROJECT_ID" \
     --config-from-file infra/monitoring/ai-success-log-metric.json
   ```

3. **Create a notification channel** (email — cheapest) and capture its id:
   ```
   gcloud beta monitoring channels create \
     --project "$PROJECT_ID" \
     --display-name "Arbor SLO alerts (founder email)" \
     --type email \
     --channel-labels=email_address=bguy.rubin@gmail.com
   # → note the returned channels/XXXX id and substitute it for
   #   ${NOTIFICATION_CHANNEL_ID} in slo-definitions/alert-policies before applying.
   ```

4. **Create the SLOs** against the `arbor-api` service. The Cloud Run service auto-registers
   as a Service Monitoring service id like
   `projects/$PROJECT_NUMBER/services/<auto-id>`; resolve it once:
   ```
   gcloud monitoring services list --project "$PROJECT_ID"   # find the arbor-api service id
   # then per SLO in slo-definitions.json:
   gcloud monitoring slos create --service <SERVICE_ID> \
     --project "$PROJECT_ID" --slo-from-file infra/monitoring/<each-slo>.json
   ```
   (If `arbor-api` is not yet a registered service, create a custom service first:
   `gcloud monitoring services create --service-id arbor-api --display-name "Arbor API"`.)

5. **Create the burn-rate alert policies** (substitute `${NOTIFICATION_CHANNEL_ID}` and the
   resolved SLO resource names first):
   ```
   gcloud alpha monitoring policies create \
     --project "$PROJECT_ID" \
     --policy-from-file infra/monitoring/alert-policies.json
   ```

6. **Flip the assessment rows** (low-traffic shared doc — edit only these rows):
   `docs/architecture/well-architected-assessment-2026-06-04.md` — set the **REL-5** row
   (line ~115) and the **SLO portion of OPS-1** (line ~61) to
   `mitigated (SLOs + burn alerts defined, infra/monitoring/*, slo.md)`.

7. **Verify live** (record results back into §8 of this doc):
   - Force a burst of `model_call outcome=timeout` in a scratch env (point Vertex at a bad
     endpoint) → confirm `arbor_model_call_outcome` drops and SLO-3 slow-burn fires to the channel.
   - Confirm SLO-1 / SLO-2 dashboards populate from Cloud Run built-ins
     (`gcloud monitoring slos describe ...` shows a healthy budget).
   - Cross-check the alert thresholds in the deployed policies against §4 of this doc.

---

## 8. Verification log (fill on first live apply — done-when this is real, not placeholder)

| Check | Command | Expected | Actual | Date |
| :--- | :--- | :--- | :--- | :--- |
| Log metric exists | `gcloud logging metrics describe arbor_model_call_outcome` | metric present, filter on `model_call` | _TBD_ | _TBD_ |
| SLOs created | `gcloud monitoring slos list --service <id>` | 4 SLOs (avail, lat-interactive, lat-ai, ai-success) | _TBD_ | _TBD_ |
| Burn alerts created | `gcloud alpha monitoring policies list` | 6 policies, channel attached | _TBD_ | _TBD_ |
| Slow-burn fires | forced timeout burst | email/alert received | _TBD_ | _TBD_ |
| Thresholds match doc | manual cross-check vs §4 | identical | _TBD_ | _TBD_ |

---

## 9. Quarterly review checklist

- [ ] Re-baseline targets against the last 90 days of actual SLI data (are 99.5% / 95% / 90% / 98% still honest, or now sandbagged?).
- [ ] Re-confirm SSE-route exclusion list still matches `api.ts` (new streaming routes must be added to the latency-SLI exclusion filter).
- [ ] Confirm `provider`/`route` label cardinality on the AI-success metric stays bounded (no unbounded label values introduced by REL-2 changes).
- [ ] If a B2G SLA is signed: tighten availability toward 99.9%, add `min-instances ≥ 1` + second region, and add a paid paging channel to the fast-burn policies only.
- [ ] Confirm the quota fail-open risk (§6) is still the documented behaviour in `quotaStore.ts`.
