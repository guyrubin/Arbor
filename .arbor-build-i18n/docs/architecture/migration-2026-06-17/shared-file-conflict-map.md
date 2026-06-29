# Shared-File → Missions Conflict Map (Integration Architecture)

**Date:** 2026-06-17
**Author:** Integration Architect
**Scope:** Consolidates the per-domain shared-file maps from spec-A..G + standards-two-market-NL-IL into one cross-domain matrix, grounded against the REAL files on disk. It answers three questions per shared file: **who edits it, in what safe order, and how to avoid clobbering.** Then it proposes **parallel tracks** of missions that touch disjoint files and can be built in separate worktrees simultaneously.

Mission domains: **OPS** (1-6, spec-A) · **SEC** (1-9, spec-B) · **REL** (1-6, spec-C) · **PERF** (1-4, spec-D) · **COST** (1-4, spec-E) · **AI** (1-8, spec-F) · **CMP** (1-7, spec-G).

> Ground-truth note: I read each real shared file. Several spec line-numbers are approximate (the code has drifted) but the *edit regions* and *contention* are accurate. Key reality checks:
> - `createApp.ts` is **128 lines** — the `/api` chain is: `requestObservability`(78) → `requestContextMiddleware`(80) → `helmet`(82) → `cors`(86) → billing webhook(98) → `rateLimit`(99) → `express.json`(110-111) → `createAuthMiddleware`(112) → `bindUidToContext`(114) → `createAiQuota`(116) → `createCoachMeter`(122) → `requirePlusFeature`(123-124) → `createApiRouter`(125). **Every store is constructed at lines 60-75 and injected into `createApiRouter` at line 125.** This single DI line is the hottest contention point in the whole migration.
> - `env.ts` `ArborConfig` type ends at line 51; the `loadConfig` object literal runs lines 82-135; the prod-invariant block is lines 137-150. All config additions are additive to these two regions.
> - `cloudbuild.prod.yaml` has ONE env line (49) using the `^@^` delimiter. All env-var additions append `@KEY=VALUE` to that single line.
> - `firestore.rules` is 62 lines; the append-only `aiRuns`/`safetyReviews`/`organizations` blocks are lines 47-59 — the template every new collection rule copies.
> - `aiQuota.ts` reads `AI_USER_HOURLY_LIMIT` via `process.env` directly (not config) — SEC-2/COST-1 extend it.
> - `analytics.ts`, `index.css`, and `modelRouter.ts`-for-OPS are **NOT modified by any mission** (analytics.ts is only cited as a `console.*` site in OPS-1; index.css is a "do not touch" constraint; modelRouter is OPS-irrelevant). They are listed below as **NO-EDIT / guarded**.

---

## Part 1 — Shared-file → Missions matrix

Legend: **OWNER** = the mission that should land first and create the seam others extend. **+** = additive extender. Order shown is the safe edit order.

### A. `app/src/routes/api.ts`  — THE hotspot (8 missions, ~77 KB)
**Touched by:** SEC-3, SEC-7, AI-1, AI-2, AI-3, AI-4, AI-6, AI-8, CMP-1, CMP-3, CMP-5, COST-4, PERF-4, (REL-2 catch-block).
This file is edited by more missions than any other. It has three distinct edit *seams*, which is what makes coordination tractable:

| Seam | Region | Missions | Nature |
|---|---|---|---|
| **Prompt-build (input)** | coach build ~243-264, council build ~375-408 | AI-3 (delimiters), SEC-3 (profile minimize), COST-4 (card/profile caps) | wrap/transform the same `JSON.stringify(childProfile)` + memory/card injection |
| **Safety call-sites** | ~14 `screenForImmediateEscalation(...)` calls (204…1362); output screen 296/425 | AI-1 (swap to `runInputSafety`), AI-2 (output context arg), AI-6/AI-8 (record review) | replace/augment screen calls |
| **Model-output (structured)** | plan 1073, story 1148, hero 1233, analyze 1314, handoff 1382 | SEC-7 (Zod safeParse), PERF-4 (cache get/put around analyze+plan), REL-2 (ModelUnavailable catch→503) | wrap the `generateJson` result |
| **DI / `ApiDeps` + new routes** | `ApiDeps` 28-38, destructure ~71, admin routes ~1469, privacy export/erase 1530/1551 | CMP-1, CMP-3, CMP-5, AI-6, AI-8, PERF-4 | add deps fields + new route handlers |

**Safe edit order (single owner per seam, sequential within seam):**
1. **AI-3** (prompt delimiters) — establishes the `<arbor:memory|source|parent_message>` wrappers FIRST so SEC-3/COST-4 transform *inside* them.
2. **SEC-3 + COST-4** (profile minimize + card caps) — both transform the prompt-build inputs; apply together in one pass (COST-4's `toCoachProfileContext` and SEC-3's `minimizeProfileForPrompt` should be **merged into one helper** — they overlap by design; spec-E §COST-4 and spec-B §SEC-3 both flag this).
3. **CMP-5** (audit store) — owns the new `ApiDeps` field + DI plumbing pattern that CMP-1/CMP-3/AI-6 then copy.
4. **CMP-1 + CMP-3** (consent routes, export/erase tombstone) — add routes + write into CMP-5's audit store.
5. **AI-1** (input-safety helper swap) — mechanical replace of 14 call-sites with `runInputSafety`.
6. **AI-6 → AI-8** (safetyReview record calls + admin routes; AI-8 adds `outcome` to AI-6's route) — strict order, AI-8 extends AI-6.
7. **AI-2** (output-screen context arg) — pass card/memory strings at 296/425.
8. **SEC-7** (structured-output Zod) + **PERF-4** (analyze/plan cache) — both wrap the SAME 5 structured routes; PERF-4 wraps cache OUTSIDE, SEC-7 validates INSIDE. Apply SEC-7 first (validate), then PERF-4 (cache the validated result). REL-2's catch-block is orthogonal (error path).
9. **AI-4 LAST** (per-route input Zod) — touches *every* handler's body destructure; must land after all the above to avoid re-resolving conflicts on every edit. (spec-F explicitly says "apply AI-4 last".)

**Anti-clobber strategy:** ONE mission per seam at a time; never two branches editing `api.ts` in parallel. This file is the **serialization point** of the whole migration — see Part 2, it is what forces api.ts-touching missions into a single track.

---

### B. `app/src/server/createApp.ts` — DI + middleware hotspot (10 missions)
**Touched by:** OPS-2 (healthz/readyz), REL-4 (healthz/readyz), PERF-1 (healthz + warmup), SEC-1 (csp-report mount), SEC-2 (rate-limit store), SEC-6 (appCheck mount), COST-1 (token-cap mw + setUsageCounters), REL-3 (quota_store log line), CMP-1/CMP-5/CMP-7 (store construction + DI), PERF-4 (analysisCache construction + DI).

Two edit regions, both contended:
- **Store construction (lines 60-75)** + **`createApiRouter({...})` deps object (line 125):** CMP-1 (`consentStore`), CMP-5 (`auditStore`), CMP-7 (sweep init), PERF-4 (`analysisCache`), COST-1 (`setUsageCounters`), REL-3 (one log line). All ADDITIVE to the same deps literal — **append-only fields**, alphabetize to reduce merge churn.
- **Middleware chain (lines 78-124):** `/healthz`+`/readyz` (OPS-2 ∩ REL-4 ∩ PERF-1 — **three missions, ONE route pair**), csp-report mount before auth (SEC-1), rate-limit `store:` option (SEC-2), appCheck mount near 112 (SEC-6), token-cap mount after 119 (COST-1).

**Critical de-dup:** OPS-2, REL-4, and PERF-1 each independently "add `/healthz`". **They must be ONE implementation.** REL-4 is the most complete (adds `/readyz` with Firestore+Vertex breaker probe); OPS-2 needs the smoke-gate target; PERF-1 needs the warmup probe target. Resolution: **REL-4 OWNS `health.ts` + the mount**; OPS-2 and PERF-1 *consume* it (smoke hits it, warmup hits it). Do NOT let three branches each add a health route — pick REL-4's `createHealthRouter` as canonical. Note mount-position nuance: REL-4 wants it on `/api` before auth (after line 80); PERF-1/OPS-2 want a bare `/healthz` (no `/api` prefix, before the chain). **Mount both: a bare public `GET /healthz` (liveness, PERF-1/OPS-2 warmup+smoke) AND `/api/readyz` (readiness, REL-4 deep check).** One PR, one owner.

**Safe edit order:** REL-4 (health router) → SEC-1 → SEC-2 → SEC-6 → COST-1 → store-construction batch (CMP-5 → CMP-1 → PERF-4 → CMP-7 → REL-3 log line). PERF-1 warmup call + OPS-2 smoke reference land alongside REL-4.

**Anti-clobber:** single-owner health route; append-only DI deps object; middleware insertions are at distinct, documented line anchors — assign each insertion a non-overlapping anchor and merge sequentially.

---

### C. `app/src/config/env.ts` — additive config (12 missions)
**Touched by:** SEC-1 (`cspReportOnly`), SEC-2 (`AI_GLOBAL_HOURLY_LIMIT` — actually cloudbuild only, optional here), SEC-3 (`promptFieldMinimization`), SEC-6 (`requireAppCheck`), REL-2 (`modelTimeoutMs`,`breakerFailureThreshold`,`breakerCooldownMs`), PERF-4 (`analysisCacheTtlMs`), COST-1 (`aiUserDailyTokenCap`,`aiGlobalDailyTokenCap`,`aiGlobalCapFailClosed`), COST-4 (`knowledgePromptMaxCards`), AI-1/AI-2/AI-5/AI-6/AI-8 (classifier+review+drift flags), CMP-1 (`consentPolicyVersion`), CMP-5 (`auditChildSalt`), CMP-7 (`memoryRetentionSweepEnabled`).

**Strategy: APPEND-ONLY env block.** Every addition is (a) one field on the `ArborConfig` type (lines 5-51), and (b) one parse line in the `loadConfig` literal (lines 82-135). **No mission changes the prod-invariant block (137-150)** except CMP-7 which only *reads* `arborEnv` for a default. Because all additions are independent new keys, **order does not matter for correctness** — but to avoid textual merge conflicts, land them as ONE coordinated patch per wave, grouped by domain. The specs already call for this ("batch the env-var additions").

**Anti-clobber:** treat `ArborConfig` + `loadConfig` as an append-only registry. Each mission adds its key in its own line; conflicts are trivial textual ones resolved by concatenation. Recommend an **env-keys owner** per wave who merges all additions in a single commit.

---

### D. `cloudbuild.prod.yaml` — the single `^@^` env line (line 49)
**Touched by:** SEC-1 (`CSP_REPORT_ONLY`), SEC-2 (`AI_GLOBAL_HOURLY_LIMIT`), SEC-3 (`PROMPT_FIELD_MINIMIZATION`), SEC-6 (`REQUIRE_APP_CHECK`), REL-2 (`MODEL_TIMEOUT_MS`), REL-4 (startup/liveness probe args), PERF-1 (`--min-instances=1`), PERF-2 (`--concurrency/--cpu/--memory/--max-instances`), PERF-4 (`ANALYSIS_CACHE_TTL_MS`), COST-1 (3 token-cap vars), COST-3 (comment only), COST-4 (`KNOWLEDGE_PROMPT_MAX_CARDS`,`VERTEX_MODEL_CHAT`), AI-1/AI-2/AI-6/AI-8 (classifier flags), OPS-2 (`--no-traffic --tag candidate`), CMP-7 (`MEMORY_RETENTION_SWEEP_ENABLED`).

Two distinct edit regions in the same file:
- **`--set-env-vars ^@^...` string (line 49):** ALL env-var additions append `@KEY=VALUE`. Append-only — never reorder existing keys. Conflicts are textual concatenation only.
- **`gcloud run deploy` args block (lines 36-49):** PERF-1 (`--min-instances`), PERF-2 (`--concurrency/--cpu/--memory/--max-instances`), REL-4 (probe flags), OPS-2 (`--no-traffic --tag`). These are *flag additions* to the args list. **Sequence PERF-1 → PERF-2** (spec-D pins this), then REL-4 probes, then OPS-2 traffic flags.

**Anti-clobber strategy:**
- Env string = **append-only**, single owner per wave merges all `@KEY=VALUE` additions.
- Deploy-args = sequential, ordered PERF-1 → PERF-2 → REL-4 → OPS-2.
- COST-3 is comment-only (no conflict). COST-4's `VERTEX_MODEL_CHAT` *changes an existing value* (already `gemini-2.5-flash`) — the only non-append edit; coordinate so it doesn't collide with an append in the same line.

---

### E. `firestore.rules` (5 missions) + `firestore.indexes.json` (3 missions)
**rules touched by:** SEC-5 (tighten `families`/`children` create — lines 29-45), CMP-1 (`consents` match), CMP-5 (`auditEvents` match), CMP-7 (no rule change, TTL is gcloud), COST-2 (`usageByUser`/`usageRollup` deny), PERF-4 (`analysisCache` server-only deny comment), AI-6 (`safetyReviews` server-write fields/index hint).

**Two non-overlapping kinds of edit:**
- **SEC-5 MODIFIES existing blocks** (`families` line 31, `children` line 40 — replaces `allow create: if signedIn()` with ownership+field validation). This is the ONLY mission that rewrites existing rules. **SEC-5 must be the single owner of lines 29-45** and land without another rules edit racing it.
- **CMP-1, CMP-5, COST-2, PERF-4 ADD new `match` blocks** (append after line 56, mirroring the `aiRuns`/`safetyReviews` append-only template at 47-56). These are append-only and mutually non-conflicting.
- **AI-6** extends the existing `safetyReviews` block (line 53-56) — coordinate with nobody else touching that block (no one does).

**indexes.json touched by:** REL-6 (append composite indexes; never remove `memoryEvents` index lines 3-11), CMP-5 (`auditEvents (actorUid ASC, createdAt DESC)`), CMP-7 (`memoryEvents.expiresAt` index if sweeping). All **append to the `indexes[]` array** — append-only, order-independent.

**Anti-clobber:** SEC-5 owns the existing-rule rewrite (lines 29-45) exclusively; all other rules + all index changes are **append-only new blocks/entries**. The `memoryEvents` composite index (the Gemini-outage fix) must NEVER be removed (REL-6 calls this out).

---

### F. CI workflows
**`.github/workflows/arbor-ci.yml`** touched by: OPS-4 (`npm test`→`test:coverage` + artifact, line 24), OPS-6 (optional paths-filter reminder job), SEC-5 (`test:rules` emulator step after 24), SEC-8 (security job), PERF-3 (`check:bundle` step + `client-perf` job), AI-3 (injection eval step), AI-5 (behavioural eval step), CMP-5 (optional rules-emulator step).

- **OPS-4 MODIFIES line 24** (`npm test` → `npm run test:coverage`). Single-owner that one line.
- **Everything else ADDS steps/jobs** (SEC-5 rules step, SEC-8 separate `security` job, PERF-3 `check:bundle` + `client-perf` job, AI-3/AI-5 eval steps). Additive — append new `- run:` steps or new `jobs:` entries.

**`.github/workflows/arbor-deploy.yml`** touched by: OPS-2 (restructure single `deploy` job → `gate→deploy-stage→smoke-stage→deploy-prod→promote-prod`), OPS-3 (`deploy.event` log-write in promote job), OPS-4 (optional `npm test`→`test:coverage` line 61), SEC-4 (comment cleanup / drop key-fallback step 75-79), SEC-6 (`VITE_FIREBASE_APPCHECK_SITE_KEY` build env 95-101).

- **OPS-2 is the big restructure** of the whole `jobs:` block — it OWNS deploy.yml's structure. OPS-3 adds a step *inside* OPS-2's new promote job (hard dependency). SEC-4 (comment-only/drop fallback) and SEC-6 (add one build-env line) are small and orthogonal but must rebase onto OPS-2's restructured file.

**Anti-clobber:**
- arbor-ci.yml: OPS-4 owns line 24; all other missions add **distinct new jobs/steps** — keep each scan/eval in its OWN job so they merge cleanly and don't reorder the fast path.
- arbor-deploy.yml: **OPS-2 lands first** (restructure), then OPS-3/SEC-4/SEC-6 rebase onto it. Do not parallelize deploy.yml edits.

---

### G. Smaller shared files (lower contention)

| File | Missions | Order / strategy |
|---|---|---|
| `app/package.json` (scripts/deps) | OPS-2 (`smoke`), SEC-5 (`test:rules`), PERF-3 (`check:bundle`+`@lhci/cli`), AI-1 (`eval:redteam:input`), AI-3 (`eval:redteam:injection`), AI-5 (`eval:safety:behavioural`,`eval:modelcard`) | **Append-only** to `scripts` (and `devDependencies` for lhci). Order-independent; merge as concatenation. |
| `app/scripts/vitest.config.mjs` | OPS-4 only | Single owner — no conflict. |
| `app/src/server/quotaStore.ts` | SEC-2 (rate-limit Store adapter consumes it), COST-1 (`addTokens` on iface + 2 impls), REL-3 (test only) | COST-1 OWNS the interface extension; SEC-2 builds an *adapter file* (`rateLimitStore.ts`) that consumes the store without modifying it; REL-3 is test-only. Land COST-1 first. |
| `app/src/server/aiQuota.ts` | SEC-2 (global ceiling increment+429), COST-1 (token-spend gate is a SIBLING file `aiTokenCap.ts`, not an edit here) | SEC-2 is the only direct editor of `aiQuota.ts`. COST-1 adds `aiTokenCap.ts` beside it. No conflict — different files. |
| `app/src/ai/usage.ts` (hot path) | COST-2 (`recordUsageRollup` signature change), COST-1 (`addTokens` calls) | **COST-2 FIRST** (changes the signature + route/uid plumbing), then COST-1 adds `addTokens` calls. spec-E pins this — same 5-line block. |
| `app/src/server/usageRollup.ts` | COST-2 only | Single owner. |
| `app/src/server/adminMetrics.ts` | COST-2 (`byRoute`/`topUsers`), AI-6 (`safetyQueue`), AI-8 (`fpRate7d`/`fnCount7d`) | Append fields to `AdminOverview`/`overview()`. COST-2 and AI-6/AI-8 add disjoint fields — additive. Order: any; merge as concatenation. |
| `app/src/server/admin.ts` | COST-2 (optional `estimateCostByRoute`) | Single owner. |
| `app/src/ai/modelRouter.ts` | REL-2 (breaker+timeout wrap), PERF-1 (`warmup()`), COST-4 (optional tiered-route hint), AI-1 (optional route alias), AI-7 (comment only) | REL-2 wraps the `withModelRetry` bodies; PERF-1 adds `warmup()` methods; both touch the provider classes but at DIFFERENT method bodies. Order: PERF-1 (add warmup methods) → REL-2 (wrap call bodies). COST-4/AI-1 are optional/conditional; AI-7 comment-only. |
| `app/src/ai/modelRetry.ts` | REL-2 only (`withTimeout`, `ModelUnavailableError`) | Single owner. |
| `app/src/ai/claudeVertexProvider.ts` | REL-2 (signal+wrap), PERF-1 (`warmup()`) | Same as modelRouter: PERF-1 adds warmup, REL-2 wraps fetch — distinct lines, sequence PERF-1→REL-2. |
| `app/src/safety/escalation.ts` | AI-1 (export verdict type), AI-8 (ensure `source` on verdict) | Both additive to the verdict type; AI-1 first, AI-8 extends. No behavioural change. |
| `app/src/safety/outputScreen.ts` | AI-2 (`grounded`/`ungroundedClaims`), AI-5 (consumes verdict) | AI-2 owns the extension; AI-5 reads it. |
| `app/src/memory/memoryService.ts` | AI-3 (`stripControlPhrases` in `getApprovedMemoryContext`), CMP-7 (`expireStaleMemory` + `expiresAt`) | Disjoint functions — AI-3 edits the context-render map, CMP-7 adds a sweep fn + append field. Additive; order-independent. |
| `app/src/server/redaction.ts` | SEC-3 only (multi-entity tokens) | Single owner. |
| `app/src/lib/api.ts` (client seam) | SEC-6 (`X-Firebase-AppCheck` in `authHeaders`), CMP-1 (`api.consent*`), CMP-3 (export/erase), CMP-5 (`api.audit`) | SEC-6 edits `authHeaders()`; CMP-* add new methods. Disjoint — additive. |
| `app/src/lib/i18n.ts` | CMP-1 (`consent.*` keys), CMP-3 (export/erase strings) | Append-only key additions, EN+HE. |
| `app/src/lib/childData.ts` | CMP-3 only | Single owner. |
| `firestore.indexes.json` | REL-6, CMP-5, CMP-7 | Append-only (see §E). |
| `app/src/server/safetyReviewStore.ts` | AI-6 (create), AI-8 (`outcome` field) | AI-6 creates, AI-8 extends. Strict order. |

---

### H. NO-EDIT / guarded files (named in the task but modified by NO mission)

| File | Status |
|---|---|
| `app/src/lib/analytics.ts` | **Not modified.** Cited only in OPS-1 as one of 6 `console.*` sites (client-side, `import.meta.env.DEV` debug) — left as-is. Client first-party analytics, orthogonal to the migration. |
| `app/src/index.css` | **Do-not-touch constraint.** spec-E/spec-D flag it as the fragile 370-line / 344-hex-literal override hack. COST-2's dashboard work must use CSS vars and edit only its own component, NEVER `index.css`. PERF-3 budgets the CSS/font chunk but does not edit the file. |
| `app/src/ai/modelRouter.ts` (re OPS) | spec-A explicitly states modelRouter is **not** modified by any OPS mission (it IS modified by REL-2/PERF-1/COST-4/AI-1 — see §G). |
| `firebase.json` | REL-4 *verifies* the `/api/**` rewrite forwards `/healthz` (wildcard already covers it) — **no edit expected**. Listed for completeness; treat as read-only unless a bare-`/healthz`-outside-`/api` decision is taken (not recommended). |

---

## Part 2 — Parallel tracks (disjoint-file mission sets)

The migration has **three serialization points** that dictate parallelism:
1. **`api.ts`** — 14 missions; only one can edit at a time → forces a single "api.ts spine" track.
2. **`createApp.ts`** — 10 missions; DI deps + middleware → mostly co-travels with the api.ts spine (same missions construct stores there).
3. **`cloudbuild.prod.yaml` + `env.ts`** — append-only, so NOT a true serialization point if managed as a per-wave batched patch.

Everything that does NOT touch `api.ts`/`createApp.ts` can run in **fully parallel worktrees**. Below: tracks designed so each track's file-set is disjoint from the others (except for the append-only `env.ts`/`cloudbuild`/`package.json` registries, which are merged via a per-wave batch owner, not edited concurrently in-conflict).

### Track 1 — "API spine" (SERIAL, single worktree, single owner)
**Missions (in edit order):** AI-3 → SEC-3+COST-4 → CMP-5 → CMP-1 → CMP-3 → AI-1 → AI-6 → AI-8 → AI-2 → SEC-7 → PERF-4 → AI-4 → (REL-2 catch-block).
**Why serial:** every one edits `api.ts` and/or `createApp.ts` DI. This is the critical path. Treat as ONE branch with sequential commits per mission, in the order in §A. Cannot be parallelized internally without clobbering.
**Files owned:** `api.ts`, `createApp.ts` (store construction + DI), `redaction.ts`, `memoryService.ts`, `outputScreen.ts`, `safetyReviewStore.ts`, `audit.ts`, `consent.ts`, `analysisCache.ts`, `contracts/*`, `promptHardening.ts`, `inputScreen.ts`, `profileMinimize.ts`, `promptBudget.ts`, `lib/childData.ts`, client consent/export UI.

### Track 2 — "Reliability/AI-model internals" (parallel-safe vs Track 1)
**Missions:** REL-2 (timeout+breaker, minus the api.ts catch — defer that one commit to Track 1), REL-4 (health.ts + createApp mount — **coordinate the createApp mount with Track 1's owner**), PERF-1 (warmup + healthz).
**Files owned:** `modelRetry.ts`, `circuitBreaker.ts`, `degraded.ts`, `modelRouter.ts`, `claudeVertexProvider.ts`, `health.ts`, `quotaStore.test.ts`.
**Conflict note:** REL-4 + PERF-1 both touch `createApp.ts` middleware (health route) — this is the ONE overlap with Track 1. Resolution: **REL-4 owns the canonical `createHealthRouter` + mount; Track 1's owner merges the mount line.** Land health-route mount as an early Track-1 commit, then Track 2 builds `health.ts` internals in parallel. PERF-1's warmup() on modelRouter/claudeVertexProvider is disjoint from REL-2's wrap (different methods) but **sequence PERF-1 warmup before REL-2 wrap within Track 2.**

### Track 3 — "Cost/usage telemetry" (parallel-safe)
**Missions (in order):** COST-2 → COST-1.
**Files owned:** `usage.ts`, `usageRollup.ts`, `usageByUser.ts`, `adminMetrics.ts`, `admin.ts`, `aiQuota.ts`, `quotaStore.ts` (interface), `aiTokenCap.ts`.
**Conflict note:** COST-1 mounts `aiTokenCap` + `setUsageCounters` in `createApp.ts` (overlaps Track 1's createApp). Land that mount as a Track-1-coordinated commit. COST-2 extends `adminMetrics.ts` which AI-6/AI-8 (Track 1) also extend — **disjoint fields**, merge additively. `quotaStore.ts` interface (COST-1) vs SEC-2 adapter (Track 4) — COST-1 owns the interface; SEC-2 only consumes.

### Track 4 — "Security edge" (parallel-safe)
**Missions:** SEC-1 (CSP report), SEC-2 (rate-limit store + global ceiling), SEC-5 (firestore.rules create-ownership + emulator tests), SEC-6 (App Check).
**Files owned:** `cspReport.ts`, `rateLimitStore.ts`, `appCheckMiddleware.ts`, `firebase.ts`, `lib/api.ts` (authHeaders), `firestore.rules` (SEC-5 owns lines 29-45), `MarkdownBlock.tsx`.
**Conflict note:** SEC-1/SEC-2/SEC-6 each add a `createApp.ts` middleware mount (csp-report, rate-limit store option, appCheck) — coordinate with Track 1 as discrete mount lines at distinct anchors. SEC-5 owns the rules-rewrite exclusively (no other mission rewrites existing rules). SEC-2's `aiQuota.ts` global-ceiling edit overlaps Track 3's interest in aiQuota — but COST-1 doesn't edit aiQuota.ts (it adds aiTokenCap.ts), so **SEC-2 is sole editor of aiQuota.ts**. `lib/api.ts` authHeaders (SEC-6) vs CMP-* new methods (Track 1) — disjoint, additive.

### Track 5 — "Infra-as-code + docs" (FULLY parallel, no app-code conflict)
**Missions:** OPS-1, OPS-2, OPS-3, OPS-4, OPS-5, OPS-6, REL-1, REL-5, REL-6, PERF-2, PERF-3, COST-3, SEC-4, SEC-8, SEC-9, AI-5, AI-7, CMP-2, CMP-4, CMP-6, and the doc-portions of CMP-7.
**Files owned:** `infra/monitoring/*`, `infra/billing/*`, `infra/rollback.sh`, `cloudbuild.stage.yaml`, `docs/**` (DPIA, RoPA, runbooks, SLO, DR, model-cards), CI workflows, `vitest.config.mjs`, `firestore.indexes.json`, `app/scripts/*` (smoke, dora, loadtest, eval-behavioural, check-bundle), red-team JSONL sets.
**Conflict notes / internal ordering:**
- **CI workflows:** OPS-4 owns `arbor-ci.yml` line 24; SEC-5/SEC-8/PERF-3/AI-3/AI-5 add *new jobs/steps* (additive). OPS-2 owns `arbor-deploy.yml` restructure → OPS-3/SEC-4/SEC-6 rebase onto it. Keep CI edits in ONE sub-owner to serialize the two workflow files.
- **cloudbuild deploy-args:** PERF-1 → PERF-2 → REL-4 → OPS-2 (sequential, see §D). PERF-1 lives in Track 2; coordinate the deploy-args block via the **cloudbuild batch owner** (below).
- **firestore.indexes.json:** REL-6 + CMP-5 + CMP-7 append-only.

### Cross-track batch owners (merge-coordination roles, not tracks)
Because `env.ts`, `cloudbuild.prod.yaml` (env string), and `package.json` (scripts) are append-only registries touched by nearly every track, assign **two batch-owner roles** that collect and merge additions per wave rather than letting tracks edit them concurrently:
- **Config batch owner:** merges all `ArborConfig`/`loadConfig` additions (12 missions) + all `^@^` env-string additions + all `package.json` script additions into one commit per wave. Tracks submit their key/script as a diff fragment; owner concatenates.
- **Cloudbuild deploy-args owner:** serializes the `gcloud run deploy` *flag* additions in the fixed order PERF-1 → PERF-2 → REL-4 → OPS-2 (these are NOT append-only — they share the args list).

### Parallelism summary
- **5 tracks run concurrently** in separate branches/worktrees.
- **Track 1 (API spine) is the critical path** and internally serial — it gates the wall-clock.
- **Tracks 2/3/4** run in parallel with Track 1 but each has ~1-3 `createApp.ts` mount lines that must be merged into Track 1's file via coordinated discrete commits (single-owner-of-createApp pattern: Track 1's owner accepts mount-line PRs from 2/3/4).
- **Track 5 is fully independent** (infra + docs + CI + scripts) — zero app-runtime-code conflict; can start day 1 and run to completion without waiting on any other track, except the CI/cloudbuild-args sub-ordering noted above.
- **Two batch-owner roles** keep the append-only registries (`env.ts`, cloudbuild env string, `package.json`) conflict-free.

### Recommended wave sequencing (maps to the specs' own waves)
1. **Wave 0 (parallel, no deps):** Track 5 docs (CMP-2/4/6, REL-1/5, SEC-9, AI-7, OPS-5) + infra scaffolding (OPS-1 monitoring, COST-3 billing, REL-6 indexes/TTL).
2. **Wave 1:** Track 4 (SEC-1/2/5/6), Track 3 (COST-2→COST-1), Track 2 (REL-2/4, PERF-1) start in parallel; Track 1 begins with AI-3 → SEC-3+COST-4 → CMP-5.
3. **Wave 2:** Track 1 continues (CMP-1/3, AI-1/6/8/2, SEC-7, PERF-4, AI-4); OPS-2 deploy restructure (Track 5) → OPS-3; SEC-4/8, PERF-2/3 land.
4. **Wave 3:** CMP-7 sweep wiring, REL-3 verification, final env/cloudbuild batch merge, enforce-mode flips (CSP, App Check, coverage thresholds).

---

## Part 3 — The five highest-risk clobber points (watch-list)

1. **`api.ts` structured-output routes (1073/1148/1233/1314/1382):** SEC-7 (Zod) + PERF-4 (cache) + REL-2 (catch) all target the same 5 handlers. Single-owner, order SEC-7→PERF-4, REL-2 catch separate.
2. **`api.ts` prompt-build (243-264 / 375-408):** AI-3 + SEC-3 + COST-4 — merge the profile-minimizer (SEC-3 ∩ COST-4 produce overlapping helpers; build ONE).
3. **`createApp.ts` health route:** OPS-2 + REL-4 + PERF-1 each "add `/healthz`" — build ONE (REL-4 canonical), mount bare `/healthz` + `/api/readyz`.
4. **`usage.ts` `recordUsage()` 5-line block:** COST-2 (signature) + COST-1 (addTokens) — COST-2 first, same commit-pair.
5. **`cloudbuild.prod.yaml` deploy-args vs env-string:** flag-additions (PERF-1/2, REL-4, OPS-2) are ordered & shared (not append-only) while env-string additions are append-only — keep the two regions under separate ownership so an append doesn't collide with a flag insert.
