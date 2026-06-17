# Spec E — Cost Optimization (WAF-Cost / FinOps)

**Domain owner:** Cost Optimization pillar (assessment score 2.5 — the lowest of the six).
**Date:** 2026-06-17
**Canonical code:** `app/src` (React19/Vite client + Express API on Cloud Run `europe-west4` + Firestore + Vertex AI).
**Source of findings:** `docs/architecture/well-architected-assessment-2026-06-04.md` §6 (COST-1..4).

## Ground-truth: what already exists (read before building)

A meaningful slice of this pillar is **already partly shipped** under the same mission IDs — these specs are mostly *completion + hardening*, not greenfield. Verified by reading the code:

| Capability | Status today | Evidence |
| :--- | :--- | :--- |
| Per-user hourly AI cap, shared store | **Built (count-based, fail-open)** | `app/src/server/aiQuota.ts` + `app/src/server/quotaStore.ts` (`FirestoreCounterStore`, collection `aiQuota`). |
| Per-call token telemetry | **Built (log lines)** | `app/src/ai/usage.ts` `recordUsage()` emits `ai.usage` Cloud Logging lines with `route/provider/model/promptTokens/outputTokens/userUid/requestId`. |
| Daily token rollup | **Built (global + byProvider)** | `app/src/server/usageRollup.ts` writes `usageRollup/{YYYY-MM-DD}`. |
| Founder cost read-side | **Built** | `app/src/server/adminMetrics.ts` `overview()` + `app/src/server/admin.ts` `estimateCostEur()` (rates per provider). Exposed at `GET /api/admin/overview` (`app/src/routes/api.ts:1469`). |
| Memory prompt windowing | **Built** | `app/src/memory/memoryService.ts` `getApprovedMemoryContext()` slices to `config.memoryPromptMaxFacts` (default 40). |
| Flash routing for low-stakes | **Built** | `app/src/ai/modelRouter.ts` routes `creative_low_risk` / `analysis_structured` / `handoff_structured` to Gemini Flash; only `coach_high_stakes` → Claude. **Prod cloudbuild currently overrides `VERTEX_MODEL_CHAT=gemini-2.5-flash`** (i.e. Claude is *off* in prod today — see `cloudbuild.prod.yaml`). |

**The real gaps** these specs close:
1. **COST-1:** no **global** ceiling, and no **token/cost**-based ceiling (only request-count per user); the cap **fails open** on Firestore error (cost risk under outage).
2. **COST-2:** rollup is global+byProvider only — no **per-route** and no **per-user/day** slicing in the app; cost dashboard is one aggregate number.
3. **COST-3:** zero billing-platform config — no GCP budget, no alerts, no BigQuery billing export. Pure managed-service/infra mission.
4. **COST-4:** knowledge-card context is not length-disciplined per call; Claude-vs-Flash routing decision for routine turns is undocumented/unmeasured.

**Cross-market note (applies to all four):** Cost telemetry and rollups aggregate **token counts**, never message content, so they carry no GDPR/AVG (NL) or Israeli PPL Amendment-13 (IL) personal-data weight by default — provided we keep `userUid` out of any export that leaves the EU project and provided the per-user cost slice (COST-2) is admin-gated. EU residency (`europe-west4`) already satisfies both NL data-residency and IL's EU-adequacy posture; **no cost mission moves data out of region** and none may introduce a non-EU billing sink. BigQuery billing export (COST-3) **must be created in an EU multi-region dataset.**

---

### COST-1 — Hard token/cost ceiling per user AND global, atomic, shared; clean 429 past cap

- **Objective / done-when:**
  - A request to any AI-generating route is **rejected with HTTP 429** and a clear message when **either** (a) the calling user's rolling token spend in the window exceeds `AI_USER_DAILY_TOKEN_CAP`, **or** (b) the **global** token spend for the day exceeds `AI_GLOBAL_DAILY_TOKEN_CAP`.
  - Enforcement is **atomic across Cloud Run instances** (Firestore transactional/`FieldValue.increment`, same store as today), not per-instance memory.
  - The existing **request-count** hourly cap (`AI_USER_HOURLY_LIMIT`) is retained as a cheap first gate; the token cap is the new spend gate layered on top.
  - On cap hit: 429 body `{ error, details }` naming the cap and reset time; `Retry-After` + `X-AI-Quota-*` headers set. Unit + integration tests prove cross-instance behaviour via the shared store.
  - **Decision: behaviour on Firestore error is configurable.** Default stays **fail-open** for the per-user gate (availability), but the **global** gate **fails-closed when `AI_GLOBAL_CAP_FAIL_CLOSED=true`** (protects against runaway spend during a Firestore incident). Documented in code.
- **Approach (grounded in real code):**
  - Today `createAiQuota` (`app/src/server/aiQuota.ts`) increments a **count** in `counters` (`UsageCounterStore`) keyed by uid/IP and 429s past `LIMIT=80/hr`. It does **not** know token cost (the model call happens *after* the middleware, in `app/src/routes/api.ts` handlers, and tokens land in `usageRollup` via `recordUsage`).
  - Add a **token-spend gate** that reads accumulated tokens *before* the model call and rejects if over cap. Two counters in the existing `UsageCounterStore`/Firestore `aiQuota` collection (no new infra):
    - per-user daily: `counters.peek("ai_tokens_user", uid, DAY_MS)`
    - global daily: `counters.peek("ai_tokens_global", "all", DAY_MS)`
  - Extend `UsageCounterStore` with an `addTokens(name, key, windowMs, tokens)` method (atomic `FieldValue.increment(tokens)`), and have **`recordUsage()`** (`app/src/ai/usage.ts`) — which already runs after every model call and already calls `recordUsageRollup` — *also* feed the same per-user + global token counters. This reuses the post-call hook that already exists, so we don't double-instrument.
  - The middleware checks `peek` of *yesterday-style* accumulated total at request entry (cheap single-doc read, same pattern as `createCoachMeter` in `entitlements.ts:227` which already does `counters.increment(COACH_METER, uid, DAY_MS)`). Because token cost is only known post-call, the gate is **trailing** (blocks the *next* request after the cap is crossed) — acceptable and standard for token budgets; documented as such.
  - New env in `env.ts`: `aiUserDailyTokenCap` (default e.g. 200_000), `aiGlobalDailyTokenCap` (default e.g. 5_000_000), `aiGlobalCapFailClosed` (default false). Wire the gate in `createApp.ts` **next to** the existing `createAiQuota(counters)` mount (same route list, line 116-119) — either as a second middleware or by folding into the same factory.
- **Files to CREATE:**
  - `app/src/server/aiTokenCap.ts` — the token-spend middleware (`createAiTokenCap(counters, config)`).
  - `app/src/server/aiTokenCap.test.ts` — unit tests (under cap passes; over per-user cap 429s; over global cap 429s; fail-open vs fail-closed).
- **Files to MODIFY:**
  - `app/src/server/quotaStore.ts` — **SHARED.** Add `addTokens()` to the `UsageCounterStore` interface (line ~15-20) and to **both** `MemoryCounterStore` (line ~24-47) and `FirestoreCounterStore` (line ~49-98). Reuse the existing `ref()` keying + `expireAt` TTL pattern (line 57-77) so token docs also auto-expire. *No new collection.*
  - `app/src/ai/usage.ts` — **SHARED (hot path, every model call).** In `recordUsage()` (line 43-66), after `recordUsageRollup(...)`, add two fire-and-forget `counters.addTokens(...)` calls (per-user via `ctx?.uid`, global via `"all"`). Requires passing/closing-over the `counters` store; inject it via a module-level `setUsageCounters(store)` initialised in `createApp.ts` to avoid threading it through every call site. **Keep inside the existing try/catch — telemetry must never throw.**
  - `app/src/config/env.ts` — **SHARED.** Add `aiUserDailyTokenCap`, `aiGlobalDailyTokenCap`, `aiGlobalCapFailClosed` to `ArborConfig` (after `maxOutputTokens`, line ~32) and to `loadConfig()` (after line 116). No new prod invariant required.
  - `app/src/server/createApp.ts` — **SHARED.** After line 119 (the `createAiQuota` mount), call `setUsageCounters(counters)` and mount `createAiTokenCap(counters, config)` on the same route array (lines 116-118). Sequence: must run **after** `bindUidToContext` (line 114) so `uid` is on context.
  - `cloudbuild.prod.yaml` — **SHARED (single env line).** Append `@AI_USER_DAILY_TOKEN_CAP=...@AI_GLOBAL_DAILY_TOKEN_CAP=...@AI_GLOBAL_CAP_FAIL_CLOSED=false` to the `^@^…` env string. Leave headroom above expected beta volume.
- **Interfaces/contracts:**
  - `interface UsageCounterStore { …; addTokens(name, key, windowMs, tokens): Promise<{ total: number }>; }`
  - Env: `AI_USER_DAILY_TOKEN_CAP`, `AI_GLOBAL_DAILY_TOKEN_CAP`, `AI_GLOBAL_CAP_FAIL_CLOSED`.
  - 429 body unchanged shape `{ error, details }`; headers `Retry-After`, `X-AI-Quota-*` (add `X-AI-Token-Cap`, `X-AI-Token-Used`).
  - Firestore collection `aiQuota` (existing) gains docs `ai_tokens_user_<uid>_<dayStart>` and `ai_tokens_global_all_<dayStart>`.
- **Test plan:**
  - Unit (`aiTokenCap.test.ts`): inject `MemoryCounterStore`, seed via `addTokens`, assert pass/429 for user-cap and global-cap, and fail-open vs fail-closed branches.
  - Unit (`quotaStore.test.ts`, existing): extend to cover `addTokens` atomicity (two interleaved increments sum).
  - Integration: spin the app with `MemoryCounterStore`, POST `/api/chat` past the seeded cap, assert 429 + headers.
  - Live verify: deploy to stage; drive N coach turns; confirm `aiQuota` token docs increment and a synthetic low cap returns 429 with the right message. `tsc && vitest run && vite build` green.
- **NL note:** B2G/municipality DPA buyers expect demonstrable cost-abuse controls; a hard global ceiling is part of "no runaway processing of children's data." No personal data added to counters (token ints + uid only).
- **IL note:** Israeli PPL Amendment-13 database-accountability expects bounded, auditable processing; the global fail-closed switch is the demonstrable control. Hebrew/RTL: the 429 `details` string must be localizable (key it for i18n, don't hardcode EN copy long-term).
- **Effort:** M · **Severity:** High · **Dependencies:** none (COST-2 telemetry already feeds it; can ship independently). · **Rollback:** unmount the two middleware lines in `createApp.ts` and remove the env vars — store changes are additive/backward-compatible. · **Cost impact:** **Net cost saver.** Adds ~1 extra Firestore read + 2 increments per AI request (negligible, sub-cent/day at beta scale); no min-instances, no Redis. Recurring-cost flag: **none** beyond marginal Firestore ops.

---

### COST-2 — Per-aiRun token + cost captured; cost dashboard by route / user / day

- **Objective / done-when:**
  - Every model call's `{route, provider, model, promptTokens, outputTokens, costEur}` is captured (✅ already in `ai.usage` log lines) **and** aggregated so the app can answer: *cost by route*, *cost by user*, *cost by day* — not just one global daily total.
  - `GET /api/admin/overview` (admin-gated) returns a **per-route breakdown** and a **top-N users by cost** slice for today, in addition to today's totals it already returns.
  - Costs are computed from `estimateCostEur` (existing, `admin.ts`) so the rate table stays single-source.
  - Tests prove the rollup records per-route and per-user buckets and that the overview surfaces them.
- **Approach (grounded in real code):**
  - `recordUsageRollup()` (`app/src/server/usageRollup.ts`) today increments `usageRollup/{date}` with `calls/promptTokens/outputTokens/totalTokens` and a `byProvider.{provider}` map. **Add two more maps** on the same doc, mirroring the `byProvider` pattern (line 47-53): `byRoute.{route}` and (bounded) `byUser.{uid}`. `recordUsage()` already has `meta.route` and `ctx.uid` in scope (`usage.ts` line 51-62) — pass them into `recordUsageRollup(provider, route, uid, usage)`.
  - **Cardinality guard for `byUser`:** a single Firestore doc can't hold unbounded users. Two cheap options — pick (a) for beta: (a) cap the in-doc `byUser` map and write overflow to a per-user daily doc `usageByUser/{uid}_{date}` (single-doc increments, TTL'd like `aiQuota`); (b) defer per-user entirely to the BigQuery export (COST-3) and only ship `byRoute` in-app now. **Recommend (a)** so the founder dashboard works without BigQuery, with `usageByUser` TTL-expiring.
  - `FirestoreAdminMetricsStore.overview()` (`adminMetrics.ts` line 73-104) already reads `usageRollup/{date}` and computes `approxCostEur` from `byProvider`. Extend the returned `usageToday` with `byRoute` (cost per route via `estimateCostEur`-style per-route mapping — note `estimateCostEur` keys on *provider*, so per-route cost needs route→provider resolution; reuse `routeDecisionFor` from `modelRouter.ts`) and `topUsers` (read top-N `usageByUser/{*}_{date}` or the in-doc map).
  - Client: the founder dashboard view that consumes `/api/admin/overview` (search `app/src` for the admin overview fetch) renders two small tables. **Use existing design tokens — do NOT add hardcoded hex; `index.css` is the 344-literal fragile file, keep new UI on CSS vars.**
- **Files to CREATE:**
  - `app/src/server/usageByUser.ts` *(only if option (a))* — tiny per-user daily increment writer + top-N reader (`usageByUser` collection, TTL `expireAt`).
  - `app/src/server/usageByUser.test.ts`.
- **Files to MODIFY:**
  - `app/src/ai/usage.ts` — **SHARED (hot path).** Change `recordUsageRollup(meta.provider, usage)` (line 62) → `recordUsageRollup(meta.provider, meta.route, ctx?.uid ?? null, usage)`. Still inside the try/catch.
  - `app/src/server/usageRollup.ts` — add `route` + `uid` params to `recordUsageRollup`; add `byRoute.{route}` map (and optional `byUser` map / `usageByUser` write). Keep fire-and-forget `.catch`.
  - `app/src/server/adminMetrics.ts` — extend `AdminOverview.usageToday` with `byRoute` and `topUsers`; compute per-route cost (resolve route→provider via `routeDecisionFor`/the rate table). Update `EMPTY_USAGE` and `NullAdminMetricsStore` to return empty `byRoute`/`topUsers` so local renders.
  - `app/src/server/admin.ts` — optionally add `estimateCostByRoute(byRoute, config)` helper next to `estimateCostEur` (line 31) so the rate logic stays in one file.
  - `app/src/routes/api.ts` — no contract change needed (the `/api/admin/overview` handler at line 1469 just returns `adminMetrics.overview()`); only types widen.
  - Founder dashboard client view (locate via grep for `admin/overview` consumer) — render the two new tables; **MODIFY only its own component, not `index.css`.**
  - `firestore.rules` — **SHARED.** `usageByUser`/`usageRollup` are server-only (Admin SDK). Add an explicit `match /usageByUser/{doc} { allow read, write: if false; }` (and confirm `usageRollup` is likewise denied to clients) — mirrors the existing `aiRuns`/`safetyReviews` deny pattern (rules line 47-59). Prevents a client ever reading another user's cost.
- **Interfaces/contracts:**
  - `recordUsageRollup(provider: string, route: ModelRoute, uid: string | null, usage: RollupUsage)`.
  - `AdminOverview.usageToday.byRoute: Record<ModelRoute, {calls,promptTokens,outputTokens,costEur}>`; `…topUsers: Array<{uid, totalTokens, costEur}>`.
  - Collections: `usageRollup/{date}` (extended), `usageByUser/{uid}_{date}` (new, TTL `expireAt`).
- **Test plan:**
  - Unit: `usageRollup` records `byRoute`/`byUser`; `adminMetrics.overview` returns per-route cost matching `estimateCostEur`; `NullAdminMetricsStore` returns empty maps.
  - Integration: drive mixed routes (chat→Claude/Flash, generate-story→Flash) and assert `byRoute` splits.
  - Live: `/api/admin/overview` as an admin uid shows per-route + top-users; non-admin still 403 (existing `isAdmin` gate).
  - `tsc && vitest run && vite build` green.
- **NL note:** Per-user cost is **personal-data-adjacent** (uid + behavioural intensity proxy). Keep `usageByUser` admin-only, EU-resident, TTL-short; document in the DPIA as an internal cost-control processing purpose, not profiling. Dutch AP would treat an exposed per-user cost endpoint as a confidentiality issue — hence the explicit `firestore.rules` deny.
- **IL note:** Same admin-gating under PPL Amendment-13; DPO-thresholds make the per-user store a registered processing purpose. Dashboard tables must render RTL when the admin UI is Hebrew.
- **Effort:** S · **Severity:** High · **Dependencies:** none (builds on shipped telemetry); **COST-1** consumes the same per-user token totals, so coordinate the `usage.ts` edit to avoid a clobber (see conflict note). · **Rollback:** revert the `recordUsageRollup` signature + overview fields; old docs ignore the extra maps. · **Cost impact:** **Saver / neutral.** Extra Firestore writes are increments on existing docs + at most one `usageByUser` doc per active user/day (sub-cent at beta). No recurring infra.

---

### COST-3 — GCP budget + alerts; BigQuery billing export

- **Objective / done-when:**
  - A **GCP Budget** exists on the prod billing account scoped to the Arbor project with threshold alerts (e.g. 50/80/100/120% of a monthly amount) routed to a Pub/Sub topic + email (founder).
  - **Cloud Billing → BigQuery export** is enabled into an **EU multi-region** dataset (standard usage cost export; detailed/price export optional), so spend is queryable and joinable to the app's token rollups.
  - Vertex AI + Cloud Run + Firestore line-items are visible in the export within ~24h; a sample query returns daily cost by service.
  - This is **infra/managed-service config — minimal or zero app code.** Deliver as committed IaC + a runbook so it's reproducible per environment.
- **Approach (grounded in real code/infra):**
  - There is **no** budget/export config in the repo today (no Terraform for billing; `cloudbuild.prod.yaml` only deploys Cloud Run). Add a small, reviewable IaC + documented gcloud path. Two delivery options — recommend committing **both** the gcloud commands (runbook) and a Terraform stub:
    - `gcloud billing budgets create --billing-account=<BA> --display-name="arbor-prod" --budget-amount=<EUR>EUR --threshold-rule=percent=0.5 …=0.8 …=1.0 …=1.2 --filter-projects=projects/<PROD_PROJECT>` + a Pub/Sub topic for programmatic alerts.
    - BigQuery export: enable in Cloud Console Billing → "Billing export" → BigQuery, **dataset location = EU**; or `bq mk --location=EU --dataset <proj>:billing_export`.
  - Optionally wire the budget Pub/Sub alert to the founder digest (the app already has `app/src/server/digest.ts`) **later** — out of scope for COST-3 baseline; note as a follow-up so a 120% breach can also trip the COST-1 global fail-closed cap automatically.
- **Files to CREATE:**
  - `infra/billing/README.md` — runbook: exact gcloud + bq commands, dataset-location=EU requirement, threshold rationale, who gets alerts.
  - `infra/billing/budget.tf` *(optional but recommended)* — `google_billing_budget` + `google_pubsub_topic` + `google_bigquery_dataset` (location `"EU"`). Variables for billing account, project, amount.
  - `docs/architecture/migration-2026-06-17/cost-runbook.md` — how to read the export; sample SQL (daily cost by service; Vertex spend vs token rollup reconciliation).
- **Files to MODIFY:**
  - `cloudbuild.prod.yaml` — **SHARED, but only a comment.** Add a note that budget+export are managed out-of-band (IaC), not by this deploy. No env change.
  - `docs/deployment-production.md` (if present) — cross-link the billing runbook.
- **Interfaces/contracts:**
  - GCP Budget on billing account, filtered to prod project; thresholds 50/80/100/120%.
  - Pub/Sub topic `arbor-budget-alerts` (or similar).
  - BigQuery dataset `billing_export` (location **EU**), standard usage cost export table.
  - No app env vars unless wiring the digest follow-up.
- **Test plan:**
  - Verify: after enabling, confirm budget shows in Console and a test threshold notification fires (lower a copy budget to a tiny amount in a sandbox project).
  - Verify export: query the table next day; assert Vertex AI + Cloud Run rows present.
  - No `tsc`/build impact (no app code) — CI stays green by construction; lint the `.tf`/markdown only.
- **NL note:** **Dataset location MUST be EU** to keep billing metadata in-region for AVG comfort (billing rows are not child PII but B2G procurement scrutinises every data sink). Budget gives the municipality DPA a "spend is monitored" control. B2G-readiness: **yes — soft gate** (procurement checklists ask for cost governance).
- **IL note:** EU dataset is fine under Israel's EU-adequacy; no IL-specific residency conflict. PPL: billing export contains no personal data, so no Amendment-13 registration burden.
- **Effort:** S · **Severity:** Med · **Dependencies:** none (pure infra). Synergy: feeds COST-1's optional auto-fail-closed-on-budget-breach follow-up. · **Rollback:** delete the budget + disable the export (no app impact). · **Cost impact:** **Saver.** Budgets/alerts are free; BigQuery billing export storage is a few cents/month at this scale. Recurring-cost flag: trivial BQ storage only — **no min-instances, no Redis.**

---

### COST-4 — Prompt-size discipline + revisit Claude-per-turn vs cheaper tier

- **Objective / done-when:**
  - The coach prompt's variable-length inputs are **bounded** so token cost is predictable: (a) approved-memory facts already capped at `memoryPromptMaxFacts` ✅; (b) **knowledge-card context is length-disciplined** (cap card count *and* per-card body length injected into the prompt); (c) child-profile serialization is trimmed to coach-relevant fields (today handlers serialize profile + memory + cards every call).
  - A measured, documented **routing decision** for routine coach turns: Claude `coach_high_stakes` vs Gemini Flash. Done-when: a short eval compares quality/safety on a routine-question set and the decision (keep Claude / route routine turns to Flash / tiered) is recorded with the token-cost delta from COST-2 telemetry.
  - No regression in coach quality eval; token-per-turn drops measurably on long-memory children.
- **Approach (grounded in real code):**
  - Card context: `app/src/routes/api.ts` builds `knowledgeCards = [...scholarCards, ...retrievedCards]` then injects `renderKnowledgeContext(knowledgeCards)` (lines 239-251, 384-396). `wiki.ts` already truncates card bodies to `…slice(0, 900)` (`knowledge/wiki.ts:163`) and retrieval caps to `limit` (line 140). **Add an explicit injected-card cap** (`config.knowledgePromptMaxCards`, default ~6) and confirm the 900-char body cap is applied to *every* injected card, not just retrieved ones. This mirrors the memory-windowing pattern already in `memoryService.ts:74`.
  - Profile trimming: where handlers serialize the child profile into the prompt (search for `JSON.stringify(childProfile)` — flagged in assessment SEC-3 as full-profile injection), introduce a `toCoachProfileContext(profile)` that emits only coach-relevant fields. This **also reduces tokens** and dovetails with the SEC-3 redaction work (`app/src/server/redaction.ts` already exists) — coordinate so we trim+redact in one place.
  - Routing eval: `modelRouter.ts` `routeDecisionFor` sends only `coach_high_stakes`→Claude. Prod cloudbuild **already overrides `VERTEX_MODEL_CHAT=gemini-2.5-flash`**, so Claude is effectively off in prod *today* — the eval should formalise whether to (i) keep Flash for chat (current de-facto, cheapest), (ii) restore Claude for high-stakes/safety-flagged turns only (tiered: Flash default, Claude on escalation signal from `app/src/safety/escalation.ts`), or (iii) Claude for all. Use the COST-2 per-route cost telemetry to quantify each. Recommend **tiered**: Flash by default, Claude only when the safety screen flags a turn — best cost/safety trade.
  - Add `MAX_OUTPUT_TOKENS` discipline note: already enforced via `config.maxOutputTokens` (8192) in every `modelRouter` call — keep; consider per-route lower caps (e.g. story vs chat) as a cheap follow-up.
- **Files to CREATE:**
  - `app/src/ai/promptBudget.ts` — `toCoachProfileContext(profile)` + `capInjectedCards(cards, max, bodyMax)` helpers, pure + unit-testable.
  - `app/src/ai/promptBudget.test.ts`.
  - `docs/architecture/migration-2026-06-17/coach-routing-eval.md` — the Claude-vs-Flash eval method + result + decision.
- **Files to MODIFY:**
  - `app/src/config/env.ts` — **SHARED.** Add `knowledgePromptMaxCards` (default 6) near `memoryPromptMaxFacts` (line 34/117).
  - `app/src/routes/api.ts` — apply `capInjectedCards(...)` before `renderKnowledgeContext` at the two coach build sites (lines ~239-251 and ~384-396); swap full-profile serialization for `toCoachProfileContext(...)`.
  - `app/src/knowledge/wiki.ts` — ensure `renderKnowledgeContext` honours the injected-card cap / body cap uniformly (line ~140-163).
  - `app/src/ai/modelRouter.ts` — **SHARED.** *Only if* the eval chooses tiered routing: add an optional `escalated` hint to route `coach_high_stakes`→Claude vs Flash. Touches `routeDecisionFor` (line 142-152). Otherwise **no code change** — routing already configurable via `VERTEX_MODEL_CHAT` env.
  - `cloudbuild.prod.yaml` — **SHARED (single env line).** Record the chosen `VERTEX_MODEL_CHAT` (keep `gemini-2.5-flash`, or set Claude for high-stakes) + add `@KNOWLEDGE_PROMPT_MAX_CARDS=6`.
- **Interfaces/contracts:**
  - `toCoachProfileContext(profile): string` (coach-relevant fields only).
  - `capInjectedCards(cards, maxCards, maxBodyChars): KnowledgeCard[]`.
  - Env: `KNOWLEDGE_PROMPT_MAX_CARDS`; existing `MEMORY_PROMPT_MAX_FACTS`, `MAX_OUTPUT_TOKENS`, `VERTEX_MODEL_CHAT`.
- **Test plan:**
  - Unit: `capInjectedCards` bounds count + body length; `toCoachProfileContext` drops non-coach fields and never includes raw PII beyond what redaction allows.
  - Eval: run the routine-question set through Flash vs Claude; record safety-screen pass rate + token cost from COST-2; assert no safety regression.
  - Snapshot prompt length before/after on a long-memory fixture child → assert token reduction.
  - `tsc && vitest run && vite build` green.
- **NL note:** Trimming profile fields injected into the LLM directly supports **AVG data-minimisation** (Art. 5(1)(c)) — fewer child attributes to Vertex = stronger DPIA posture. B2G-readiness: **soft gate** (minimisation is scrutinised).
- **IL note:** PPL minimisation principle parallels AVG. Critically: **if routing routine turns to Flash, the Hebrew/code-switching safety screen (`safety/escalation.ts`) must be validated on Flash output too**, since the tiered design escalates to Claude only on a Hebrew-capable flag. Test Hebrew + code-switching prompts in the eval.
- **Effort:** M · **Severity:** Med · **Dependencies:** **COST-2** (needs per-route token telemetry to quantify the routing decision); soft coupling to SEC-3 redaction (share the profile-trim site). · **Rollback:** raise the caps back / revert routing env; pure config + additive helpers. · **Cost impact:** **Saver.** Card/profile trimming cuts prompt tokens every coach turn; tiered Flash-default routing avoids Claude's ~40× output-rate (`admin.ts` rates: Claude €14 vs Flash €0.30 per 1M out). No recurring infra; **no new classifier calls** (reuses existing safety screen).

---

## Shared-file conflict map (for the sequencer)

| Shared file | COST-1 | COST-2 | COST-3 | COST-4 |
| :--- | :--- | :--- | :--- | :--- |
| `app/src/ai/usage.ts` (hot path) | add `addTokens` calls in `recordUsage` | change `recordUsageRollup(...)` signature in `recordUsage` | — | — |
| `app/src/server/usageRollup.ts` | — | extend writer (route/uid maps) | — | — |
| `app/src/server/quotaStore.ts` | add `addTokens` to iface + 2 impls | — | — | — |
| `app/src/server/adminMetrics.ts` | — | extend `overview()` | — | — |
| `app/src/server/admin.ts` | — | optional `estimateCostByRoute` | — | — |
| `app/src/config/env.ts` | +3 token-cap vars | — | — | +`knowledgePromptMaxCards` |
| `app/src/server/createApp.ts` | mount token-cap mw + `setUsageCounters` | — | — | — |
| `app/src/ai/modelRouter.ts` | — | (read `routeDecisionFor` only) | — | optional tiered-route hint |
| `app/src/routes/api.ts` | — | types widen only | — | apply card/profile caps |
| `firestore.rules` | (no change; `aiQuota` server-only) | add `usageByUser`/`usageRollup` deny | — | — |
| `cloudbuild.prod.yaml` (1 env line) | +3 token-cap vars | — | +comment | +`KNOWLEDGE_PROMPT_MAX_CARDS`, `VERTEX_MODEL_CHAT` |

**Critical sequencing:** **COST-1 and COST-2 both edit `app/src/ai/usage.ts` `recordUsage()` and `usageRollup.ts`.** Land **COST-2 first** (it changes the `recordUsageRollup` signature and route/uid plumbing), then COST-1 adds its `addTokens` calls on top — otherwise the two edits collide in the same 5-line block. `env.ts` and `cloudbuild.prod.yaml` are touched by COST-1 + COST-4 in **different, non-overlapping** sections (additive), safe to land in either order. COST-3 is fully isolated (infra-only) and can land any time.
