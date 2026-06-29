# Spec C — Reliability (WAF-Rel / SRE)

**Domain owner:** Reliability / SRE
**Source assessment:** `docs/architecture/well-architected-assessment-2026-06-04.md` (§4 Pillar: Reliability, score 2.5)
**Canonical runtime:** React 19 / Vite client (Firebase Hosting) + Express API on Cloud Run (`europe-west4`, single region, `--allow-unauthenticated`, Hosting rewrites `/api/**` → service `arbor-api`) + Firestore (`(default)` db) + Vertex AI (Claude 3.5 Sonnet for `coach_high_stakes`, Gemini 2.5 Flash for the rest).

## Intro

This domain hardens Arbor against partial failure: data loss (REL-1), a slow/down model hanging requests (REL-2), enforcement state lost on scale-out (REL-3), Cloud Run routing to not-ready instances (REL-4), no defined service objectives or burn alerting (REL-5), and Firestore queries that fail at runtime once collections grow (REL-6).

Two facts from reading the code shape every spec:

1. **Reliability primitives already half-exist.** `src/ai/modelRetry.ts` already implements `withModelRetry` (3 attempts, exponential backoff + jitter, transient-error classifier) and **every** Vertex/Gemini/Claude call already wraps through it (`modelRouter.ts`, `claudeVertexProvider.ts`). What is missing is a **timeout** (the Claude `fetch` at `claudeVertexProvider.ts:70` has no `AbortController`; the SDK calls have no deadline) and a **circuit-breaker** (a down model still burns 3× backoff per request). REL-2 is therefore an *extension*, not a greenfield build.
2. **`createCounterStore` (REL-3) already persists to Firestore** (`quotaStore.ts`, collection `aiQuota`, per-key+window docs, fails open). REL-3 is largely a *verification + test* mission, not new code.

The plan is deliberately additive and reversible: most missions ride on managed-service config (Firestore PITR, Cloud Run probes, Cloud Monitoring) rather than new code, and every recurring-cost lever (min-instances, alert channels) is flagged with a cheaper default.

**Market framing.** Reliability is the pillar that most directly underwrites the **B2G readiness bars** for both launch markets. For NL (municipalities / JGZ-consultatiebureau / schools / insurers) a documented RTO/RPO + tested restore + availability SLO is a standard DPA/procurement annex, and PITR/backup is an Article 32 GDPR "resilience and restore" control. For IL, Amendment 13 (in force Aug 2025) makes the database accountable: breach-notification timelines presuppose you can detect outages (REL-4/REL-5) and restore state (REL-1). Residency is already satisfied in both markets (`europe-west4`; IL has EU adequacy) so **no reliability mission requires a region change** — single-region risk is *accepted with sign-off* (REL-1), not engineered away on day one.

---

### REL-1 — Documented RTO/RPO + Firestore PITR/backup with a tested restore, single-region risk signed off

- **Objective / done-when:**
  - A committed runbook `docs/ops/dr-runbook.md` states **RTO** (target time to restore service) and **RPO** (max tolerable data loss) per data class (Firestore `children/*/memoryEvents`, `entitlements`, `usageRollup`, `consultRequests`, `aiQuota`), plus an explicit **single-region acceptance** statement with a named sign-off (owner + date).
  - Firestore **PITR is enabled** on the `(default)` database (7-day continuous backup window) **and** a scheduled daily backup with ≥7-day retention exists.
  - A **restore drill is executed once and documented** (timestamp, source PITR/backup, target DB name, row counts verified, elapsed time vs RTO target). Done-when = the drill section of the runbook is filled with real numbers, not placeholders.
  - The acceptance criteria are testable: `gcloud firestore databases describe '(default)'` shows `pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED`; `gcloud firestore backups schedules list` returns a schedule; the runbook restore section is non-empty.
- **Approach:**
  - **No application code.** This is managed-service config + documentation. The data model is in `src/memory/firestoreMemoryStore.ts` (`children/{childId}/memoryEvents/{eventId}` subcollections; erasure path `eraseChild` batches deletes), `quotaStore.ts` (`aiQuota`), `adminMetrics.ts` (`entitlements`, `users`, `usageRollup`), `consultRequests.ts` (`consultRequests`). Enumerate these as the data classes in the runbook.
  - Enable PITR + a backup schedule via gcloud (one-time, idempotent), and record the exact commands in the runbook so the next operator can reproduce:
    - `gcloud firestore databases update --database='(default)' --enable-pitr --project "$PROJECT_ID"`
    - `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=7d --project "$PROJECT_ID"`
  - Restore drill restores to a **scratch database** (e.g. `restore-drill-YYYYMMDD`) so production is untouched, verifies a known child's `memoryEvents` count matches, then deletes the scratch DB. Document RTO actuals.
  - **Single-region risk:** the runbook records that `europe-west4` is single-region by deliberate choice (cost + EU-residency simplicity, satisfies NL/IL residency), the failure mode (regional outage = full Arbor outage), the mitigation (PITR enables cross-region restore to e.g. `europe-west1` within RTO), and a sign-off line.
- **Files to CREATE:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/docs/ops/dr-runbook.md`
- **Files to MODIFY:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/docs/architecture/well-architected-assessment-2026-06-04.md` — flip REL-1 row status to "mitigated (single-region accepted, sign-off in dr-runbook.md)". *Shared doc, low-traffic — append/edit the REL-1 row only.*
- **Interfaces/contracts:** No code interfaces. Infra: Firestore PITR flag + backup schedule on `(default)`; IAM role `roles/datastore.owner` (deploy SA already holds it per `arbor-deploy.yml` notes) covers backup/restore. Data classes enumerated above.
- **Test plan:** No unit/integration code changes, so `tsc`/tests/`vite build` stay green by construction (no code touched). Verify live: run the three `gcloud ... describe/list` checks above; confirm the drill section of the runbook contains real measured numbers and the scratch DB was deleted. Add the verification commands to the runbook as a quarterly checklist.
- **NL note:** PITR + tested restore is the **Article 32 GDPR "ability to restore availability and access" control** and the resilience evidence a Dutch DPIA / municipality DPA annex expects. The single-region sign-off and RTO/RPO table are standard procurement attachments for JGZ/insurer deals. **B2G-readiness gate: yes.**
- **IL note:** Under Amendment 13 the database holder must be accountable for the database's integrity and availability; a documented RTO/RPO + tested restore is the evidence. Residency unaffected (EU adequacy). No RTL/Hebrew surface (ops doc, internal).
- **Effort:** S · **Severity:** High · **Dependencies:** none · **Rollback:** PITR/backup are additive and safe to leave on; disabling is one gcloud command. Doc is revertible. **Cost impact:** PITR + daily backups add **storage-priced** charges (continuous backup + 7-day retained snapshots) on a small dataset — low single-digit €/mo at beta scale. Cheaper alternative if even that is unwanted: keep PITR (cheapest, 7-day window) and drop the explicit scheduled backup, documenting the reduced retention as accepted.

---

### REL-2 — Timeout + bounded retry/backoff + circuit-breaker around Vertex, graceful degradation, surfaced as a metric

- **Objective / done-when:**
  - Every model call has a **hard per-attempt timeout** (env `MODEL_TIMEOUT_MS`, default 30000) that aborts an in-flight request, so a hung Vertex call cannot pin an Express handler open.
  - The existing `withModelRetry` (already backoff+jitter, 3 attempts) is wrapped by a **circuit-breaker** keyed per provider/route family so that when the model is repeatedly failing, requests **fail fast** (no 3× backoff burn) until a cooldown elapses.
  - On exhaustion/open-circuit, AI routes return a **graceful-degradation** payload (calm, non-alarming parent-facing message) with HTTP 503 + `Retry-After`, rather than a raw 500.
  - **Metrics surfaced:** model attempt outcomes (success / transient-retry / timeout / circuit-open) are emitted via the existing structured logger (`logger.ts`) with stable labels so a Cloud Monitoring log-based metric (REL-5) can chart AI success rate.
  - Testable: a unit test asserts (a) a call that never resolves rejects within `MODEL_TIMEOUT_MS`; (b) after N consecutive failures the breaker short-circuits the (N+1)th call without invoking the underlying fn; (c) the breaker half-opens after cooldown.
- **Approach (grounded in real code):**
  - **Timeout.** `src/ai/modelRetry.ts` `withModelRetry(fn)` runs `fn()` with no deadline. The Claude path (`claudeVertexProvider.ts:70`) uses raw `fetch` with no `signal`; the Gemini/Vertex SDK paths (`modelRouter.ts`) accept no deadline either. Add a generic `withTimeout<T>(fn, ms)` helper in `modelRetry.ts` that races `fn()` against an `AbortController`-backed timer, and:
    - In `claudeVertexProvider.ts`, thread the controller's `signal` into the `fetch(url, { ..., signal })` so the socket is actually aborted (not just the promise abandoned).
    - In `modelRouter.ts`, wrap the SDK calls in `withTimeout` (SDKs don't expose abort uniformly, so the timeout rejects the awaited promise; the retry/breaker layer treats `AbortError` as a transient failure — extend `isTransientModelError` to match `AbortError`/`The operation was aborted`).
  - **Circuit-breaker.** Add `src/ai/circuitBreaker.ts`: an in-process breaker (`failureThreshold`, `cooldownMs`, `halfOpenProbe`) with `run(key, fn)`. Keyed by `provider:routeFamily` (e.g. `vertex_claude:coach`). In-process is the correct scope here — Cloud Run instances fail independently and a per-instance breaker protects that instance's worker pool without a shared store (no Redis, no recurring cost). Compose order inside the providers: `breaker.run(key, () => withModelRetry(() => withTimeout(fn, ms)))`.
  - **Graceful degradation.** The providers throw; the catch is in the route handlers in `src/routes/api.ts` (e.g. `/api/chat`, `/api/council`). Add a small `degradedModelResponse()` helper (new `src/ai/degraded.ts`) returning a typed sentinel; in `api.ts` catch a `ModelUnavailableError` (new error class exported from `circuitBreaker.ts`/`modelRetry.ts`) and respond 503 + `Retry-After` + a calm message. **Do not** route a model outage through the safety-escalation path (`src/safety/escalation.ts`) — degradation is an infra event, not a child-safety event.
  - **Metric surface.** Use the existing `logger` (`src/server/logger.ts`, Cloud-Logging-shaped JSON). Emit `logger.info("model_call", { route, provider, outcome: "ok|retry|timeout|circuit_open", attempt, latencyMs })`. REL-5 builds the log-based metric on `outcome`.
- **Files to CREATE:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/ai/circuitBreaker.ts`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/ai/circuitBreaker.test.ts`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/ai/degraded.ts`
- **Files to MODIFY:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/ai/modelRetry.ts` — add `withTimeout`, extend `isTransientModelError` to treat abort as transient, export `ModelUnavailableError`. *Small, low-traffic but imported widely — keep the existing `withModelRetry` signature byte-identical (default arg unchanged) to avoid touching call sites.*
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/ai/modelRouter.ts` — **SHARED/high-traffic.** Wrap each `withModelRetry(() => ...)` call (lines ~179, 199, 223, 240 in `GeminiDevProvider`; ~266, 286, 310, 327 in `VertexGeminiProvider`) with the breaker + timeout. Touch only the bodies passed to `withModelRetry`; do not change `ModelProvider` interface or `routeDecision`. Add the `logger.info("model_call", …)` emit at the `recordUsage(...)` sites.
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/ai/claudeVertexProvider.ts` — thread `signal` into `fetch` (line 70) and wrap the `withModelRetry` body (line 69) with breaker+timeout.
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/config/env.ts` — **SHARED.** Add `modelTimeoutMs`, `breakerFailureThreshold`, `breakerCooldownMs` to `ArborConfig` (after `maxOutputTokens`, line ~32) and to `loadConfig` (after line 117) with safe defaults. Additive only — no prod invariant added.
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/routes/api.ts` — **SHARED/high-traffic.** Add `catch (ModelUnavailableError)` → 503 graceful degradation in the AI route handlers; do not alter SSE streaming framing (`beginSse`/`writeSse`).
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/cloudbuild.prod.yaml` — **SHARED.** Optionally append `@MODEL_TIMEOUT_MS=30000` to the single `^@^…` env line (line 49). Defaults make this optional.
- **Interfaces/contracts:** New `withTimeout<T>(fn, ms): Promise<T>`; `CircuitBreaker.run<T>(key, fn): Promise<T>`; `ModelUnavailableError`. Env vars: `MODEL_TIMEOUT_MS` (default 30000), `MODEL_BREAKER_THRESHOLD` (default 5), `MODEL_BREAKER_COOLDOWN_MS` (default 30000). Log event contract: `{ message: "model_call", route, provider, outcome, attempt, latencyMs }`.
- **Test plan:** `circuitBreaker.test.ts` covers timeout-rejection, open-after-threshold (assert underlying fn not called when open), half-open recovery, fake timers. Extend `modelRouter.test.ts` to assert a timeout maps to a degraded 503 rather than a 500 (mock provider that hangs). `npm test` (vitest), `npm run lint` (tsc) and `npm run build` must stay green; `npm run eval:safety` unaffected (degradation is not a safety path). Live: with breaker threshold low and Vertex creds revoked in a scratch deploy, confirm requests fail fast with 503 + `Retry-After` and `model_call`/`outcome=circuit_open` appears in Cloud Logging.
- **NL note:** Graceful degradation copy must be available for a future Dutch UI (app is EN/HE today); keep the parent-facing string in the i18n layer, not hardcoded, so NL can be added. The metric feeds the availability SLO that backs the NL DPA uptime expectation.
- **IL note:** The degradation message must render **RTL** and read naturally in Hebrew (Hebrew/RTL is partly shipped). This is a parent-facing string — route it through the same i18n/RTL path as other coach copy, not a raw English literal.
- **Effort:** M · **Severity:** High · **Dependencies:** none (REL-5 *consumes* its metric). **Rollback:** Set `MODEL_TIMEOUT_MS`/threshold high to neuter the breaker without redeploy; or revert the three provider files — the additive helpers are inert if unused. **Cost impact:** **Saves** cost (fail-fast avoids 3× backoff on a dead model; timeouts free Cloud Run CPU sooner). No new infra, no recurring spend. In-process breaker deliberately avoids Redis.

---

### REL-3 — Verify the AI quota persists across Cloud Run revisions (delivered with SEC-2 shared store)

- **Objective / done-when:**
  - Confirmed (with a test + a live check) that the per-user hourly AI cap is enforced by the **shared** `FirestoreCounterStore`, not the per-instance `MemoryCounterStore`, in prod, so the cap is **not** reset by scale-out or revision rollout.
  - Testable: an integration test drives `createAiQuota` against `FirestoreCounterStore` (emulator or mock) and asserts the count survives constructing a *second* store instance (simulating a new Cloud Run instance) with the same window. A live check confirms `X-AI-Quota-Remaining` decrements consistently across rapid sequential calls that Cloud Run may spread over instances.
- **Approach (grounded in real code):**
  - The mechanism **already exists**: `createApp.ts:70` builds `counters = createCounterStore(config)`; `quotaStore.ts:100` returns `FirestoreCounterStore` when `memoryAdapter === "firestore"` (prod invariant forces firestore — `env.ts:141`). `aiQuota.ts` keys by `req.user.uid || req.ip`. Firestore docs are `aiQuota/{name}_{key}_{windowStart}` with `FieldValue.increment(1)` (atomic, cross-instance). It **fails open** on Firestore error (`quotaStore.ts:83`).
  - This mission is therefore **verification + guard-rail**, not a rebuild. The only code-worthy gap: there is no test that the count is *shared across constructed instances*, and no assertion that prod actually selected the Firestore store. Add:
    - A unit/integration test in `quotaStore.test.ts` (file exists) that increments via store A and reads the same window via store B and asserts continuity.
    - A boot-time assertion/log: in `createApp.ts` (or a tiny check in `quotaStore.ts`) log which counter implementation was selected (`logger.info("quota_store", { impl: "firestore"|"memory" })`) so a prod deploy visibly proves Firestore is active.
  - Note the **fail-open** behavior is intentional (availability over enforcement) and should be documented in the SLO doc (REL-5) as a known cost-risk under Firestore outage.
- **Files to CREATE:** none (extend existing test).
- **Files to MODIFY:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/server/quotaStore.test.ts` — add the cross-instance continuity test.
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/server/createApp.ts` — **SHARED/high-traffic.** Add one `logger.info("quota_store", { impl })` line right after `counters = createCounterStore(config)` (line 70). One line, no behavior change.
- **Interfaces/contracts:** No interface change. `UsageCounterStore.increment/peek` already the contract. Collection `aiQuota`; TTL field `expireAt` (already written) — see REL-6 note on enabling the TTL policy.
- **Test plan:** `npm test` covers the new continuity test. `tsc`/`build` green (one log line). Live: hit an AI endpoint repeatedly; assert `X-AI-Quota-Remaining` monotonically decreases and that, after a revision deploy mid-window, the count continues rather than resetting; confirm `quota_store impl=firestore` in prod logs.
- **NL note:** None market-specific. (Quota persistence is a cost-control + fairness control, not a privacy/B2G gate.)
- **IL note:** None market-specific.
- **Effort:** S · **Severity:** Med · **Dependencies:** SEC-2 (shared store; already delivered per code). **Rollback:** test-only + one log line — trivially revertible. **Cost impact:** None new. (Reminder: enable the Firestore **TTL policy on `aiQuota.expireAt`** — already written by `quotaStore.ts:76` — so stale window docs self-delete; otherwise `aiQuota` grows unbounded. Folded into REL-6.)

---

### REL-4 — Dedicated `/api/healthz` (liveness) + `/api/readyz` (readiness incl. Vertex/Firestore reachability) wired to Cloud Run probes

- **Objective / done-when:**
  - `GET /api/healthz` returns 200 with `{ status: "ok" }` whenever the process is alive — **no external dependency checks, no auth, no rate-limit** (must stay green even when Vertex/Firestore are down, so Cloud Run does not needlessly kill a live instance).
  - `GET /api/readyz` returns 200 only when the instance can actually serve: a **cheap** Firestore reachability probe and a Vertex-reachability signal (lazy import resolved + breaker not open). Returns 503 with a per-dependency status object when not ready.
  - Cloud Run **startup** and **liveness** probes are wired to these paths so traffic is not routed to a not-ready instance (the assessment's REL-4 root cause: the SPA catch-all `app.get("*")` masks readiness, and the Vertex client import is **lazy** — `modelRouter.ts:348` — so a fresh instance looks "up" before Vertex is reachable).
  - Testable: `supertest` asserts `healthz` 200 without auth; `readyz` 200 when deps mocked healthy and 503 when Firestore probe throws.
- **Approach (grounded in real code):**
  - There is **no health endpoint today** (grep for `healthz/readyz/health` returns nothing). The SPA fallback `app.get("*", … sendFile(index.html))` lives in `start.ts:20`; the `/api` chain in `createApp.ts` runs auth (`createAuthMiddleware`, line 112) + rate-limit (line 99) **before** the router, so health checks must mount **before** those.
  - Add a tiny `src/server/health.ts` exporting `createHealthRouter(config, deps)`:
    - `/healthz` → `res.json({ status: "ok", env: config.arborEnv })`. No I/O.
    - `/readyz` → `Promise.allSettled([firestorePing(), vertexReady()])`. `firestorePing()` = a `.limit(1).get()` on a tiny known collection (or `db.listCollections()`light) wrapped in a 2s timeout; `vertexReady()` = breaker-state check from REL-2 (open ⇒ degraded), not a real model call (a real call costs money and tokens — **explicitly avoid** billing the readiness probe).
  - Mount in `createApp.ts` **before** the rate-limit/auth lines: `app.use("/api", createHealthRouter(...))` placed right after the observability middleware (after line 80) and before line 99. Because it is mounted on `/api` but before auth, exclude these two paths from the auth/rate-limit/quota chains (they already only match the AI route arrays, and auth is `app.use("/api", ...)` — so guard inside the health router by registering it first; Express runs middleware in order, and the health router will `res.end` before auth sees the request).
  - Wire Cloud Run probes. Cloud Run YAML-style probes are not expressible in the current `gcloud run deploy` flag set in `cloudbuild.prod.yaml`; add `--startup-probe` / `--liveness-probe` via either `gcloud run services update` flags or a committed `service.yaml`. Document in the DR runbook. Startup probe → `/api/readyz` (gates traffic until Vertex/Firestore reachable); liveness probe → `/api/healthz` (restarts only a truly hung process).
- **Files to CREATE:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/server/health.ts`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/server/health.test.ts`
- **Files to MODIFY:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/server/createApp.ts` — **SHARED/high-traffic.** Insert `app.use("/api", createHealthRouter(...))` **between line 80 (`requestContextMiddleware`) and line 82 (`helmet`)** so it runs before CORS/rate-limit/auth. One mount line + import. Must not change the order of the existing helmet→cors→webhook→ratelimit→auth chain.
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/cloudbuild.prod.yaml` — **SHARED.** Add startup/liveness probe config to the `gcloud run deploy` step (or convert that step to a committed `service.yaml`). Touches the deploy step (lines 32–49) only.
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/firebase.json` — verify the Hosting rewrite `/api/**` → `arbor-api` (lines 5–11) forwards `/api/healthz`; it already does (wildcard). No edit expected unless a public unauthenticated `/healthz` outside `/api` is wanted (not recommended — keep under `/api`).
- **Interfaces/contracts:** `createHealthRouter(config, { firestorePing, breaker }) : express.Router`. Responses: `/healthz` → `{status:"ok",env}`; `/readyz` → `{status:"ready"|"degraded", checks:{firestore:"ok"|"fail", vertex:"ok"|"open"}}`. Cloud Run probe config: `startupProbe.httpGet.path=/api/readyz`, `livenessProbe.httpGet.path=/api/healthz`, conservative `failureThreshold`/`periodSeconds`.
- **Test plan:** `health.test.ts` via `supertest`: `healthz` 200 no-auth; `readyz` 200 deps-ok, 503 firestore-throws (mock), `vertex:"open"` when breaker open. `tsc`/`npm test`/`build` green. Live: `curl https://<host>/api/healthz` → 200; kill Firestore reachability in a scratch env and confirm `readyz` 503 and Cloud Run holds traffic off the instance.
- **NL note:** Readiness/liveness probes underpin the **availability SLO** an NL municipality/insurer DPA will reference, and are evidence of operational maturity in a DPIA. The Firestore probe must be a **metadata/listing or `.limit(1)` read** — never read child PII — so the probe itself processes no personal data. **B2G-readiness gate: contributes (operational maturity).**
- **IL note:** Same operational-maturity value under Amendment 13 accountability. Probe endpoints are JSON/no UI — no RTL concern.
- **Effort:** S · **Severity:** Med · **Dependencies:** REL-2 (reuses breaker state for `vertexReady()`; if REL-2 not yet landed, `vertexReady()` degrades to "lazy import resolves" only). **Rollback:** Remove the probe config (Cloud Run reverts to default TCP-port probe) and the single mount line; endpoints become harmless dead routes. **Cost impact:** Negligible. Readiness probe must **not** call a model (would bill tokens) — it only pings Firestore (metadata read, effectively free) and checks in-process breaker state.

---

### REL-5 — Define SLIs/SLOs (availability, p95 latency, AI success rate) + error budget + burn alerts

- **Objective / done-when:**
  - A committed `docs/ops/slo.md` defines three SLIs with numeric SLO targets and a measurement window (e.g. 30-day rolling): **availability** (non-5xx ratio on `/api/**`), **p95 latency** (request latency excl. SSE long-polls), **AI success rate** (`model_call` outcome=ok ÷ total, from REL-2 logs). Each SLO names its **error budget** and the **burn-rate alert** thresholds (fast-burn 2%/1h, slow-burn 5%/6h).
  - Cloud Monitoring resources exist (declared as code, not click-ops): a **log-based metric** on the `model_call` log event (REL-2) for AI success rate, and **alerting policies** for SLO burn, routed to a notification channel.
  - Testable (as far as code allows): the log event the metric depends on is asserted present by REL-2's tests; the SLO doc parses (markdown lint) and its alert thresholds match the deployed policy (manual cross-check recorded in the doc).
- **Approach (grounded in real code):**
  - The telemetry foundation already exists: `src/server/logger.ts` emits Cloud-Logging-shaped JSON including `httpRequest.status` and `latencyMs` for **every** request (`requestObservability`, lines 50–76). Availability and p95 SLIs can therefore be built from **existing logs** with **no new code** — Cloud Run's built-in `request_count` / `request_latencies` metrics already carry status + latency, so availability + p95 are pure Monitoring config.
  - AI success rate needs the REL-2 `model_call` log event; define a **log-based counter metric** filtered on `jsonPayload.message="model_call"` with a label on `outcome`.
  - Declare the metric + alert policies as infra-as-code under `infra/monitoring/` (gcloud `monitoring` commands or a Terraform/`gcloud alpha monitoring policies create` JSON) so they are reviewable and reproducible — avoid console-only setup.
  - **Cost-aware alerting:** use a single low-cost notification channel (email to the founder, or a free Pub/Sub→existing webhook) rather than paid PagerDuty/Opsgenie at beta scale. Document the upgrade path for B2G SLAs.
- **Files to CREATE:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/docs/ops/slo.md`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/infra/monitoring/ai-success-log-metric.json` (log-based metric definition)
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/infra/monitoring/alert-policies.json` (burn-rate alert policies)
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/infra/monitoring/README.md` (apply commands)
- **Files to MODIFY:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/docs/architecture/well-architected-assessment-2026-06-04.md` — flip REL-5 + OPS-1 (SLO portion) status. *Shared doc, edit those rows only.*
  - (No application source changes — depends on REL-2's log event, not on new app code.)
- **Interfaces/contracts:** Log-based metric filter: `jsonPayload.message="model_call"`, label `outcome`. SLO targets (proposed, tune in doc): availability ≥ 99.5%, p95 < 4s for non-SSE AI routes, AI success ≥ 98%. Notification channel id referenced by both alert policies. No env vars, no code interface.
- **Test plan:** No app code → `tsc`/tests/`build` unaffected. Verify live: force a burst of `model_call outcome=timeout` (point Vertex at a bad endpoint in a scratch env) and confirm the AI-success log-based metric drops and the slow-burn alert fires to the channel; confirm availability/p95 dashboards populate from Cloud Run built-in metrics. Record the manual threshold cross-check in `slo.md`.
- **NL note:** A written availability SLO + error budget is a **direct input to the SLA/DPA annex** for NL municipality/JGZ/insurer procurement. The AI-success SLI also evidences that AI degradation is monitored — relevant to the DPIA's "automated processing reliability" section. **B2G-readiness gate: yes.**
- **IL note:** Supports Amendment 13 accountability (you can demonstrate monitored service health and detect incidents that may trigger breach-notification timelines). Alerts/dashboards are operator-facing — no RTL surface.
- **Effort:** S · **Severity:** Med · **Dependencies:** REL-2 (provides the `model_call` metric source). Availability/p95 portions have **no** dependency (ride on Cloud Run built-ins). **Rollback:** Delete the Monitoring policies/metric (no runtime effect) and the docs. **Cost impact:** Log-based metrics + alert policies are within Cloud Monitoring free/low tiers at beta volume; the only recurring cost is the notification channel — keep it **email/Pub/Sub (free)**, not paid paging, until a B2G SLA demands 24/7 on-call.

---

### REL-6 — Audit Firestore query patterns; add required composite indexes (and TTL) ahead of need

- **Objective / done-when:**
  - Every Firestore query that combines `where` + `orderBy` (or multi-field `where`) across the codebase is enumerated, and any that requires a composite index has one declared in `firestore.indexes.json` **before** it can fail at runtime on grown data.
  - The `aiQuota.expireAt` **TTL policy** is enabled (the field is already written by `quotaStore.ts:76` but no TTL policy exists), so window docs self-expire.
  - Testable: `firebase deploy --only firestore:indexes --dry-run` (or `firestore.indexes.json` schema validity) passes; a documented audit table maps each query → required index → present/added.
- **Approach (grounded in real code):** Query inventory from the codebase:
  - `firestoreMemoryStore.ts:23` — `collectionGroup("memoryEvents").orderBy("createdAt","asc").where("childId","==",childId)`. This needs a **COLLECTION_GROUP composite index** on `(childId ASC, createdAt ASC)` — which **already exists** in `firestore.indexes.json` (lines 4–10). Confirmed covered. (This is the very index from the earlier Gemini-outage fix per project memory.)
  - `adminMetrics.ts:78-80` — `entitlements.where("plan","==","plus")`, `where("plan","==","family")`, `where("status","==","in_trial")`. Single-field equality with `.count()` only → **single-field auto-indexes suffice**, no composite needed.
  - `consultRequests.ts:58` — `consultRequests.where("ownerUid","==",ownerUid).get()` (no orderBy) → single-field auto-index suffices.
  - **Finding:** today the only composite-requiring query is already indexed. So REL-6 is mostly a **documented audit + future-proofing + the TTL policy**, not a pile of new indexes. Add indexes **only** for queries that are about to grow:
    - When `consultRequests` or `memoryEvents` listing gains an `orderBy("createdAt","desc")` for UI pagination (likely near-term), pre-add the matching composite index now so the feature ships without a runtime "needs index" error.
  - Enable the `aiQuota` TTL policy (gcloud: `gcloud firestore fields ttls update expireAt --collection-group=aiQuota --enable-ttl`). Document in the runbook.
  - Produce `docs/ops/firestore-query-audit.md`: a table of (file:line → collection → predicate → index status).
- **Files to CREATE:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/docs/ops/firestore-query-audit.md`
- **Files to MODIFY:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/firestore.indexes.json` — **SHARED (infra).** Append any pre-emptive composite indexes (e.g. `consultRequests (ownerUid ASC, createdAt DESC)`, `memoryEvents` COLLECTION_GROUP `(childId ASC, createdAt DESC)` if a desc UI sort lands). Append to the `indexes` array; do not reorder/remove the existing `memoryEvents (childId, createdAt ASC)` entry (lines 3–11) — removing it would break the live listing query. Add the `aiQuota.expireAt` TTL via `fieldOverrides` is **not** how TTL is set (TTL is a gcloud field op, not an index doc) — set it via gcloud and note it in the audit doc.
- **Interfaces/contracts:** Firestore composite index definitions (collectionGroup, queryScope, fields[]). TTL policy on `aiQuota.expireAt`. No app code/env change.
- **Test plan:** Validate `firestore.indexes.json` parses and `firebase deploy --only firestore:indexes` applies cleanly in a scratch project (dry-run in CI if feasible). No app code → `tsc`/tests/`build` unaffected. Live: confirm `gcloud firestore indexes composite list` shows the declared indexes `READY`, and `gcloud firestore fields ttls describe expireAt --collection-group=aiQuota` shows TTL active. The deploy workflow already runs `firebase deploy --only ...,firestore` (`arbor-deploy.yml:111`) so new indexes ship on merge.
- **NL note:** Indexing/TTL has no direct privacy-law gate, but the **`aiQuota` TTL is a data-minimisation control** (don't retain per-user usage counters longer than needed) — a small GDPR/AVG storage-limitation win worth noting in the DPIA. **B2G gate: minor (data minimisation).**
- **IL note:** Same data-minimisation framing under Amendment 13 (retain only as long as necessary). No RTL surface.
- **Effort:** S · **Severity:** Low · **Dependencies:** none (TTL on `aiQuota` complements REL-3). **Rollback:** Indexes are additive (deleting a never-used index is safe); the existing `memoryEvents` index must **not** be removed. TTL can be disabled with one gcloud command. **Cost impact:** Indexes add marginal storage + slightly higher write amplification; the `aiQuota` TTL **reduces** storage by auto-purging stale windows. Net negligible/positive.
