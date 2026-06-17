# Arbor Cloud Run Load-Test Plan & Right-Sizing Runbook

**Missions:** PERF-2 (right-size Cloud Run from a load test, document it) — with PERF-1 (warm-instance / `/healthz` warmup) context.
**Source spec:** `docs/architecture/migration-2026-06-17/spec-D-performance.md` §PERF-1, §PERF-2.
**Author:** Principal Engineer / Compliance Lead — WAF Wave-0.
**Date:** 2026-06-17
**Status:** Plan + runnable k6 script delivered. Execution is a human gate (needs GCP, a deployed `/healthz`, a test Firebase token, and Cloud Shell). This doc + the script are drop-in.

> **Hard scope note.** This artifact is NEW and additive. It does NOT modify any tracked file. The
> `cloudbuild.prod.yaml` flag changes that PERF-1/PERF-2 require are emitted here as **SNIPPETS with apply
> steps** (§9), to be dropped in by a human or a later clean-baseline run after the load test produces numbers.

---

## 0. TL;DR

1. Add `GET /healthz` (PERF-1) and deploy a **dedicated load-test revision** of `arbor-api` (never test the live prod revision).
2. Run `loadtest.k6.js` (`../artifacts/loadtest.k6.js`) from **Cloud Shell in `europe-west4`** against that revision, in three scenarios: `/healthz`, capped `/api/chat` SSE, structured `/api/analyze-behavior`.
3. Read Cloud Run metrics (instance count, CPU util, memory util, request latency, container OOM/503) and the k6 summary.
4. Derive `--concurrency`, `--cpu`, `--memory`, `--max-instances` from the rules in §8 and record the chosen values in §10.
5. Apply the `cloudbuild.prod.yaml` snippet (§9) — PERF-1 (`--min-instances=1`) first, then PERF-2 sizing flags — and re-deploy a small smoke run to confirm no 5xx/OOM.

---

## 1. What we are sizing and why the defaults are probably wrong

The app is a **single Express process** (`app/src/server/createApp.ts` → `start.ts` `app.listen`). Today `cloudbuild.prod.yaml` sets **no** `--concurrency`, `--cpu`, `--memory`, `--min-instances`, or `--max-instances`, so the prod service runs on Cloud Run defaults: **concurrency 80, 1 vCPU, 512 MiB, scale-to-zero, unbounded max instances.** Two things make those defaults a poor fit:

- **`/api/chat` is long-lived and I/O-bound.** Each request holds an open **SSE** stream (`beginSse` in `app/src/routes/api.ts`) for the entire model generation — many such streams sit idle-waiting on Vertex, using almost no CPU. That argues for **high concurrency** (lots of concurrent streams per instance) but **enough memory** that buffered responses + the `firebase-admin` + `@google-cloud/vertexai` resident set don't OOM at 512 MiB.
- **`/api/analyze-behavior` is CPU/JSON-parse bound.** It builds a large prompt, redacts, calls `modelProvider.generateJson({ route: "analysis_structured" })`, and parses structured JSON back. This is the path that actually consumes CPU and pushes RSS.

The load test exists to replace guesswork with measured numbers for exactly these four flags.

### Real guards the test must respect (grounded in code)

| Guard | Where | Value | Implication for the test |
|---|---|---|---|
| IP rate limit | `createApp.ts` `rateLimit(...)` | **30 req/min per client IP**, all `/api/*` | A single Cloud Shell box shares one egress IP → `/api` scenarios hit 429 fast. See §3 (Scenario A vs B). |
| AI hourly quota | `aiQuota.ts` | **80/hr per uid** (or per IP if anon), `AI_USER_HOURLY_LIMIT` | Long runs exhaust it; raise it on the load-test revision only. |
| Free coach meter | `entitlements.ts` on `/api/chat` | `FREE_COACH_MESSAGES_PER_DAY=10` | A free test account caps at 10 chats/day; use a Plus/entitled test account or raise the cap on the LT revision. |
| Auth | `authMiddleware.ts`, `REQUIRE_AUTH=true` in prod | bearer Firebase ID token **required** on `/api` | `ID_TOKEN` env is mandatory for `/api` scenarios (§4). `/healthz` is exempt by design. |
| Escalation screen | `screenForImmediateEscalation` | input short-circuits before model | Test bodies are deliberately **benign** so the model path runs (that is what we size for). |

---

## 2. Endpoints under test (exact contracts)

- **`GET /healthz`** (added by PERF-1; mounted before the `/api` chain → no auth, no CORS, no rate-limit, never calls a model). Returns `200 { status: "ok", env }`. The warmup + Cloud Run startup-probe target, and the cheapest signal of "is a warm instance responding."
- **`POST /api/chat`** with `Accept: text/event-stream` → SSE (`event: status|chunk|done`). Body: `{ message, childProfile, scholarLens, language }`. Without the Accept header it returns buffered JSON. The capped, connection-bound profile.
- **`POST /api/analyze-behavior`** → JSON. Body: `{ logs[], childProfile }`. Returns `{ frequencyCount, intensityTrend, triggerBreakdown, effectivenessRating, expertInsights, actionPlanSuggestion }`. The CPU/parse-bound profile and the prime PERF-4 server-cache target.

The k6 bodies in `loadtest.k6.js` match these shapes exactly and are benign (no escalation keywords).

---

## 3. Two run modes (pick deliberately)

The app-level guards (rate limit, AI quota, coach meter) sit **in front of** Cloud Run's own concurrency/CPU. To size the **compute layer** you must get past them; to validate **end-user behavior** you keep them on.

- **Scenario A — Sizing run (use this for PERF-2 numbers).** On the **load-test revision only**, relax the guards via env so they don't mask Cloud Run capacity: `AI_USER_HOURLY_LIMIT=100000`, `FREE_COACH_MESSAGES_PER_DAY=100000`, and either bump the `express-rate-limit` `limit` (a small LT-only patch) or accept that you'll drive moderate RPS from multiple Cloud Shell sessions / a small VM pool with distinct IPs. This isolates `--concurrency`/`--cpu`/`--memory` from the app guards. **Never relax these on prod.**
- **Scenario B — Guard-aware run.** Keep all guards on; treat `429`/`409`/`401` as **expected**, not failures. Measures real user-facing latency and confirms the guards behave. The k6 script counts `429`/`401`/`409` in separate metrics precisely so you can tell rate-limiting apart from capacity exhaustion.

The script's thresholds (`server_errors_5xx < 1`, `rate_limited_429 rate < 0.5`) are written so Scenario A is the one that "passes" cleanly; in Scenario B the 429 rate threshold is informational.

---

## 4. Prerequisites

1. **`/healthz` deployed.** Land PERF-1's route first (or it 404s and the health scenario fails). The route is in `createApp.ts`; the snippet to add it lives in the PERF-1 deliverable / spec §PERF-1.
2. **k6 installed** in Cloud Shell: `sudo apt-get update && sudo apt-get install -y gnupg ca-certificates && curl -s https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg && echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list && sudo apt-get update && sudo apt-get install -y k6`
3. **A Firebase ID token** for a test account (REQUIRE_AUTH=true rejects `/api` without it). Mint one with the Identity Toolkit REST API using the project Web API key and a dedicated test user:
   ```bash
   export TOKEN=$(curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$WEB_API_KEY" \
     -H 'Content-Type: application/json' \
     -d "{\"email\":\"loadtest@arbor.test\",\"password\":\"$LT_PASSWORD\",\"returnSecureToken\":true}" \
     | jq -r .idToken)
   ```
   Tokens expire in ~1h — re-mint for long runs. Use an **entitled (Plus)** test account so the coach meter doesn't gate `/api/chat` in Scenario B.
4. **A dedicated load-test Cloud Run revision** in `europe-west4` (same region as prod, Firestore, Vertex — removes WAN noise and keeps EU residency intact). Tag it distinctly, point a test Firestore/project if you do not want LT traffic in prod telemetry. **Do not run load against the live revision serving families.**

---

## 5. Running the test

```bash
# From Cloud Shell, europe-west4. BASE_URL is the load-test revision host.
export BASE_URL=https://arbor-api-loadtest-xxxx-ew.a.run.app
export TOKEN=...   # from §4.3

# Full sweep (health → chat → analyze, staggered):
k6 run --summary-export=results-all.json \
  -e BASE_URL="$BASE_URL" -e ID_TOKEN="$TOKEN" -e SCENARIO=all \
  ../artifacts/loadtest.k6.js

# Isolate one profile while watching Cloud Run metrics for that revision:
k6 run -e BASE_URL="$BASE_URL" -e ID_TOKEN="$TOKEN" -e SCENARIO=analyze -e ANALYZE_VUS=12 ../artifacts/loadtest.k6.js
k6 run -e BASE_URL="$BASE_URL" -e ID_TOKEN="$TOKEN" -e SCENARIO=chat    -e CHAT_VUS=20    ../artifacts/loadtest.k6.js
k6 run -e BASE_URL="$BASE_URL" -e SCENARIO=health ../artifacts/loadtest.k6.js   # no token needed for /healthz
```

Run each `/api` scenario in **isolation** so the Cloud Run instance count / CPU / memory you read off Cloud Monitoring maps cleanly to one workload. Hold each load stage long enough (default 30s ramp + 60s hold) for autoscaling to settle before reading instance count.

### Observe in parallel (the metrics that drive the decision)

```bash
# Live config / scaling bounds of the revision:
gcloud run services describe arbor-api-loadtest --region=europe-west4 \
  --format='value(spec.template.metadata.annotations)'

# Instance count, CPU util, memory util, request latency, 5xx — Cloud Monitoring:
#   run.googleapis.com/container/instance_count
#   run.googleapis.com/container/cpu/utilizations
#   run.googleapis.com/container/memory/utilizations
#   run.googleapis.com/request_latencies
#   run.googleapis.com/request_count  (filter response_code_class=5xx, and =429)
# Watch the logs for OOM:
gcloud logging read 'resource.type=cloud_run_revision AND severity>=WARNING AND
  (textPayload:"Memory limit" OR textPayload:"OOM" OR textPayload:"exceeded")' --limit=50
```

---

## 6. What "done" looks like

- k6 summary captured (the script writes `results.json` + a one-line runbook string via `handleSummary`).
- For each profile: **p50/p95 latency**, **peak instance count**, **peak CPU util %**, **peak memory util %**, and **count of 5xx / container OOM / 429** recorded in §10.
- `--concurrency`, `--cpu`, `--memory`, `--max-instances` chosen per §8 and written into the `cloudbuild.prod.yaml` snippet (§9).
- Post-change smoke: deploy the snippet to the LT revision, run a small burst, confirm **zero 5xx, zero OOM, SSE streams complete**. `npm run build` stays green (infra flags don't touch the build).

---

## 7. Measuring SSE first-token latency correctly (PERF-1 signal)

`k6`'s `http.post` **buffers** the whole SSE stream, so it cannot time individual `chunk` events. The script approximates:

- **`chat_ttfb_ms` = `res.timings.waiting`** (time to first byte) ≈ time to first SSE event — a good proxy for first-token latency, which is the PERF-1 cold-vs-warm signal.
- **`chat_full_stream_ms` = `res.timings.duration`** = full stream completion.

For **true per-event** timing (to prove "first token < 3s warm"), use one of:
- `xk6-sse` (build a custom k6 binary with the SSE extension) — emits a metric per SSE event.
- A tiny `curl` probe for the cold-vs-warm A/B in §11: `curl -N` with `--accept text/event-stream` and a timestamp on the first received line.

The plan's PERF-1 acceptance (warm first-token < 3s after 15 min idle) is best measured with the §11 curl A/B, not the bulk k6 run.

---

## 8. Right-sizing decision rules (how results map to flags)

Read the peak utilizations from the **analyze** scenario (CPU/mem bound) and the **chat** scenario (connection bound), then apply:

### `--memory`
- If **peak memory util > ~75%** of 512 MiB on either scenario, or any **container OOM / 503 from memory**, set **`--memory=1Gi`**. The `firebase-admin` + `@google-cloud/vertexai` resident set plus buffered structured-JSON responses is the prime suspect; 512 MiB is the most likely default to be wrong. If peak stays < ~60%, keep `512Mi`.
- Rationale: memory is the cheapest insurance against OOM-killed instances dropping live SSE streams.

### `--cpu`
- If **peak CPU util sustains > ~70%** on the `analyze` scenario at target concurrency (the JSON-parse/prompt-build path is the CPU hot spot), set **`--cpu=2`**. Otherwise keep **`--cpu=1`** — the chat path is I/O-bound and rarely CPU-limited.
- Note: Cloud Run requires `--cpu>=1` and pairs with memory minimums (e.g. `--cpu=2` wants `--memory>=1Gi`). If you raise CPU, raise memory to match.
- **`--no-cpu-throttling`**: defer. Only add it if the load test shows SSE responsiveness degrading between tokens on a warm instance (CPU throttled to ~0 between requests starving the event loop). It increases cost (CPU billed always-on), so treat it as a targeted fix, not a default.

### `--concurrency`
- The chat path holds many idle SSE streams cheaply → favor **keeping or raising** concurrency. If at default 80 the instance handles the held-open streams with CPU < ~50% and no latency cliff, **keep `--concurrency=80`** (the default is plausibly fine, per spec).
- **Lower** concurrency (e.g. `--concurrency=40`) **only if** CPU saturates *before* the connection count does — i.e. the `analyze` workload pegs CPU at far fewer than 80 concurrent requests. In that case lower concurrency so each instance isn't CPU-starved, and let Cloud Run add instances instead.
- Find the knee: increase `CHAT_VUS` until p95 first-token latency climbs sharply or 5xx appears; the concurrent-request count at the knee, with headroom, is your `--concurrency` ceiling per instance.

### `--max-instances` (cost ceiling — required for auditability)
- Set an explicit, defensible ceiling, e.g. **`--max-instances=10`** for the initial NL+IL pilot. Derive it from: (peak target RPS) × (avg request seconds) ÷ (chosen concurrency) × safety factor. Document the math so a DPA/procurement reviewer can audit the spend ceiling (NL B2G note).

### `--min-instances` (PERF-1, shared flag — see §11)
- **`--min-instances=1`** for the B2G/clinical launch: the only reliable warm-instance guarantee, and the floor that makes a latency SLA defensible to municipalities/JGZ/insurers.

---

## 9. APPLY SNIPPET — `cloudbuild.prod.yaml` (do NOT auto-apply; human gate)

> **This file must NOT be edited by this Wave-0 agent.** Below is the exact change to drop into the
> `gcloud run deploy arbor-api` args block (`cloudbuild.prod.yaml` lines 34–49), **after `--allow-unauthenticated`
> and before `--set-env-vars`**. Apply **PERF-1 first** (`--min-instances=1`), then **PERF-2 sizing flags**. Do not touch
> the `^@^...` env-var string. Replace the `<...>` sizing values with the numbers chosen from §8/§10.

```yaml
      - --allow-unauthenticated
      # PERF-1: keep one warm instance so the first /api/chat after idle is fast
      # (defensible latency SLA for B2G/clinical launch). Cost: one always-on instance.
      - --min-instances=1
      # PERF-2: explicit Cloud Run sizing, derived from the load test (see
      # docs/architecture/migration-2026-06-17/wave-0/perf/load-test-plan.md §10).
      - --concurrency=<CONCURRENCY>   # e.g. 80 (keep default if CPU not the limiter)
      - --cpu=<CPU>                   # e.g. 1 (raise to 2 only if analyze pegged CPU >70%)
      - --memory=<MEMORY>             # e.g. 512Mi or 1Gi (1Gi if peak mem >75% or any OOM)
      - --max-instances=<MAX>         # e.g. 10 — explicit cost ceiling, auditable for DPA/procurement
      - --set-env-vars
      - ^@^ARBOR_ENV=prod@...   # UNCHANGED — do not touch this line
```

**Apply steps (human / clean-baseline run):**
1. Land PERF-1's `/healthz` route + boot warmup in `createApp.ts` / `modelRouter.ts` / `claudeVertexProvider.ts` (separate PERF-1 deliverable).
2. Run the load test (§5), fill in §10, choose `<...>` values via §8.
3. Insert the snippet above into `cloudbuild.prod.yaml` (PERF-1 line, then PERF-2 lines), leaving the `^@^` env string untouched.
4. `gcloud builds submit --config cloudbuild.prod.yaml --substitutions=_REGION=europe-west4 --project <PROD_PROJECT_ID>`.
5. Verify: `gcloud run services describe arbor-api --region=europe-west4` shows `minScale: 1` and the chosen container limits; run a small post-change smoke (§6).

**Rollback:** remove the flags → reverts to Cloud Run defaults + scale-to-zero. Fully reversible, no data impact.

---

## 10. Results table (fill after running)

| Profile | Target VUs/conc | p50 (ms) | p95 (ms) | Peak instances | Peak CPU % | Peak mem % | 5xx | OOM | 429 |
|---|---|---|---|---|---|---|---|---|---|
| `/healthz` (warm) | 20 | | | | | | | n/a | n/a |
| `/api/chat` SSE (TTFB) | 10–20 | | | | | | | | |
| `/api/analyze-behavior` | 8–12 | | | | | | | | |

**Chosen flags:** `--min-instances=1` · `--concurrency=___` · `--cpu=___` · `--memory=___` · `--max-instances=___`
**Rationale (one line each):**
- concurrency: …
- cpu: …
- memory: …
- max-instances: …

---

## 11. PERF-1 context — `--min-instances=1` vs Cloud-Scheduler warmup (the tradeoff)

Both options exist to make the **first AI call fast** after idle; they differ on guarantee vs cost.

| Option | How | Latency guarantee | Cost | When |
|---|---|---|---|---|
| **(A) `--min-instances=1`** | one flag in `cloudbuild.prod.yaml` | **Strong** — an instance is always warm; first `/api/chat` pays no container-start + no Vertex-import + no ADC-mint penalty | **Recurring** — one instance billed 24/7 (memory always; CPU only during requests unless `--no-cpu-throttling`) | **Recommended for B2G / clinical launch.** Municipalities/JGZ/insurers expect predictable latency; this is the only reliable floor for a latency SLA. |
| **(B) Cloud Scheduler → `/healthz`** | a Cloud Scheduler job hits `https://<host>/healthz` every ~5 min | **Best-effort** — if the instance scaled to zero between pings, the pinged request itself eats the cold start; it warms the *next* call, not the pinging one. Not a guarantee. | **Near-zero** — Cloud Scheduler + a trivial request | **Pre-revenue beta / cost-down lever** where a weaker guarantee is acceptable. |

**Recommendation (matches spec §PERF-1):** ship **(A) `--min-instances=1`** for launch; document **(B)** as the cost-down lever for beta. The two compose — you can run min-instances=1 *and* a scheduler ping if you want the eager-warmup (`void modelProvider.warmup?.()`) re-primed periodically, but that is optional.

### Cold-vs-warm A/B (proves the PERF-1 win)
Before/after applying `--min-instances=1`, measure first-token latency on a cold path:
```bash
# Idle the service 15+ min (scale to zero with min-instances=0), then time first SSE byte:
time curl -N -s -o /dev/null -w '%{time_starttransfer}\n' \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: text/event-stream' -H 'Content-Type: application/json' \
  -d '{"message":"shoes routine help","childProfile":{"name":"T","ageBand":"3-4y"},"language":"en"}' \
  "$BASE_URL/api/chat"
```
Record cold `time_starttransfer` vs warm (with min-instances=1). The eager Vertex import + ADC token mint (PERF-1 boot warmup) plus the always-warm container should drop warm first-token to the < 3s target. Put both numbers in §10's notes — that delta is the PERF-1 evidence for the SLO basis.

---

## 12. Two-market notes

- **NL (B2G):** This runbook + the filled §10 table is the **documented capacity/SLO basis** insurer/municipal procurement will ask for. `--max-instances` is the auditable cost ceiling for a DPA/procurement review. `/healthz` must stay free of project id / model names / counts (unauthenticated endpoint) — the k6 health check asserts this (`healthz does not leak project/model`). `europe-west4` keeps data residency intact; the load test changes nothing about residency.
- **IL:** If IL traffic peaks at different local hours than NL, note **both peaks** here so `--min-instances`/`--max-instances` cover the combined diurnal curve. Hebrew/RTL coach turns are slightly longer token-wise, so the warm-Vertex-client win (PERF-1) matters most on the first IL coach turn of the day. Keep load-test payloads PII-free so Amendment-13 breach scope is unaffected.

---

## 13. Files

- **This plan:** `docs/architecture/migration-2026-06-17/wave-0/perf/load-test-plan.md`
- **Runnable k6 script:** `docs/architecture/migration-2026-06-17/wave-0/artifacts/loadtest.k6.js`
- **Grounding spec:** `docs/architecture/migration-2026-06-17/spec-D-performance.md`
- **To-apply (human gate):** `cloudbuild.prod.yaml` (snippet in §9) — NOT modified by this artifact.
