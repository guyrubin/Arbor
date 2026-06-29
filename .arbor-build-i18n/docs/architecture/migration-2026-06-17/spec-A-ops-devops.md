# Spec A — Operational Excellence & DevOps (DORA)

**Migration set:** 2026-06-17 Well-Architected hardening
**Domain owner:** Operational Excellence (DORA four keys, observability, release safety, runbooks)
**Canonical codebase:** `app/src` (React 19 / Vite client + Express API on Cloud Run `europe-west4`, Firestore, Vertex AI — Claude 3.5 Sonnet on the `coach_high_stakes` route, Gemini 2.5 Flash elsewhere).

## Domain intro

This domain hardens how Arbor is **observed, released, and recovered**. The good news from reading the code: the OPS backlog is partly already in flight and several mission descriptions are stale relative to `main`:

- **OPS-1 is ~60% built.** `app/src/server/logger.ts` already emits structured single-line JSON (`severity`/`message`/`httpRequest`) that Cloud Logging + Error Reporting ingest natively; `requestObservability` (wired at `createApp.ts:78`) stamps a request id, echoes `X-Request-Id`, and logs method/path/status/latency with `userUid`; `app/src/ai/usage.ts` already emits an `ai.usage` line per model call (tokens by route/provider/model) and rolls it into Firestore (`usageRollup.ts`). The **gaps** are: no Cloud Trace propagation, no PII scrubbing guarantee on the request log line, no error tracker integration, and **no alert policies**. The grep for `console.*` finds only 6 files (client `analytics.ts`, `ErrorBoundary.tsx`, `ArborContext.tsx`, `modelRouter.ts:164` boot warning, `logger.ts` itself, `start.ts` boot lines) — so the "only console.* in 3 files" framing is obsolete; server request/AI logging is already structured.
- **OPS-2:** a stage config exists (`cloudbuild.yaml`, `_ARBOR_ENV: stage`) but **nothing uses it** — `arbor-deploy.yml` calls only `cloudbuild.prod.yaml`, so `main` → prod with no staging gate, no smoke test, no rollback command. **No `/healthz` endpoint exists** (grep confirms zero health routes; all `router.get` routes are under `/api` and behind auth).
- **OPS-4:** coverage **thresholds already exist** in `scripts/vitest.config.mjs` (statements 40 / branches 30) and a `test:coverage` script exists in `package.json` — but **CI runs `npm test`, not `npm run test:coverage`**, so the threshold is never enforced and `safety/contracts/routes/memory` are not in the `include` list.
- **OPS-5:** the "451-byte stub" is `docs/compliance/incident-response-plan.md` — a 16-line skeleton with no roles, sev levels, comms tree, or breach-notification clock.
- **OPS-6:** `framework.json` lives at `app/src/framework.json`; `eval:safety` (`scripts/safety-eval.mjs`) and `check:framework` already run in CI (`arbor-ci.yml:25-26`). The gate exists in CI but is **not formalized** — there is no `CODEOWNERS` (grep finds none in-repo) and no branch-protection requirement tying `framework.json` changes to review.

**Guiding principles for this set:** additive and reversible; prefer managed-service config (Cloud Monitoring alert policies, Cloud Run revision tags, Error Reporting auto-grouping) over new code; flag every recurring cost. The two markets (NL: GDPR/AVG + DPIA + B2G audit bars; IL: Privacy Law Amendment 13 — breach notification + DPO + RTL/Hebrew) are treated as first-class in each mission's NL/IL note, especially around **log PII scrubbing**, **breach-notification timers**, and **audit-trail retention** which are the B2G-readiness gates.

---

### OPS-1 — Production-grade observability: traces, scrubbed logs, AI/latency metrics, error tracking, and alerts

- **Objective / done-when:**
  1. Every `/api/*` log line carries a Cloud Trace id (`logging.googleapis.com/trace`) parsed from the inbound `X-Cloud-Trace-Context` / `traceparent` header, so a request's logs, the `ai.usage` line, and any error correlate in one trace view.
  2. The request-completion log line is **provably PII-free**: only method, path (query-stripped — already done at `logger.ts:64`), status, latency, `requestId`, `userUid` (an opaque Firebase uid, not email). A unit test asserts no email/freetext/body field is ever emitted.
  3. Three **log-based metrics** plus alert policies exist (declared as code, not click-ops): (a) 5xx error-rate on `arbor-api`, (b) p95 request latency, (c) `ai.usage` token volume / AI-call count. Alert policies fire to a notification channel on error-rate > 2% over 5 min and p95 latency > 5 s over 10 min.
  4. Unhandled server errors reach **GCP Error Reporting** (already automatic for the `ERROR` severity + stack format in `logger.error`) — verified by a forced 500 appearing grouped in Error Reporting. Sentry is **explicitly deferred** as a recurring-cost alternative (see Cost impact).
- **Approach (grounded in real code):**
  - **Trace propagation (new, small):** add `app/src/server/trace.ts` exporting `traceFieldsFromHeaders(headers, projectId)` that parses `X-Cloud-Trace-Context` (`TRACE_ID/SPAN_ID;o=1`) and W3C `traceparent`, returning `{ "logging.googleapis.com/trace": "projects/<pid>/traces/<id>", "logging.googleapis.com/spanId": <span> }`. In `requestObservability` (`logger.ts:50-76`) compute these once and merge into the `fields` object already built at `logger.ts:59`. Pass `gcpProjectId` in by reading `process.env.GCP_PROJECT_ID` inside `logger.ts` (logger has no config handle today — keep it env-direct to avoid a signature change rippling through `createApp.ts`). No new SDK; this is header parsing only, so no agent/library cost.
  - **PII-scrub guarantee:** the current line is already minimal. Harden it by introducing a single allow-list serializer in `logger.ts` so future fields can't leak: wrap the `httpRequest`/`fields` assembly so only the known keys pass. Add `userUid` only (never `user.email`, which is available on `req.user` at `logger.ts:68` — confirm it is NOT added).
  - **Metrics + alerts as config (no code):** add `infra/monitoring/` with `log-based-metrics.yaml` and `alert-policies.yaml` plus an apply script (`infra/monitoring/apply.sh` using `gcloud logging metrics create` / `gcloud alpha monitoring policies create`). Metrics derive from existing log lines: 5xx from `httpRequest.status>=500`, latency from `latencyMs`, AI volume from the `ai.usage` `message` + `totalTokens`. This rides entirely on logs Arbor **already emits** — zero new instrumentation.
  - **Error Reporting:** already satisfied by `logger.error` (`logger.ts:32-38`) writing `severity:ERROR` + stack into `message`. Add one regression test asserting the shape; document the verified grouping.
- **Files to CREATE:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/server/trace.ts`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/server/trace.test.ts`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/server/logger.test.ts` (PII allow-list assertion)
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/infra/monitoring/log-based-metrics.yaml`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/infra/monitoring/alert-policies.yaml`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/infra/monitoring/apply.sh`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/infra/monitoring/README.md`
- **Files to MODIFY:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/server/logger.ts` — **SHARED/high-traffic** (imported by `createApp.ts`, `usage.ts`, `usageRollup.ts`, `adminMetrics.ts`, `routes/api.ts`). Touch only `requestObservability` (lines 50-76, add trace merge) and the `emit`/field assembly (lines 16-25 / 59-69, allow-list). Do **not** change the `logger` export signature.
- **Interfaces/contracts:** new `traceFieldsFromHeaders()`; log keys frozen to `{severity,message,time,requestId,httpRequest,latencyMs,userUid,"logging.googleapis.com/trace","logging.googleapis.com/spanId"}`. Env: reads `GCP_PROJECT_ID` (already set in `cloudbuild.prod.yaml:49`). Alert policy needs one notification channel id (email to founder) — a one-time `gcloud` setup, recorded in `infra/monitoring/README.md`.
- **Test plan:** unit — `trace.test.ts` (header → trace field mapping for both header formats + malformed input); `logger.test.ts` (capture `console.log`, assert emitted JSON keys ⊆ allow-list, assert no `email`). Integration — `vitest` over a supertest hit to a 500 route asserting `severity:ERROR` + stack present. Live — after deploy, curl a known route, find the `X-Request-Id` in Cloud Logging, confirm the trace link resolves and the `ai.usage` line shares the trace; force a 500 and confirm it groups in Error Reporting; trip the error-rate alert in a staging burst. `tsc` (`npm run lint`) + `npm test` + `vite build` stay green.
- **NL note:** the PII-scrub guarantee is the GDPR/AVG load-bearing control — logs of a children's product must not contain personal data; the allow-list + test is the auditable evidence for the DPIA. EU residency already met (`europe-west4`); ensure the log sink and any metric scopes stay in-region (no US log routing).
- **IL note:** Amendment 13 expects breach detectability — alert policies are the detection layer feeding OPS-5's breach clock. No content is logged, so Hebrew/RTL has no impact on the log line; classifier-language concerns belong to the AI specs, not here.
- **Effort:** M · **Severity:** High · **Dependencies:** none (foundation for OPS-3/OPS-5) · **Rollback:** revert `logger.ts` diff (request logging falls back to current behavior); `gcloud` metrics/policies are independently deletable via `apply.sh --delete`. · **Cost impact:** ~zero — log-based metrics + alert policies are free-tier on existing logs. **Deferring Sentry avoids a recurring SaaS bill**; revisit only if Error Reporting grouping proves insufficient.

---

### OPS-2 — Staging-first deploys with a smoke-gated prod promotion and one-command rollback

- **Objective / done-when:**
  1. `main` deploys to a **staging** Cloud Run service/revision first, never straight to prod.
  2. An automated **post-deploy smoke test** runs against staging — (a) `GET /healthz` 200 and (b) one safe authenticated AI call — and **gates** prod promotion; a red smoke aborts the prod step.
  3. Prod deploys with `--no-traffic` + a revision **tag**, then traffic is shifted only after smoke passes (progressive cutover possible).
  4. A documented **one-command rollback** restores the prior Cloud Run revision (`gcloud run services update-traffic arbor-api --to-revisions <prev>=100`), wrapped in `infra/rollback.sh`.
- **Approach (grounded in real code):**
  - **Health endpoint (new):** there is **no health route today**. Add a `/healthz` handler in `createApp.ts` mounted **before** the `/api` auth chain (so it needs no Firebase token) and before rate-limit — return `{status:"ok", env, revision: process.env.K_REVISION}`. Add a deeper `/readyz` that does a cheap Firestore `count()` ping (reuse the pattern in `adminMetrics.ts:63-71`) so staging readiness reflects real dependencies. Keep `/healthz` dependency-free for Cloud Run's own startup probe.
  - **Staging service:** `cloudbuild.yaml` already builds with `_ARBOR_ENV: stage` (lines 28-31) but is orphaned. Extend it to deploy a distinct service `arbor-api-stage` with the full stage env set (mirror the prod invariants from `cloudbuild.prod.yaml:49` but pointing at a stage project/db, or same project + `arbor-api-stage` service). It already enforces `MODEL_PROVIDER=vertex,MEMORY_ADAPTER=firestore` so prod boot invariants in `env.ts:137-150` hold in stage too.
  - **Smoke test (reuse, don't invent):** `app/scripts/live-smoke.mts`, `council-smoke.mts`, `vision-smoke.mts` already exist for live AI verification. Add a thin `app/scripts/post-deploy-smoke.mts` that takes a `--base-url` and a short-lived Firebase ID token (minted from a stage test-user via a CI secret) and hits `/healthz` then one cheap route (e.g. `POST /api/score-utterance` is a `router.get` no-AI route at `api.ts:698`, or a minimal `/api/chat` with a 1-token cap) — choose a **safe, low-cost** call. Exit non-zero on failure.
  - **Workflow restructure:** split `arbor-deploy.yml` (currently a single `deploy` job) into jobs: `deploy-stage` → `smoke-stage` → `deploy-prod (--no-traffic, tagged)` → `promote-prod`. Use `needs:` so prod is unreachable without green smoke. The existing quality gates (`npm ci/lint/test`, `arbor-deploy.yml:57-62`) move to a `gate` job all others `needs:`.
- **Files to CREATE:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/scripts/post-deploy-smoke.mts`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/cloudbuild.stage.yaml` (promote orphaned `cloudbuild.yaml` into a named stage deploy, or rename in place)
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/infra/rollback.sh`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/docs/ops/deploy-and-rollback.md`
- **Files to MODIFY:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/src/server/createApp.ts` — **SHARED/high-traffic**. Add `app.get("/healthz",…)` and `app.get("/readyz",…)` **between** the `helmet`/`cors` block (lines 82-94) and the billing/`/api` mounts (line 98 onward). Do not touch the existing middleware order for `/api`.
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/cloudbuild.prod.yaml` — **SHARED/high-traffic**. Add `--no-traffic` + `--tag candidate` to the `gcloud run deploy` step (lines 33-49); traffic shift happens in the workflow promote step. Touches only the deploy args block (lines 36-49).
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/.github/workflows/arbor-deploy.yml` — **SHARED (CI)**. Restructure single job into `gate → deploy-stage → smoke-stage → deploy-prod → promote-prod`. Touches the whole `jobs:` block (lines 41-113).
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/package.json` — **SHARED**. Add `"smoke": "tsx scripts/post-deploy-smoke.mts"` to `scripts` (after line 16).
- **Interfaces/contracts:** new routes `GET /healthz` (no auth), `GET /readyz` (no auth, Firestore ping). Env: `K_REVISION` (Cloud Run-provided) surfaced in health body; new CI secrets `STAGE_PROJECT_ID` (or reuse prod with a `-stage` service), `SMOKE_FIREBASE_TOKEN` (or a CI-minted custom token + `SMOKE_TEST_UID`). Cloud Run revision tags (`candidate`/`stable`).
- **Test plan:** unit — supertest assert `/healthz` 200 without a token and `/readyz` shape. Local — `npm run smoke -- --base-url http://localhost:3000` against `npm run dev`. Live — push to a throwaway branch deploying stage only; confirm smoke gates; deliberately break a route and confirm prod promotion is blocked; run `infra/rollback.sh` and confirm traffic returns to the prior revision. `tsc`/tests/`vite build` green.
- **NL note:** staging must **not** carry real Dutch child data — the smoke test user is synthetic; this keeps GDPR/AVG processing scope clean and is a B2G expectation (separation of test/prod data). Stage stays in `europe-west4`.
- **IL note:** safe-rollback + smoke directly supports Amendment 13's "maintain availability/integrity of the database" expectation; the smoke AI call should include a Hebrew prompt variant so an RTL/Hebrew regression is caught before prod.
- **Effort:** M · **Severity:** High · **Dependencies:** OPS-1 (smoke failures and rollbacks should surface in the trace/alert layer) · **Rollback:** the feature *is* rollback; the workflow change itself reverts by restoring the prior `arbor-deploy.yml`. · **Cost impact:** a stage Cloud Run service is **scale-to-zero** (no min-instances) ≈ near-zero idle cost; the one smoke AI call per deploy is a single capped generation (negligible). Avoid setting `min-instances` on stage.

---

### OPS-3 — DORA four-key dashboard from CI + deploy events

- **Objective / done-when:** a dashboard reports the four DORA keys — **deployment frequency**, **lead time for changes**, **change-failure rate**, **MTTR** — sourced from CI and deploy events, refreshed on every `main` deploy, with no manual data entry.
- **Approach (grounded in real code):**
  - **Emit deploy events from the workflow:** in `arbor-deploy.yml`'s prod promote step (after OPS-2 restructure), write a structured `deploy.event` log line to Cloud Logging via `gcloud logging write` with `{sha, deployedAt, leadTimeSec (now − commit author time), actor, result}`. `change-failure` is derived by correlating a deploy event with a subsequent OPS-2 smoke failure or an OPS-1 error-rate alert within a window; `MTTR` from the gap between a failure event and the next successful deploy/rollback (`infra/rollback.sh` also writes a `deploy.rollback` event).
  - **Dashboard as config:** add `infra/monitoring/dora-dashboard.json` (Cloud Monitoring dashboard) with four tiles backed by log-based metrics over `deploy.event` / `deploy.rollback` — same free, log-derived approach as OPS-1. No app code, no DB.
  - **Cheapest viable alt to a custom dashboard:** if a Monitoring dashboard proves fiddly, a fallback `scripts/dora-report.mjs` aggregates the last N `deploy.event` lines via `gcloud logging read --format json` into a printed markdown table for the weekly review — zero standing infra. Document both; ship the log-metrics dashboard first.
- **Files to CREATE:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/infra/monitoring/dora-dashboard.json`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/infra/monitoring/dora-metrics.yaml` (log-based metrics for `deploy.event`/`deploy.rollback`)
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/scripts/dora-report.mjs` (fallback CLI report)
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/docs/ops/dora-metrics.md`
- **Files to MODIFY:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/.github/workflows/arbor-deploy.yml` — **SHARED (CI)**. Add a `gcloud logging write deploy.event …` step in the prod promote job (depends on OPS-2's restructure).
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/infra/rollback.sh` — (created in OPS-2) emit a `deploy.rollback` event for MTTR.
- **Interfaces/contracts:** log schema `deploy.event` `{sha, deployedAt, commitAt, leadTimeSec, actor, env, result}` and `deploy.rollback` `{sha, fromRevision, toRevision, at}`. No env vars; uses the deploy SA's `logging.logWriter` (already has Cloud Build/Run roles per `arbor-deploy.yml:11-13`, may need `roles/logging.logWriter` added).
- **Test plan:** unit — `dora-report.mjs` against a fixture array of log lines asserting the four computed keys. Live — after two deploys + one forced rollback, confirm the dashboard tiles populate and `dora-report.mjs` matches. No app `tsc`/test impact (CI-only + mjs script).
- **NL note:** MTTR and change-failure rate are part of the operational-maturity evidence a JGZ/municipality procurement (B2G) reviews; keep the dashboard and underlying logs in `europe-west4`.
- **IL note:** no market-specific divergence — DORA keys are market-agnostic; the same dashboard serves both. (MTTR feeds the Amendment-13 breach-response narrative indirectly.)
- **Effort:** S · **Severity:** Med · **Dependencies:** OPS-1 (log-metric tooling + error-rate signal for change-failure), OPS-2 (deploy/promote/rollback steps that emit the events) · **Rollback:** delete the dashboard + metrics via the apply script; remove the workflow log-write step. · **Cost impact:** zero — log-based metrics + one Monitoring dashboard are free; `dora-report.mjs` is on-demand.

---

### OPS-4 — Enforce coverage in CI with thresholds on safety/, contracts/, routes/, memory/

- **Objective / done-when:**
  1. CI runs `npm run test:coverage` (not bare `npm test`) on PRs and `main`, and the build **fails** below threshold.
  2. The coverage `include` list covers `src/safety/**`, `src/contracts/**`, `src/routes/**`, `src/memory/**` (currently it lists only 5 single files).
  3. Per-area minimum thresholds are set and met (start realistic, ratchet up): safety ≥ existing-or-higher, contracts/routes/memory floors chosen from a measured baseline.
- **Approach (grounded in real code):**
  - `scripts/vitest.config.mjs` already has a v8 coverage block (lines 7-26) with `thresholds: { statements: 40, branches: 30 }` and `@vitest/coverage-v8` is already a devDependency (`package.json:57`). The work is (a) **broaden `include`** from the 5 named files to the four directory globs the mission names, (b) set thresholds, and (c) **wire CI to actually run it**.
  - Measure first: run `npm run test:coverage` locally to get the real baseline for `safety/contracts/routes/memory`, then set thresholds **at or just below** baseline so the gate is green on day one and is ratcheted in a follow-up (avoid blocking the team on a cliff). `routes/api.ts` is 77 KB and largely integration-shaped — set its floor conservatively or use per-glob `thresholds` with `perFile:false`.
  - In `arbor-ci.yml`, replace `- run: npm test` (line 24) with `- run: npm run test:coverage` and upload the `coverage/` artifact. In `arbor-deploy.yml` keep `npm test` (fast) OR also switch — recommend keeping deploy's gate as `test:coverage` too so prod can't ship under-covered.
- **Files to CREATE:** none required. *(Optional)* `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/docs/ops/coverage-policy.md` documenting the ratchet plan.
- **Files to MODIFY:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/app/scripts/vitest.config.mjs` — broaden `include` to `["src/safety/**","src/contracts/**","src/routes/**","src/memory/**", …existing]`, adjust `exclude` (keep the Firestore/local store excludes at lines 16-20 to avoid I/O-bound files tanking the number), set thresholds.
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/.github/workflows/arbor-ci.yml` — **SHARED (CI)**. Line 24 `npm test` → `npm run test:coverage`; add coverage artifact upload after line 24.
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/.github/workflows/arbor-deploy.yml` — **SHARED (CI)**. Optionally line 61 `npm test` → `npm run test:coverage`.
- **Interfaces/contracts:** vitest coverage `include`/`exclude`/`thresholds`. No app runtime change. No env vars.
- **Test plan:** local — `npm run test:coverage` prints the per-area summary; confirm it passes at the chosen thresholds and fails when a threshold is bumped above baseline (proves the gate bites). CI — open a draft PR, confirm the coverage job runs and the artifact uploads. No runtime/`vite build` impact.
- **NL note:** enforced coverage on `src/safety/**` (the escalation/output-screen path) is the testability evidence GDPR/AVG + a DPIA expect for an automated children's service — coverage on the safety screen is effectively a B2G gate. No NL-specific code path differs.
- **IL note:** ensure `src/safety/escalation.ts` tests in the covered set include **Hebrew + code-switched** inputs (Amendment-13 markets) — broadening `include` without Hebrew test cases gives false comfort. Coverage threshold should be paired with the AI-spec's Hebrew classifier tests so the number reflects real-language safety.
- **Effort:** M · **Severity:** Med · **Dependencies:** none (but coordinate threshold-setting with whoever owns the AI/safety specs so Hebrew cases land in the same window) · **Rollback:** revert the two CI lines + the vitest config; coverage stops gating. · **Cost impact:** zero — runs on existing GitHub Actions minutes; coverage adds seconds.

---

### OPS-5 — Real incident-response runbook with roles, sev levels, comms, and a breach-notification clock

- **Objective / done-when:** `docs/compliance/incident-response-plan.md` (today a 16-line skeleton) is replaced by an actionable runbook defining: severity matrix (Sev1–Sev3 with examples), named roles (Incident Commander, Comms Lead, Scribe — even if one person wears all hats at this stage), an escalation/on-call path, comms templates, and an explicit **breach-notification trigger** with **per-market legal clocks**. Linked from `README.md` and `docs/ops/`.
- **Approach (grounded in real code):**
  - Anchor the runbook to **what Arbor can actually do in an incident**, citing real levers: disable a route/provider (the `/api` middleware chain in `createApp.ts:99-125` — e.g. pull a route off the `createAiQuota`/`createApp` mount, or flip `MODEL_PROVIDER`), the OPS-2 **rollback** (`infra/rollback.sh`), OPS-1 **alerts/traces** as the detection + triage source, and the existing audit/redaction primitives (`server/redaction.ts`, `server/logger.ts`) for "review logs with least exposure to child-sensitive content" (the skeleton's step 3).
  - Define triggers from the skeleton's four events (unauthorized child-data access, unsafe AI output reaching a parent, mishandled high-risk disclosure, export/delete failure) and map each to a **Sev level** + **owner** + **first action**.
  - Breach clock table: **NL/EU GDPR Art. 33 — 72 hours** to the Autoriteit Persoonsgegevens (and data subjects if high risk, Art. 34); **IL Amendment 13 — breach notification to the Privacy Protection Authority / affected subjects** per the 2025 regime. Cross-link `docs/compliance/dpa-outline.md` and `docs/compliance/data-retention-policy.md` (both exist).
- **Files to CREATE:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/docs/ops/on-call.md` (escalation path + contact rota)
  - *(optional)* `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/docs/ops/incident-comms-templates.md`
- **Files to MODIFY:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/docs/compliance/incident-response-plan.md` — replace the 16-line stub with the full runbook (keep the four trigger events, expand around them).
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/README.md` — add a one-line link to the runbook under an "Operations" heading.
- **Interfaces/contracts:** none (docs). References real assets: `infra/rollback.sh` (OPS-2), `infra/monitoring/alert-policies.yaml` (OPS-1), `createApp.ts` route-disable points, `server/redaction.ts`.
- **Test plan:** review-only — run a **tabletop** against one scenario (unsafe AI output reaches a parent in Hebrew) and confirm each step maps to a real lever and an owner. Verify every internal link resolves (`docs/compliance/*`, `infra/*`). No code/`tsc` impact.
- **NL note:** the **72-hour GDPR Art. 33 clock to the AP** is the single most important addition; B2G DPAs with municipalities/insurers will require this runbook to exist and name a contact. Include the Dutch supervisory authority by name (Autoriteit Persoonsgegevens) and the DPIA cross-reference.
- **IL note:** add the **Amendment 13 breach-notification path** (Privacy Protection Authority) and the **DPO/database-accountability** trigger; since Hebrew/RTL is live, the comms templates must have a Hebrew variant and the runbook must assume child-sensitive content may be Hebrew (log-review-with-least-exposure step applies equally).
- **Effort:** S · **Severity:** Med · **Dependencies:** OPS-1 (detection/alerts referenced), OPS-2 (rollback lever referenced) — can be **drafted in parallel** and finalized once those land · **Rollback:** trivial (revert the markdown). · **Cost impact:** zero.

---

### OPS-6 — Formalize the framework.json change gate: PR review + safety eval re-run

- **Objective / done-when:**
  1. Any change to `app/src/framework.json` (and the safety-eval'd copy files) **requires PR review** by a designated owner — enforced by `CODEOWNERS` + branch protection, not convention.
  2. The existing `eval:safety` and `check:framework` CI gates are **provably required status checks** on PRs touching those paths (today they run but a branch could merge without them being mandatory).
- **Approach (grounded in real code):**
  - CI **already runs** `npm run check:framework` and `npm run eval:safety` (`arbor-ci.yml:25-26`), and `framework-check.mjs` validates `app/src/framework.json` against `docs/developmental-ai-operating-model.md` (domains, age bands, six frames) while `safety-eval.mjs` scans `framework.json` + safety copy files (`safety/escalation.ts`, `contracts/coach.ts`, `routes/api.ts`, `config/env.ts`) for forbidden claims. The gate **content** exists; the missing piece is **governance**.
  - Add a `CODEOWNERS` (none exists in-repo) assigning `app/src/framework.json`, `knowledge/framework/**`, `app/src/safety/**`, `app/src/contracts/coach.ts`, and `docs/developmental-ai-operating-model.md` to the safety/clinical owner. Document branch-protection: require PR review + the `app-quality-gates` check (which includes `eval:safety` + `check:framework`) on `main`. Branch protection is a GitHub repo setting (not a file) — capture it in `docs/ops/change-control.md` with the exact toggles since it can't be committed.
  - *(Optional, low-cost):* a `paths`-filtered CI job that re-runs `eval:safety`/`check:framework` and adds a labeled "framework-change: needs safety sign-off" comment so reviewers can't miss it — but the simplest, cheapest formalization is `CODEOWNERS` + required checks, no new workflow.
- **Files to CREATE:**
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/.github/CODEOWNERS`
  - `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/docs/ops/change-control.md` (branch-protection settings + the framework-change policy)
- **Files to MODIFY:**
  - *(Optional)* `C:/Users/dguyr/ROS/PPPPtherapy-/PPPPtherapy-/.github/workflows/arbor-ci.yml` — **SHARED (CI)**. Only if adding the paths-filtered reminder job; otherwise unchanged (existing lines 25-26 already provide the eval).
- **Interfaces/contracts:** `CODEOWNERS` path rules; GitHub branch-protection required-checks list (`app-quality-gates`). No app code, no env.
- **Test plan:** open a PR editing `app/src/framework.json` from a non-owner branch and confirm (a) review is required and (b) `eval:safety` + `check:framework` show as required checks. Confirm a trivially-bad edit (insert a forbidden phrase like "clinical counselor", matched by `safety-eval.mjs:20`) **fails CI**. No `tsc`/build impact.
- **NL note:** change-control over the developmental/safety framework is a DPIA + B2G expectation (demonstrable governance over the automated decision logic affecting children). No NL-specific file differs.
- **IL note:** the safety-eval and framework copy must stay aligned across EN/HE — when `framework.json` or safety copy changes, the Hebrew safety classifier/copy (owned by the AI specs) should be re-reviewed in the same PR; note this dependency in `CODEOWNERS` scope and `change-control.md`.
- **Effort:** S · **Severity:** Low · **Dependencies:** none · **Rollback:** delete `CODEOWNERS` + revert branch-protection toggles. · **Cost impact:** zero.

---

## Shared-file touch map (for the conflict-sequencer)

| File | Missions touching it | Sections / lines |
| :--- | :--- | :--- |
| `app/src/server/logger.ts` | OPS-1 | `requestObservability` (50-76) trace merge; `emit`/field allow-list (16-25, 59-69) |
| `app/src/server/createApp.ts` | OPS-2 | add `/healthz` + `/readyz` between helmet/cors (82-94) and billing/`/api` mounts (98+); OPS-5 *references* route-disable points (no edit) |
| `cloudbuild.prod.yaml` | OPS-2 | `gcloud run deploy` args (33-49) — add `--no-traffic`/`--tag` |
| `cloudbuild.yaml` → `cloudbuild.stage.yaml` | OPS-2 | promote orphaned stage config (whole file) |
| `.github/workflows/arbor-deploy.yml` | OPS-2, OPS-3 | OPS-2 restructures `jobs:` (41-113); OPS-3 adds `deploy.event` log-write in the promote job |
| `.github/workflows/arbor-ci.yml` | OPS-4, OPS-6(opt) | OPS-4: line 24 `npm test`→`test:coverage` + artifact; OPS-6: optional paths-filter reminder |
| `app/scripts/vitest.config.mjs` | OPS-4 | `include`/`exclude`/`thresholds` (7-26) |
| `app/package.json` | OPS-2 | add `smoke` script (after line 16) |
| `infra/rollback.sh` | OPS-2 (create), OPS-3 (emit `deploy.rollback`) | new file |
| `infra/monitoring/*` | OPS-1 (metrics/alerts), OPS-3 (dora dashboard) | new files, same dir |

**Recommended sequencing:** OPS-1 → OPS-2 (depends on OPS-1's observability + creates `infra/rollback.sh` and the smoke harness) → OPS-3 (depends on both) ; OPS-4, OPS-5, OPS-6 are largely independent and can run in parallel (OPS-5 finalizes after OPS-1/OPS-2 land so it can cite real levers). `aiQuota.ts`, `env.ts`, `modelRouter.ts`, `firestore.rules`, and `index.css` are **not** modified by any mission in this domain.
