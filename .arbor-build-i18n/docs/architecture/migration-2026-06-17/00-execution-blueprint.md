# Arbor WAF Migration — Final Execution Blueprint (NL + IL Launch)

**Date:** 2026-06-17
**Author:** Lead Partner (synthesis of spec-A..G + shared-file conflict map + adversarial verdicts + NL/IL standards matrix)
**Goal:** Take Arbor from current Well-Architected maturity **2.8/5 → top-tier**, *gradually*, *cost-efficiently*, and *without clobbering shared files*, ready to sell into the **Netherlands** and **Israel** as first-class markets for a child-facing developmental AI product.

---

## 1. Exec summary

- **44 missions** across 7 domains (OPS·SEC·REL·PERF·COST·AI·CMP) are sequenced into **5 waves** (Wave 0 → Wave 4). The assessment's W1 See&Cap → W2 Harden → W3 Safe-AI → W4 Operate is sound; I add a **Wave 0 "paper & infra"** front-load (docs + IaC + indexes, zero app-code risk, can start day 1) and keep the original four as W1–W4.
- The whole migration is governed by **one hard physical constraint**: `app/src/routes/api.ts` (14 missions) and `createApp.ts` (12 missions) can only be edited by **one branch at a time**. This **"API spine" is the critical path** and dictates wall-clock. Everything else is parallelized around it in 4 disjoint-file tracks + 2 append-only "batch owner" merge roles.
- **Cost discipline is a first-class output.** Every recurring-cost lever is flagged with a lean default: **no Redis anywhere** (Firestore counters + in-process breaker), **no Sentry/PagerDuty** (GCP log-based metrics + email/Pub-Sub channels), **CMEK deferred** until a B2G contract pays for it, **min-instances=1** is the *only* deliberate recurring spend and it is gated to the B2G/clinical latency SLA.
- **NL/IL gating is encoded per wave.** The B2G-readiness gate stack (DPIA, consent ledger, DPA+EU region, App Check, immutable audit log, breach SLA encoding 72h/AP **and** PPA, self-serve rights, AI risk docs, JGZ/Tipat-Chalav clinical alignment, Hebrew/RTL + future Dutch UI) is distributed across the waves so that **the consumer launch ships at end of W2 and the B2G launch is unlocked at end of W4.**
- **Two specs are NOT build-ready as written** (OPS-2, OPS-3 per the adversarial verdicts). Their required fixes are folded in as **wave-entry preconditions** below — most critically: stage must set `GCP_PROJECT_ID`+`FIREBASE_PROJECT_ID` and use a **distinct `arbor-api-stage` service** (or it crash-loops / clobbers prod), and the smoke must use a real **custom-token→ID-token exchange**, hitting the **GET** `/score-utterance` not the cost-bearing POST.

### Maturity trajectory

| Pillar | Now | After W1 | After W2 | After W4 |
|---|---|---|---|---|
| Security | low | + caps/CSP/WIF/rules | + App Check/Zod/redaction | top-tier |
| Reliability | low | + breaker/health/PITR | + SLOs/probes | top-tier |
| Cost | 2.5 (lowest) | + hard ceilings/telemetry | + budget/prompt-diet | top-tier |
| Operational Excellence | mid | + obs/logging | + stage-gate/DORA/rollback | top-tier |
| Performance | mid | + warm/cache | + right-size/bundle gate | top-tier |
| Compliance (NL/IL) | low | + consent/audit foundations | + rights/retention | B2G-ready |

---

## 2. Wave table

| Wave | Theme | Missions | Market gate | Effort | Recurring cost added |
|---|---|---|---|---|---|
| **W0** | Paper & Infra (no app-code risk) | OPS-1·OPS-5, REL-1·REL-5·REL-6, SEC-4·SEC-8·SEC-9, COST-3, PERF-2, CMP-2·CMP-4·CMP-6, AI-7, OPS-6 | DPIA/RoPA/DPA + breach-runbook drafted (B2G paper bar) | M (broad, shallow) | ~€0 (PITR few €/mo; budget/export cents) |
| **W1** | See & Cap (quick wins + foundations) | SEC-1·SEC-2·SEC-5·SEC-6, COST-2→COST-1, REL-2·REL-4·REL-3, PERF-1·PERF-4, OPS-3*, + API-spine start: AI-3 → SEC-3+COST-4 → CMP-5 | App Check + audit-log foundation (B2G bars #4,#5); cost ceilings | M/L | min-instances=1 (only deliberate spend); reCAPTCHA free tier |
| **W2** | Harden (rights + safe-AI core) | API spine: CMP-1·CMP-3 → AI-1·AI-6·AI-8·AI-2 → SEC-7·PERF-4-cache → AI-4; + OPS-2 stage-gate, OPS-3 DORA, PERF-3, SEC-8 enforce | **Consumer launch gate (NL+IL):** consent ledger + rights + Hebrew/RTL classifier | L (critical path) | Flash classifier calls (flag-gated, sampleable) |
| **W3** | Operate & Comply (close the loop) | CMP-7 retention sweep, REL-3 verify, AI-5 eval gate, AI-7 ADR cadence, enforce-mode flips (CSP enforce, App Check enforce, coverage thresholds) | Retention TTL (B2G bar #8); AI eval gate | M | ~€0 |
| **W4** | B2G Unlock | DPIA sign-off (CMP-2 final), CMEK readiness (SEC-9 activation only if contract), Dutch UI localization pass, clinical per-market review (JGZ/Tipat-Chalav via AI-2/AI-5/OPS-6) | **B2G launch gate** (full stack green) | M (mostly decisions/legal) | CMEK only if triggered (KMS + availability dep) |

\* OPS-3 is precondition-blocked on OPS-2's structure; it is *scheduled* in W1 but **cannot land until OPS-2's promote job exists in W2** — see precondition note in §3.

---

## 3. Per-wave detail

### Wave 0 — Paper & Infra (start day 1, fully parallel, zero app-runtime-code risk)

**Theme:** Produce the B2G paper bar and the managed-service scaffolding that has no contention with app code. This front-loads the slowest-to-review artifacts (legal/DPIA) and de-risks W1.

**Missions:** OPS-1 (observability/logging + alert policies), OPS-5 (incident-response runbook w/ breach clock), OPS-6 (framework.json change gate / CODEOWNERS), REL-1 (RTO/RPO + Firestore PITR/backup), REL-5 (SLIs/SLOs + burn alerts), REL-6 (composite indexes + TTL), SEC-4 (WIF provisioning), SEC-8 (supply-chain scan CI job), SEC-9 (CMEK evaluation doc), COST-3 (GCP budget + BigQuery billing export), PERF-2 (load test + right-size doc), CMP-2 (DPIA), CMP-4 (RoPA Art.30 + DPAs + EU region), CMP-6 (breach→notification workflow), AI-7 (model-fitness ADR cadence).

**Rationale:** None of these edit `api.ts` or `createApp.ts` middleware. Per the conflict map, this is **Track 5** ("Infra-as-code + docs"), which is fully independent and can run to completion without waiting on any track. Getting the DPIA/RoPA/breach-runbook drafted now means legal review runs concurrently with engineering W1/W2.

**Parallel tracks:**
- **T5-docs:** CMP-2, CMP-4, CMP-6, OPS-5, REL-1, REL-5, SEC-9, AI-7, OPS-6 — pure markdown/ADR, infinitely parallel.
- **T5-infra:** OPS-1 (monitoring/apply.sh), COST-3 (budget+BQ), REL-6 (indexes.json + TTL), SEC-8 (CI security job), PERF-2 (load test).
- **T4-WIF:** SEC-4 — GCP-side pool/provider + repo vars; **no workflow code change** (already scaffolded at arbor-deploy.yml:64-80).

**Shared-file sequencing:**
- `firestore.indexes.json`: REL-6 appends composites — **never remove the `memoryEvents` COLLECTION_GROUP index (lines 3-11, the Gemini-outage fix).**
- `cloudbuild.prod.yaml` deploy-args: PERF-2 documents right-sizing but **does not apply flags until W1** (PERF-1→PERF-2 order). COST-3 is comment-only.
- `.github/workflows/arbor-ci.yml`: SEC-8 adds a **separate `security` job** (Trivy/SBOM/gitleaks/npm-audit) — never on the fast path.

**Effort:** M (broad but shallow; mostly docs + gcloud).

**NL/IL gate:** Produces DPIA (CMP-2, both AP/Art.35 + IL Amendment-13 accountability sections), RoPA + DPA (CMP-4), breach runbook encoding **both** 72h/AP **and** PPA serious-incident paths (OPS-5+CMP-6). These are the paper half of the B2G gate stack. **Hebrew variant of breach/comms templates required (IL).**

**Cost note:** ~€0. PITR + 7-day backups = low single-digit €/mo at beta scale (lean alt: keep PITR, drop scheduled backup, accept 7-day window). Budget/BQ export = cents/mo. CMEK is a **doc only** — no spend until triggered.

**Adversarial fixes folded in:**
- OPS-1: trace id must propagate to the `ai.usage` line and `logger.error` lines via **requestContext**, not only the request-completion line — otherwise single-trace correlation is not actually met. **Add as done-when.**
- OPS-1: `trace.ts` must **no-op gracefully when `GCP_PROJECT_ID` is unset** (local/test) — add to test plan.
- OPS-1: the PII allow-list serializer wraps **only the request line**, NOT the generic `emit()` used by `usage.ts`/`logger.error` — confirm it does not strip `errorMessage`/`totalTokens` telemetry.
- OPS-1: stop citing "the DPIA" as the evidence home until CMP-2 exists; reference the actual DPA-outline/privacy-notes. (CMP-2 *is* in this wave, so the dependency resolves within W0.)
- SEC-4: keep the `GCP_SA_KEY` fallback until WIF is **proven green** on a `workflow_dispatch`, then delete the key + IAM JSON.

---

### Wave 1 — See & Cap (quick wins land first + API-spine begins)

**Theme:** Get visibility and hard ceilings in place (you cannot harden what you cannot see or cap), land all the S-effort high-value quick wins in parallel, and **start the serial API spine** with its first three missions.

**Missions:**
- **Quick-win lane (parallel, S-effort):** SEC-1 (CSP report-only), SEC-5 (Firestore create-ownership rules + emulator tests), SEC-6 (App Check metrics-mode), REL-4 (health.ts + `/healthz`+`/api/readyz`), OPS-3 (DORA dashboard — *precondition-blocked, see below*).
- **Track 4 (security edge):** SEC-1, SEC-2 (shared atomic rate-limit + per-user **and** global AI ceilings), SEC-5, SEC-6.
- **Track 3 (cost telemetry):** **COST-2 → COST-1** (per-aiRun token/cost capture, then hard token/cost ceiling per user **and** global, atomic, clean 429).
- **Track 2 (reliability internals):** REL-2 (timeout + bounded retry + in-process circuit-breaker + degradation metric), REL-4 (health router), PERF-1 (warm instance + Vertex pre-init), REL-3 (quota-persistence verify — rides SEC-2).
- **Track 1 (API spine START, serial):** **AI-3** (prompt delimiters `<arbor:memory|source|parent_message>` + strip control phrases) → **SEC-3 + COST-4** (profile minimizer + card/profile caps — **ONE merged helper**) → **CMP-5** (immutable audit store + DI pattern).
- **PERF-4** construction (analysisCache store) lands in createApp here; the cache *wrap* on routes is W2.

**Rationale:** Telemetry (COST-2) and ceilings (COST-1, SEC-2) must precede safe-AI work so the extra Flash classifier calls in W2 are already inside a cost ceiling. Quick wins (SEC-1/5/6, REL-4) are S-effort, high-value, low-blast-radius, and disjoint-file — they prove the parallel-track machinery early. The API spine starts with **AI-3 first** (per conflict map §A) so SEC-3/COST-4 transform *inside* the delimiters, and **CMP-5 owns the `ApiDeps` DI pattern** that CMP-1/CMP-3/AI-6 copy in W2.

**Parallel tracks (4 concurrent worktrees + 2 batch owners):**
- T1 (API spine) — serial, single owner, gates wall-clock.
- T2 (model internals) — `modelRetry.ts`, `circuitBreaker.ts`, `degraded.ts`, `modelRouter.ts`, `claudeVertexProvider.ts`, `health.ts`. **Sequence PERF-1 warmup() → REL-2 wrap** (different method bodies, same files).
- T3 (cost telemetry) — `usage.ts`, `usageRollup.ts`, `usageByUser.ts`, `adminMetrics.ts`, `aiQuota.ts`, `quotaStore.ts` (interface), `aiTokenCap.ts`.
- T4 (security edge) — `cspReport.ts`, `rateLimitStore.ts`, `appCheckMiddleware.ts`, `firebase.ts`, `firestore.rules` (SEC-5 owns lines 29-45 exclusively), `MarkdownBlock.tsx`.

**Shared-file sequencing (the hard part of W1):**
- **`createApp.ts` health route — ONE implementation.** OPS-2/REL-4/PERF-1 each "add `/healthz`". Resolution: **REL-4 owns `createHealthRouter`**; mount a **bare public `GET /healthz`** (liveness, for PERF-1 warmup + OPS-2 smoke) **AND `/api/readyz`** (REL-4 deep Firestore + breaker probe). One PR, one owner. Track-1's owner accepts the mount line.
- **`createApp.ts` DI/middleware:** Track-1 owner is the **single owner of createApp.ts**. Tracks 2/3/4 submit discrete mount-line PRs at distinct anchors: REL-4 health → SEC-1 csp-report (before auth) → SEC-2 rate-limit `store:` (line 99) → SEC-6 appCheck (near 112) → COST-1 token-cap (after 119) → store-construction batch (CMP-5 → PERF-4). Append-only DI deps object, alphabetized.
- **`api.ts` (Track 1, serial):** AI-3 → SEC-3+COST-4 → CMP-5, per conflict map §A order 1-3. **SEC-3 ∩ COST-4 = ONE merged minimizer** (`toCoachProfileContext`/`minimizeProfileForPrompt`) — do not write two.
- **`usage.ts`:** **COST-2 FIRST** (signature change), then COST-1 `addTokens` calls — same 5-line block.
- **`quotaStore.ts`:** COST-1 owns the interface extension; SEC-2 builds a separate adapter file (`rateLimitStore.ts`) that *consumes* without modifying. Land COST-1 interface first.
- **`aiQuota.ts`:** SEC-2 is the sole editor (COST-1 adds sibling `aiTokenCap.ts`).
- **`firestore.rules`:** SEC-5 owns the existing-rule rewrite (lines 29-45) **exclusively, no concurrent rules edit.** CMP-5 appends `auditEvents` match block.
- **Config/cloudbuild batch owners:** Wave-1 config batch = SEC/REL/COST flags into `env.ts` + `^@^` env string in one commit. Deploy-args owner applies **PERF-1 `--min-instances=1`** to cloudbuild (first flag in the ordered chain).

**Effort:** M/L (4 parallel tracks + serial spine start).

**NL/IL gate:** App Check (SEC-6, B2G bar #4) + audit-log foundation (CMP-5, bar #5) + structured logging (OPS-1 from W0) start the technical B2G stack. SEC-5 rules + global AI ceiling protect children's-data endpoints from scraping/abuse (AADC/AP scrutiny). **No consumer-launch claim yet** — that's end of W2.

**Cost note:** **`--min-instances=1` is the one deliberate recurring spend** — justified by the B2G/clinical latency SLA (municipalities/JGZ/insurers expect predictable latency). Lean alt documented: Cloud Scheduler → `/healthz` (best-effort warm, near-zero) for pre-revenue beta. Everything else is a **net cost saver** (ceilings cap spend, fail-fast breaker avoids 3× backoff, cache avoids Vertex calls). reCAPTCHA Enterprise free tier covers App Check. **No Redis** (Firestore counters + in-process breaker).

**Adversarial fixes folded in:**
- SEC-2: stays on **Firestore counters, no Redis** until measured contention (>1 write/sec on a single window doc).
- REL-4: `/readyz` must **not** call a model (would bill tokens) — Firestore metadata ping + in-process breaker state only.
- OPS-3 **precondition:** cannot land in W1 — its modify points (arbor-deploy.yml promote job, `infra/rollback.sh`) are *created by OPS-2 in W2*. Schedule the dashboard/metric scaffolding in W1 (Track 5) but **gate the deploy-event log-write behind OPS-2 merge.** Also fold: define lead-time as **merge-commit timestamp** (not spoofable author time); define change-failure correlation join key (**revision tag/sha**) + observation window; grant deploy SA **`roles/logging.logWriter`** (hard IAM prereq, not "maybe").

---

### Wave 2 — Harden (rights + safe-AI core; the critical-path wave)

**Theme:** Drive the API spine through consent/rights and the full safe-AI stack, and stand up the staging-gated deploy pipeline. **This is the wave that unlocks the consumer launch.**

**Missions:**
- **Track 1 (API spine, serial — the critical path):** CMP-1 (parental consent capture + age-gate, durable record) → CMP-3 (self-serve export + erasure + tombstone) → AI-1 (semantic Hebrew-first safety classifier, regex stays fast-path) → AI-6 (HITL SLA + safetyReview record) → AI-8 (false-neg/false-pos drift tracking, extends AI-6) → AI-2 (output groundedness check) → SEC-7 (Zod parity on plan/story/hero/analyze/handoff) → **PERF-4 cache wrap** (outside SEC-7's validate) → **AI-4 LAST** (per-route input Zod on every handler).
- **Track 5 (pipeline):** **OPS-2** (staging-first deploy + smoke-gated prod promotion + one-command rollback + `infra/rollback.sh`) → **OPS-3** (DORA deploy-event log-write inside OPS-2's promote job), PERF-3 (client perf budget + bundle gate, separate job), SEC-8 (promote scans to enforcing).

**Rationale:** CMP-1/CMP-3 give parents the consent + rights mechanics that are the **consumer-launch legal floor in both markets** (NL Art.8 age-16 gate; IL guardian consent; Hebrew/RTL rights UX). AI-1/2/3/6/8 give the AI risk controls + human-oversight evidence. SEC-7+AI-4 close the input/output validation gap. OPS-2 makes every subsequent deploy safe (stage → smoke → no-traffic prod → promote → rollback), which is the precondition for OPS-3's DORA metrics.

**Parallel tracks:**
- T1 is the **sole critical path** and internally serial (each mission commits sequentially on one branch in conflict-map §A order 4-9).
- T5 (OPS-2/3, PERF-3, SEC-8 enforce) runs in parallel — **infra/CI only, zero api.ts conflict.**

**Shared-file sequencing:**
- **`api.ts` seams (single owner per seam):** DI/routes (CMP-1/CMP-3 copy CMP-5's pattern) → safety call-sites (AI-1 swaps 14 `screenForImmediateEscalation` → `runInputSafety`; AI-6/AI-8 record; AI-2 adds output context) → structured-output (**SEC-7 validates INSIDE, then PERF-4 caches OUTSIDE** the validated result; REL-2's catch-block is orthogonal error path) → **AI-4 lands LAST** (touches every handler's body destructure).
- **`safetyReviewStore.ts`:** AI-6 creates → AI-8 adds `outcome` field. Strict order.
- **`escalation.ts`:** AI-1 exports verdict type → AI-8 ensures `source` on verdict.
- **`outputScreen.ts`:** AI-2 owns `grounded`/`ungroundedClaims` extension; AI-5 (W3) reads it.
- **`firestore.rules`:** CMP-1 appends `consents` block; AI-6 extends existing `safetyReviews` block (nobody else touches it).
- **`arbor-deploy.yml`:** **OPS-2 OWNS the restructure** (gate → deploy-stage → smoke-stage → deploy-prod `--no-traffic --tag` → promote-prod). **Lands FIRST.** Then OPS-3 inserts deploy-event step *inside* the new promote job (hard dependency); SEC-4 comment-cleanup + SEC-6 build-env line rebase onto it. **Do not parallelize deploy.yml edits.**
- **`cloudbuild.prod.yaml` deploy-args:** OPS-2 appends `--no-traffic --tag candidate` after PERF-1/PERF-2/REL-4 (fixed order). COST-4's `VERTEX_MODEL_CHAT` is the **only non-append env edit** (changes existing `gemini-2.5-flash`) — coordinate so it doesn't collide with an append.
- **Config batch (Wave-2 owner):** CMP-1/CMP-5/AI flags + consent policy version into env.ts + env string, one commit.

**Effort:** L (this is the critical-path wave; T1 is serial and long).

**NL/IL gate — CONSUMER LAUNCH GATE:** CMP-1 consent ledger + age-gate (NL Art.8/16, IL guardian) + CMP-3 rights (access/export/erasure, **Dutch-language + Hebrew/RTL flows**) + AI-1 **Hebrew + code-switching** safety classifier + AI-6 HITL SLA (RTL queue, IL DPO/notification path reference). **Consumer launch in NL + IL is greenlit when this wave is green and verified in both languages.** B2G still needs W4.

**Cost note:** AI-1 adds **one extra Flash call only on inputs that pass the regex screen AND only when the flag is on** — sampleable (classify 1-in-N or only when length > threshold, env-var rate). AI-2 groundedness **folded into the same classifier schema = zero extra calls.** PERF-4 cache is **cost-down** (every hit avoids a Vertex `analysis_structured` call). Stage Cloud Run is **scale-to-zero** (no min-instances on stage). One smoke AI call per deploy = negligible.

**Adversarial fixes folded in (OPS-2 was NOT build-ready — these are hard preconditions):**
- **Stage boot blocker:** `cloudbuild.stage.yaml` MUST set `GCP_PROJECT_ID` + `FIREBASE_PROJECT_ID` (+ stage `CORS_ORIGINS`/`APP_URL`) or env.ts:152-158 throws and the service crash-loops. Decide stage-project vs same-project.
- **Service-name collision:** rename stage service to **`arbor-api-stage`** (hard requirement, not an option) — reusing `arbor-api` would deploy stage on top of prod traffic.
- **Smoke auth:** specify the exact **custom-token → ID-token exchange** via Identity Toolkit (`securetoken`/`signInWithCustomToken`) using the web API key (a custom token is NOT an ID token; `/api` auth verifies ID tokens). Smoke hits **GET `/score-utterance` (api.ts:698, no-AI)** or `/healthz` + one capped `/api/chat` — **never the POST ASR route (api.ts:702)**.
- **Stage data separation (NL):** `/readyz` Firestore `count()` must hit a **separate stage dataset**, never real Dutch child data (B2G data-separation requirement).
- **`/healthz` placement:** mount so Cloud Run's probe reaches it; probes send no Origin so the cors allow-list passes — state this. Do not perturb the `/api` middleware order (rate-limit/auth/quota chain at 99-125).
- **OPS-3:** define lead-time = merge-commit timestamp; correlation join key = revision tag; deploy SA needs `roles/logging.logWriter`.

---

### Wave 3 — Operate & Comply (close the loop, flip to enforce)

**Theme:** Turn on the things that were shipped in report/metrics mode, enforce retention, and gate releases on AI eval.

**Missions:** CMP-7 (retention TTL + lazy/in-process sweep — `expireStaleMemory` on the existing `initUsageRollup` interval, flag-gated, **no new Cloud Scheduler/min-instance**), REL-3 (verify quota persists across revisions, live check), AI-5 (regression + groundedness + age-fit eval suite, gate on score delta, per-release model card), AI-7 (quarterly model-fitness ADR cadence kickoff), **OPS-4** (coverage thresholds enforce on safety/contracts/routes/memory), and the **enforce-mode flips**: CSP report-only → enforce (SEC-1), App Check metrics → enforce (SEC-6), supply-chain scans → blocking (SEC-8).

**Rationale:** Enforce flips are deliberately **last** so they ride on a known-good baseline — each is a one-flag/one-toggle change with instant rollback (`CSP_REPORT_ONLY=true`, `REQUIRE_APP_CHECK=false`). AI-5 closes the loop by gating future model swaps on eval-score delta + a model card. CMP-7 enforces storage limitation (GDPR Art.5(1)(e) / IL purpose-limitation).

**Parallel tracks:** CMP-7 (Track 1 small: `memoryService.ts` sweep fn + `expiresAt`, disjoint from AI-3's context-render edit) ‖ AI-5 (Track 5 eval scripts) ‖ enforce flips (config batch, trivial).

**Shared-file sequencing:** CMP-7 `memoryService.ts` is disjoint from AI-3 (different functions) — order-independent. `firestore.indexes.json`: CMP-7 appends `memoryEvents.expiresAt` index. Enforce flips are env-string toggles via the config batch owner.

**Effort:** M.

**NL/IL gate:** Retention TTL (B2G bar #8 — institutional contracts specify deletion schedules); AI eval gate + model card (AI risk documentation, **emerging hard gate especially NL/EU AI Act**). One retention schedule documented covering both markets.

**Cost note:** ~€0. CMP-7 uses **Firestore native TTL (free server-side deletion) + in-process sweep on the existing interval** — explicitly no new scheduler, no min-instances, no Redis. AI-5 eval is **zero in CI** (stubbed provider); only the optional nightly live job spends tokens.

---

### Wave 4 — B2G Unlock (decisions, legal, localization)

**Theme:** Everything that converts a green technical stack into a *sellable B2G posture*. Mostly Guy-blocked (legal sign-off, contract triggers, vendor/region attestations) + the per-market localization that "one global build" cannot deliver.

**Missions / activities:** CMP-2 DPIA **final sign-off** (residual-risk acceptance — needs DPO/legal), SEC-9 CMEK **activation** (only if a B2G contract clause requires customer-managed keys — otherwise stays a doc), **Dutch UI localization pass** (NL B2G future requirement), **per-market clinical content review** (JGZ/consultatiebureau for NL, Tipat-Chalav/MoH for IL — via AI-2 groundedness to localized source cards, AI-5 age-fit eval, OPS-6 framework.json change gate).

**Rationale:** The standards matrix flags clinical content (Area 10) as **genuinely divergent per market** — needs per-market review, not one global library. Dutch UI is a near-term B2G need. CMEK is a B2G upsell gated on a contract (Firestore CMEK must be chosen at **database creation** — plan a new CMEK-enabled DB + migration when triggered).

**Effort:** M (mostly decisions + localization, low code).

**NL/IL gate — B2G LAUNCH GATE:** The full B2G-readiness stack green together: DPIA + consent + DPA/EU-region (+CMEK if demanded) + App Check + audit log + breach SLA (72h/AP **and** PPA) + self-serve rights + AI risk docs + clinical alignment (JGZ / Tipat-Chalav) + localization (Dutch UI + Hebrew/RTL throughout).

**Cost note:** CMEK is the only potential new recurring cost — **KMS key ops are low monthly, but it introduces an availability dependency (a KMS outage/destroyed key makes data unreadable) and migration effort.** Defer until a contract pays for it. Key destruction is irreversible — call out in the runbook.

---

## 4. Shared-file ownership & sequencing table

| File | Owner (lands first) | Append-only extenders (safe order) | Anti-clobber rule |
|---|---|---|---|
| `app/src/routes/api.ts` | **Track 1 owner (sole)** | AI-3 → SEC-3+COST-4 (merged) → CMP-5 → CMP-1 → CMP-3 → AI-1 → AI-6 → AI-8 → AI-2 → SEC-7 → PERF-4 → **AI-4 last** | THE serialization point. One mission per seam at a time; never two branches. 4 seams (prompt-build, safety-calls, structured-output, DI/routes). |
| `app/src/server/createApp.ts` | **Track 1 owner (sole)** | REL-4 (health) → SEC-1 → SEC-2 → SEC-6 → COST-1 → CMP-5 → PERF-4 → CMP-7 → REL-3 | ONE health route (REL-4 canonical: bare `/healthz` + `/api/readyz`). Append-only alphabetized DI deps. Discrete mount-line PRs from T2/3/4 at distinct anchors. Don't perturb 99-125 order. |
| `app/src/config/env.ts` | **Config batch owner (per wave)** | Each mission = 1 type field + 1 parse line; W1(SEC/REL/COST) → W2(CMP/AI) → W3(CMP-7) | Append-only registry; never touch prod-invariant block 137-150 (CMP-7 only *reads* arborEnv). One commit per wave. |
| `cloudbuild.prod.yaml` | **2 owners:** env-string owner + deploy-args owner | env string: append `@KEY=VALUE` (COST-4 `VERTEX_MODEL_CHAT` = only value-change). deploy-args: **PERF-1 → PERF-2 → REL-4 → OPS-2** | Two regions, two owners. Env-string append-only; deploy-args ordered+shared. Keep separate so an append never collides with a flag insert. |
| `firestore.rules` | **SEC-5 (lines 29-45 exclusive)** | append after 56: CMP-5 auditEvents → CMP-1 consents → COST-2 deny → PERF-4 deny; AI-6 extends safetyReviews | SEC-5 is the ONLY existing-rule rewrite — no concurrent rules edit. Everything else append-only match blocks. |
| `firestore.indexes.json` | REL-6 | CMP-5 (auditEvents) → CMP-7 (memoryEvents.expiresAt) | Append-only `indexes[]`. **Never remove `memoryEvents` composite (lines 3-11).** |
| `.github/workflows/arbor-ci.yml` | **OPS-4 (line 24)** | SEC-5/SEC-8/PERF-3/AI-3/AI-5/CMP-5 add **distinct new jobs** | Only OPS-4 edits an existing line; heavy scans/evals each in their OWN job off the fast path. |
| `.github/workflows/arbor-deploy.yml` | **OPS-2 (restructure)** | OPS-3 (step in promote job) → OPS-4 → SEC-4 → SEC-6 | OPS-2 lands FIRST; all others rebase. **Do not parallelize.** OPS-3 hard-depends on OPS-2's promote job. |
| `app/package.json` | **Config batch owner** | append-only scripts + devDeps (OPS-2 smoke, SEC-5 test:rules, PERF-3 check:bundle+@lhci/cli, AI-1/3/5 evals) | Concatenation merge; order-independent. |
| `app/src/ai/usage.ts` | **COST-2 (signature first)** | COST-1 (addTokens calls) | Same 5-line block; COST-2 then COST-1, one commit-pair. |
| `app/src/server/quotaStore.ts` | **COST-1 (interface)** | SEC-2 consumes via separate `rateLimitStore.ts` adapter; REL-3 test-only | COST-1 owns interface; SEC-2 never modifies it. |
| `app/src/ai/modelRouter.ts` / `claudeVertexProvider.ts` | **PERF-1 (warmup())** | REL-2 (wrap call bodies) | Different method bodies; PERF-1 → REL-2 within Track 2. |
| `app/src/server/safetyReviewStore.ts` | **AI-6 (create)** | AI-8 (`outcome` field) | Strict order, AI-8 extends. |
| `app/src/server/adminMetrics.ts` | any (disjoint fields) | COST-2 (byRoute/topUsers) + AI-6 (safetyQueue) + AI-8 (fpRate/fnCount) | Disjoint fields; concatenation merge. |

**Cross-track merge roles (not tracks):**
- **Config batch owner** — merges all `env.ts`/`loadConfig` additions + `^@^` env-string additions + `package.json` scripts into ONE commit per wave.
- **Cloudbuild deploy-args owner** — serializes `gcloud run deploy` flag additions in fixed order PERF-1 → PERF-2 → REL-4 → OPS-2.

---

## 5. Quick-win lane (land in W0/W1, parallel, S-effort, high-value)

| Mission | Why a quick win | Track | Wave |
|---|---|---|---|
| **SEC-4** (WIF) | S-effort, **already scaffolded** — only GCP provisioning + repo vars + key delete; removes standing credential-theft liability | T4/infra | W0 |
| **SEC-8** (supply-chain scan) | S, free stack (Dependabot/npm-audit/Trivy/Syft/gitleaks), own CI job, non-blocking until promoted | T5 | W0 |
| **SEC-1** (CSP report-only) | S, additive routes, instant revert (`CSP_REPORT_ONLY=true`) | T4 | W1 |
| **SEC-7 / AI-4** (Zod parity) | S, per-route, independently revertible; closes structured-output validation gap | T1 (seam) | W2* |
| **COST-2** (cost telemetry) | S, builds on shipped usage path; unlocks the cost dashboard | T3 | W1 |
| **REL-4** (`/healthz`+`/readyz`) | S, canonical health route that OPS-2 smoke + PERF-1 warmup both consume | T2 | W1 |
| **OPS-3** (DORA dashboard) | S, free log-based metrics — *but precondition-blocked on OPS-2; scaffold W1, wire W2* | T5 | W1→W2 |
| **SEC-6** (App Check) | S, metrics-mode first (instant revert), B2G bar #4 | T4 | W1 |
| **REL-6** (indexes+TTL) | S, append-only, prevents runtime query failures + auto-purges stale quota docs | T5 | W0 |

\* SEC-7/AI-4 are S-effort but live on the serialized `api.ts` spine, so they land in W2 even though individually trivial.

---

## 6. Blocked on Guy (decisions / spend / vendor / legal)

| # | Item | Type | Needed by | Lean default if Guy is silent |
|---|---|---|---|---|
| 1 | **WIF setup** — create GCP Workload Identity Pool/Provider, set repo vars `GCP_WIF_PROVIDER`+`GCP_DEPLOY_SA`, delete `GCP_SA_KEY` | GCP access / one-time | W0 (SEC-4) | Keep key fallback until WIF proven, then delete |
| 2 | **Stage project decision** — separate stage GCP project vs same-project; **mandates `arbor-api-stage` service + stage `GCP_PROJECT_ID`/`FIREBASE_PROJECT_ID`** | Infra/spend | W2 (OPS-2 precondition) | Same project, separate stage Firestore dataset, `arbor-api-stage` service |
| 3 | **min-instances=1 recurring spend** — approve always-on instance for B2G latency SLA | Spend (~one warm instance 24/7) | W1 (PERF-1) | Cloud Scheduler warmup (near-zero, weaker SLA) for pre-revenue beta |
| 4 | **Redis vs Firestore store** — confirm staying on Firestore counters | Decision (no spend) | W1 (SEC-2/COST-1) | **Stay Firestore** until >1 write/sec contention (no Redis) |
| 5 | **Safety classifier vendor/cost** — approve Flash classifier calls + sampling rate | Spend (flag-gated) | W2 (AI-1) | Sample 1-in-N or length-gated; flag default-off until approved |
| 6 | **CMEK** — only if a B2G contract clause requires customer-managed keys | Legal/contract trigger + spend | W4 (SEC-9) | **Do not adopt** — doc + runbook only; Google-managed keys are compliant |
| 7 | **DPO appointment** — does IL processing scale cross the Amendment-13 DPO threshold? + DPIA residual-risk sign-off | Legal | W0 draft / W4 sign-off | Draft DPIA flags the question; legal answers before B2G |
| 8 | **Domain / reCAPTCHA Enterprise site key** — for App Check enforce | Vendor config | W1 (SEC-6) | Free assessment tier; metrics-mode until key provisioned |
| 9 | **Dutch UI + per-market clinical review** — JGZ/consultatiebureau (NL) + Tipat-Chalav/MoH (IL) localization | Content/legal/vendor | W4 | Hebrew/RTL ships in W2; Dutch UI + clinical review gated to B2G |
| 10 | **Notification channel** — create the Cloud Monitoring channel id (one-time gcloud) before alert-policies apply | GCP access | W0 (OPS-1) | Email/Pub-Sub channel (free) — not paid paging |
| 11 | **deploy SA `roles/logging.logWriter`** IAM grant | GCP access | W1/W2 (OPS-3) | Hard prereq — OPS-3's deploy-event write fails without it |

---

## 7. Critical path

**API spine (Track 1), serial, one branch:**
`AI-3 → SEC-3+COST-4 (merged) → CMP-5 → CMP-1 → CMP-3 → AI-1 → AI-6 → AI-8 → AI-2 → SEC-7 → PERF-4 → AI-4`
(+ REL-2's `api.ts` catch-block commit deferred into this branch).

This is the **wall-clock determinant.** It spans W1 (first 3 missions) into W2 (the rest). Tracks 2/3/4/5 run fully parallel and *finish around it*; they each contribute ~1-3 discrete mount-line PRs into `createApp.ts` that the Track-1 owner serializes. **OPS-2 → OPS-3** is a secondary serial chain on the deploy pipeline that must complete inside W2.

---

## 8. How to build each task safely (one-line protocol)

**One worktree per parallel track (T1–T5); within a shared file the designated OWNER edits first and creates the seam, every later mission appends at a distinct documented anchor in the conflict-map order, and the two batch owners (config, deploy-args) merge all append-only registry additions into a single per-wave commit — never two branches editing `api.ts`, `createApp.ts`, `arbor-deploy.yml`, or `firestore.rules` lines 29-45 concurrently.**

```
git worktree add ../arbor-T1-api-spine   -b mig/w1-api-spine     # serial, critical path
git worktree add ../arbor-T2-rel          -b mig/w1-rel-internals
git worktree add ../arbor-T3-cost         -b mig/w1-cost
git worktree add ../arbor-T4-sec          -b mig/w1-sec-edge
git worktree add ../arbor-T5-infra        -b mig/w0-infra-docs    # start day 1
```
Each mission commit runs `tsc` + tests + build green before merge; enforce-mode flips (CSP, App Check, coverage) are the LAST commits and each reverts via a single env flag.
