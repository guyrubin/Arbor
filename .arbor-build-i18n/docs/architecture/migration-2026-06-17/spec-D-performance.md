# Spec D — Performance Efficiency (WAF-Perf)

**Domain:** Performance Efficiency
**Source backlog:** `docs/architecture/well-architected-assessment-2026-06-04.md` §Gaps (PERF-1..4), score 3.0/5.
**Author:** Principal Engineer, Architecture Advisory
**Date:** 2026-06-17
**Markets:** Netherlands (NL) + Israel (IL) — both first-class. EU residency is already satisfied (`europe-west4` for Cloud Run, Firestore, Vertex), so none of these missions changes the data-residency posture. The market notes below focus on where a perf change touches latency-of-consent UX, B2G SLO bars, or RTL/Hebrew rendering budgets.

## Domain intro

Arbor's current performance posture is genuinely good on the two hardest axes: SSE token streaming on `/api/chat` (the highest-latency path) and client code-splitting with immutable CDN-cached assets (`firebase.json` sets `max-age=31536000, immutable` on `/assets/**`, and `vite.config.ts` already declares `manualChunks` for `vendor-firebase`, `vendor-charts`, `vendor-dnd`, `vendor-motion`). The remaining gaps are all about **predictable latency and cost-bounded compute**, not architecture rewrites:

1. **Cold starts (PERF-1).** Cloud Run is deployed via `cloudbuild.prod.yaml` with NO `--min-instances`, so the service scales to zero. Worse, the Vertex SDK is *deliberately* lazy-imported (`VertexGeminiProvider.getVertex()` in `app/src/ai/modelRouter.ts` `import("@google-cloud/vertexai")` on first call) and the Claude path constructs a `GoogleAuth` client + fetches an access token per request (`app/src/ai/claudeVertexProvider.ts`). On a cold instance the *first* AI call pays container start + module import + ADC token mint. There is no `/healthz` route anywhere in the codebase to warm against.
2. **Untuned Cloud Run sizing (PERF-2).** No `--concurrency`, `--cpu`, or `--memory` flags in `cloudbuild.prod.yaml`; the service runs on Cloud Run defaults (concurrency 80, 1 vCPU, 512Mi) which are almost certainly wrong for a Node/Express app that fans out to Vertex.
3. **No client perf budget (PERF-3).** CI (`.github/workflows/arbor-ci.yml`) runs lint/test/framework/safety/build but never measures bundle size or Lighthouse. `recharts` (~364KB) and `firebase` (~566KB) are split but not budgeted, so a regression ships silently.
4. **Thin AI caching (PERF-4).** Only "Today's Focus" caches, and it caches *client-side* (`app/src/hooks/useTodaysFocus.ts` writes a Firestore doc under `users/{uid}/children/{childId}/insights/todaysFocus`). The expensive structured analyses — `/api/analyze-behavior`, `/api/generate-plan` — re-call the model on every identical request with no server-side cache.

Guiding principles for this spec: **prefer managed-service config over new code** (PERF-1/2 are mostly `gcloud` flags), **make every change additive and reversible**, and **flag every recurring-cost line** (min-instances is the only one here, and it has a cheaper warmup alternative). The Firestore cache pattern for PERF-4 reuses the *exact* shape already proven in `app/src/server/quotaStore.ts` (`FirestoreCounterStore` with an `expireAt` field for a TTL policy) — no new dependency, no Redis.

---

### PERF-1 — First AI call is fast: keep one warm instance and pre-init the Vertex clients

- **Objective / done-when:**
  - A `GET /healthz` route exists on the Express app, returns `200 {status:"ok"}`, is **not** behind auth/rate-limit/CORS, and never calls a model.
  - On boot, the Vertex Gemini client (`@google-cloud/vertexai` import + `VertexAI` construction) and the Claude `GoogleAuth` client are **eagerly initialized** (not on first request), guarded so local/`gemini_dev` mode is unaffected.
  - Cloud Run prod runs with either `--min-instances=1` **or** a scheduled warmup hitting `/healthz` (decision below). Measured: p95 latency of the *first* `/api/chat` after 15 min idle drops from cold (~target: <3s to first token vs. multi-second cold today).
  - `tsc`, `vitest`, and `vite build` stay green.
- **Approach (grounded in real code):**
  1. **Health route.** Add a public `GET /healthz` in `app/src/server/createApp.ts` mounted **before** the `/api` chain (so it skips `createAuthMiddleware`, `rateLimit`, and CORS). Place it right after `app.set("trust proxy", 1)` and the middleware wiring but before `app.use("/api", ...)`. Body: `res.json({ status: "ok", env: config.arborEnv })`. This is the warmup + Cloud Run startup-probe target. (Today the only root handler is the SPA catch-all in `app/src/server/start.ts` `app.get("*", ...)`, which serves `index.html` — fine, but a dedicated JSON route is cheaper to probe and unambiguous.)
  2. **Eager client init.** In `app/src/ai/modelRouter.ts`, `VertexGeminiProvider.getVertex()` lazily does `import("@google-cloud/vertexai")`. Add a public `async warmup()` to `VertexGeminiProvider` and `VertexModelProvider` that calls `getVertex()` (forcing the dynamic import + `VertexAI` construction) and, for `ClaudeVertexProvider`, calls `this.auth.getClient()` once to prime ADC. Add `warmup?(): Promise<void>` to the `ModelProvider` interface (optional so `GeminiDevProvider` can no-op). In `app/src/server/createApp.ts`, after `const modelProvider = createModelProvider(config);`, fire-and-forget `void (modelProvider.warmup?.())` **only when** `config.modelProvider === "vertex"` — guarded so local dev and tests never touch Vertex. Wrap in try/catch that logs via `logger` (warmup failure must NOT crash boot — fail-open, same philosophy as `quotaStore`).
  3. **Keep-warm strategy (pick the cheaper path).** Two options:
     - **(A) `--min-instances=1`** — one flag in `cloudbuild.prod.yaml`. Simplest, but bills ~$0.– for one always-on instance (recurring cost; see Cost impact).
     - **(B) Cloud Scheduler warmup** — a Cloud Scheduler job hits `https://<host>/healthz` every 5 min. Cheaper at low traffic (instance still scales to zero between pings would defeat it, so this is "best-effort warm," not guaranteed). **Recommendation: ship (A) `--min-instances=1` for the B2G/clinical launch** because municipalities/JGZ and insurers will expect predictable latency, and min-instances=1 is the only reliable guarantee. Document (B) as the cost-down lever for a pre-revenue beta.
  - Add `--min-instances=1` to the `gcloud run deploy` args block in `cloudbuild.prod.yaml` (the `run deploy arbor-api` step, after `--allow-unauthenticated`). Optionally add `--no-cpu-throttling` later under PERF-2 (CPU-always-allocated keeps the warm instance responsive but costs more — defer to PERF-2 load test).
- **Files to CREATE:** none (route lives in existing `createApp.ts`).
- **Files to MODIFY:**
  - `app/src/server/createApp.ts` — **SHARED/high-traffic.** Adds `/healthz` route + `void modelProvider.warmup?.()` call. Touches the region between line ~59 (`app.set("trust proxy", 1)`) and line ~99 (`app.use("/api", rateLimit(...))`). New route must be mounted before the `/api` auth/rate-limit chain.
  - `app/src/ai/modelRouter.ts` — **SHARED.** Adds `warmup()` to `VertexGeminiProvider` (~line 258), `VertexModelProvider` (~line 358), optional `warmup?()` on the `ModelProvider` interface (~line 101), and a no-op or absent impl on `GeminiDevProvider`.
  - `app/src/ai/claudeVertexProvider.ts` — add `async warmup()` that calls `this.auth.getClient()` (line 47 already constructs `GoogleAuth`).
  - `cloudbuild.prod.yaml` — **SHARED infra.** Add `--min-instances=1` to the `run deploy` args (block at lines 34–49). Does NOT touch the `^@^…` env-var string (line 49).
- **Interfaces/contracts:**
  - New route: `GET /healthz → 200 { status: "ok", env: ArborEnvironment }`.
  - New method on `ModelProvider`: `warmup?(): Promise<void>`.
  - Infra: Cloud Run `--min-instances=1` (or Cloud Scheduler → `/healthz`).
  - No new env vars required. (Optional future: `WARMUP_ENABLED` to gate the boot warmup, but keep it implicit-by-provider for now.)
- **Test plan:**
  - Unit: a vitest that calls `createApp(config)` with a stub config and asserts `GET /healthz` returns 200 without an auth header (supertest-style; mirror the existing route tests). Assert `warmup` is NOT invoked for `modelProvider: "gemini_dev"`.
  - Unit: `VertexGeminiProvider.warmup()` resolves and memoizes `vertexPromise` (assert a second `getVertex()` doesn't re-import — mock `import`).
  - Live: deploy to prod via `cloudbuild.prod.yaml`; `curl https://<host>/healthz` returns ok; let the service idle 15 min, then time first `/api/chat` first-token latency vs. a pre-change baseline. Confirm `gcloud run services describe arbor-api` shows `minScale: 1`.
  - Guard: `npm run lint && npm test && npm run build` green.
- **NL note:** B2G readiness gate — municipalities/JGZ-consultatiebureau and insurer pilots will set latency SLOs; min-instances=1 is the floor that makes a latency SLA defensible. `/healthz` must NOT leak config (return only `status`+`env`, never project id, model names, or counts) since the endpoint is unauthenticated and could be probed.
- **IL note:** Hebrew/RTL coach turns are slightly longer token-wise (Hebrew is denser per glyph but code-switching inflates token count); warm Vertex client matters most on the first IL coach turn of the day. No IL-specific divergence in implementation. Keep `/healthz` payload free of any user/PII so Amendment-13 breach-notification scope is unaffected.
- **Effort:** S
- **Severity:** Med
- **Dependencies:** none. (PERF-2 may later add `--no-cpu-throttling`/`--cpu`/`--memory` to the same `run deploy` block — sequence PERF-1 first so the warm-instance baseline exists before tuning.)
- **Rollback:** Remove `--min-instances=1` (service scales to zero again) and/or revert the `warmup?()` call — both are additive and independently revertible. `/healthz` is inert and can stay.
- **Cost impact:** **Recurring.** `--min-instances=1` keeps one instance alive 24/7 (CPU billed only during requests unless `--no-cpu-throttling`; idle memory billed). Cheaper alternative: Cloud Scheduler pinging `/healthz` (best-effort warm, near-zero cost) — accept weaker latency guarantee. Eager warmup itself adds ~one Vertex import + one ADC token mint at boot: negligible.

---

### PERF-2 — Right-size Cloud Run from a load test and document it

- **Objective / done-when:**
  - A documented load test (k6 or `hey`/`ab`) drives `/api/chat` (SSE) and `/api/analyze-behavior` (JSON) at representative concurrency.
  - From the results, `--concurrency`, `--cpu`, and `--memory` are set explicitly in `cloudbuild.prod.yaml` (no longer Cloud Run defaults).
  - A short runbook `docs/architecture/migration-2026-06-17/perf-cloudrun-sizing.md` records the test method, the numbers, and the chosen values with rationale.
  - `vite build` + deploy stay green; no functional change.
- **Approach (grounded in real code):**
  - The app is a single Express process (`app/src/server/createApp.ts` → `startHttpServer` in `start.ts`, `app.listen` line 29). Each `/api/chat` request holds an open SSE connection (`beginSse` in `app/src/routes/api.ts` line ~52) for the full model stream — these are **long-lived, low-CPU, I/O-bound** connections. That argues for **higher concurrency** (many idle-waiting SSE streams per instance) but **enough memory** for the firebase-admin SDK + buffered responses. Default concurrency 80 is plausibly fine; the unknown is memory headroom (`firebase-admin` + `@google-cloud/vertexai` resident set).
  - **Method:** Run `hey`/`k6` from Cloud Shell (same region, removes WAN noise) against a dedicated load-test Cloud Run revision. Two profiles: (1) burst of N concurrent `/api/analyze-behavior` (CPU/JSON-parse bound), (2) M concurrent held-open `/api/chat` SSE streams (connection-count bound). Watch `gcloud run` metrics: instance count, CPU util, memory util, request latency, and any container OOM/`503`.
  - **Set flags** in the `run deploy` block of `cloudbuild.prod.yaml`: start from `--concurrency=80 --cpu=1 --memory=512Mi`, then adjust per results. Likely outcomes: bump `--memory` to `1Gi` if firebase-admin + buffers push RSS past 512Mi; lower `--concurrency` only if CPU saturates before connection count does. Document `--max-instances` too (cost ceiling).
  - This is **config-only** — no code change. Rides entirely on managed-service flags.
- **Files to CREATE:**
  - `docs/architecture/migration-2026-06-17/perf-cloudrun-sizing.md` (runbook + results).
  - Optionally `app/scripts/loadtest/chat.js` + `analyze.js` (k6 scripts) — additive, not wired into CI.
- **Files to MODIFY:**
  - `cloudbuild.prod.yaml` — **SHARED infra.** Add `--concurrency`, `--cpu`, `--memory`, `--max-instances` to the `run deploy arbor-api` args block (lines 34–49). Does not touch the env-var string.
- **Interfaces/contracts:** Cloud Run service config only: `--concurrency`, `--cpu`, `--memory`, `--min-instances` (shared with PERF-1), `--max-instances`. No app code or env vars.
- **Test plan:**
  - Load test is the test. Capture before/after p50/p95 latency and instance count at target RPS.
  - Post-change smoke: deploy, run a small `hey` burst, confirm no 5xx/OOM, confirm SSE streams complete.
  - `npm run build` green (build unaffected by infra flags).
- **NL note:** B2G readiness — insurer/municipal procurement may require a documented capacity/SLO basis; this runbook is that artifact. Set `--max-instances` to bound spend and to make the cost ceiling auditable for a DPA/procurement review.
- **IL note:** No divergence. If IL traffic peaks at different local hours than NL, note both peaks in the runbook so `--min-instances`/`--max-instances` cover the combined diurnal curve.
- **Effort:** S
- **Severity:** Low
- **Dependencies:** PERF-1 (shares the `run deploy` args block in `cloudbuild.prod.yaml` and the `/healthz` route as a stable load-test target). Sequence PERF-1 → PERF-2 so the conflict-mapper applies both edits to the same block in order.
- **Rollback:** Remove the flags → revert to Cloud Run defaults. Fully reversible, no data impact.
- **Cost impact:** Net **cost-down or neutral** — explicit `--max-instances` caps spend; right-sized memory avoids over-provisioning. The only cost-up risk is choosing `--no-cpu-throttling` (defer unless the load test proves SSE responsiveness needs it).

---

### PERF-3 — Ship a client perf budget + bundle-size gate in CI

- **Objective / done-when:**
  - CI fails when a tracked bundle (e.g. `vendor-firebase`, `vendor-charts`, the app entry) exceeds a committed size budget.
  - A Lighthouse (or lighthouse-ci) check runs against the built SPA and enforces minimum perf/PWA scores (advisory-then-enforced).
  - Budgets are committed as a file, reviewable in PRs; a regression that inflates the bundle is blocked, not silently shipped.
  - All existing CI steps stay green.
- **Approach (grounded in real code):**
  - `vite.config.ts` already splits vendors via `manualChunks` (`vendor-firebase`, `vendor-charts`, `vendor-dnd`, `vendor-motion`) and sets `chunkSizeWarningLimit: 900` — a *warning*, not a gate. We convert intent into an enforced budget.
  - **Bundle-size gate (primary, cheap, deterministic):** add an `npm run check:bundle` script + `app/scripts/check-bundle.mjs` that runs after `vite build`, reads `app/dist/assets/*.js`, sums gzip size per logical chunk, and compares against a committed `app/perf-budget.json` (e.g. `{ "vendor-firebase": 200_000, "vendor-charts": 130_000, "entry": 250_000 }` in gzip bytes — set the initial numbers from the *current* build so it ratchets, never loosens). Exit non-zero on breach. This needs no network, no Chrome, runs in seconds.
  - **Lighthouse gate (secondary):** add `@lhci/cli` (lighthouse-ci) as a devDependency + `app/lighthouserc.json` asserting categories (`performance >= 0.85`, `pwa >= 0.9` — start advisory `warn`, flip to `error` once stable). Runs `lhci autorun` against `npm run preview` (vite preview server) in a separate CI job. Heavier (downloads Chrome) so make it its own job, not blocking the fast quality-gates job initially.
  - **CI wiring:** in `.github/workflows/arbor-ci.yml`, add `- run: npm run check:bundle` immediately after the existing `- run: npm run build` (line 27). Add a separate `client-perf` job (or step) for `lhci autorun`. Keep the bundle check in the fast path; keep Lighthouse non-blocking until calibrated.
- **Files to CREATE:**
  - `app/scripts/check-bundle.mjs` — gzip-size-per-chunk checker.
  - `app/perf-budget.json` — committed budgets (gzip bytes).
  - `app/lighthouserc.json` — Lighthouse assertions (optional, secondary).
- **Files to MODIFY:**
  - `.github/workflows/arbor-ci.yml` — **SHARED CI.** Add `- run: npm run check:bundle` after line 27 (`- run: npm run build`); add a `client-perf` job for Lighthouse. Sequence after `build` since both consume `app/dist`.
  - `app/package.json` — **SHARED.** Add `"check:bundle": "node scripts/check-bundle.mjs"` to `scripts` (after the existing `build` line ~8); add `@lhci/cli` to `devDependencies` if shipping the Lighthouse job. (Note: other perf/cost missions may also touch `package.json` scripts — list this so the conflict-mapper merges script additions rather than clobbering.)
  - `app/vite.config.ts` — optional: tighten `chunkSizeWarningLimit` to match the enforced budget so the build warning and the CI gate agree. Low-touch.
- **Interfaces/contracts:**
  - New scripts: `npm run check:bundle` (exit code 0/1). Budget schema in `perf-budget.json`: `Record<chunkName, gzipBytes>`.
  - CI: new step in `app-quality-gates` + optional `client-perf` job.
  - No runtime/app behavior change, no env vars.
- **Test plan:**
  - Run `npm run build && npm run check:bundle` locally — passes at current sizes. Artificially set a budget below current size → confirm it fails (validates the gate bites).
  - Confirm the gate reads the real `dist/assets/*.js` hashed filenames (vite emits content-hashed names) — match by chunk-name prefix, not exact filename.
  - Lighthouse: `npx lhci autorun` locally against `npm run preview`; confirm scores parse and assertions evaluate.
  - CI dry-run on a branch PR — both jobs visible, fast job stays fast.
- **NL note:** Future **Dutch-language UI** (app is EN/HE today) will add an i18n bundle/locale data; the budget must be revisited when NL strings land so the gate doesn't false-positive on legitimate locale growth. Perf budget indirectly supports the JGZ/municipal accessibility expectation (fast load on modest municipal/consultatiebureau hardware).
- **IL note:** Hebrew/RTL ships an RTL stylesheet path and possibly a Hebrew webfont — both add weight. Budget the font/locale chunk explicitly so RTL support doesn't silently blow the JS budget, and so a CSS/font regression is caught (relevant given `index.css` is the fragile 370-line override hack + 344 hex literals).
- **Effort:** S
- **Severity:** Low
- **Dependencies:** none (independent of PERF-1/2/4). Touches CI + `package.json` — coordinate ordering with any other mission editing those shared files.
- **Rollback:** Remove the CI step + script; delete budget files. Zero runtime impact, fully reversible.
- **Cost impact:** Near-zero. Bundle check is free. Lighthouse-CI adds a few CI minutes per run (downloads Chrome) — keep it in a separate job so it doesn't slow the critical path; can be `schedule`-only if minutes matter.

---

### PERF-4 — Cache structured analysis + Today's Focus server-side with a TTL

- **Objective / done-when:**
  - Identical `/api/analyze-behavior` (and optionally `/api/generate-plan`) requests within a TTL window return a cached result without re-calling the model.
  - Cache lives in Firestore with an `expireAt` field a TTL policy can sweep (reuse the `quotaStore.ts` pattern), keyed by a deterministic hash of `(route, uid/childId, normalized input)`.
  - Cache is **safety-correct**: an input that trips `screenForImmediateEscalation` is NEVER served from cache and NEVER cached (the 409 path must always run live).
  - Cache failures fail **open** (cache miss → live call), same philosophy as `FirestoreCounterStore`.
  - Measurable: a repeated identical analyze-behavior request returns in <100ms (cache hit) vs. a multi-second model call, and token spend for the repeat is zero.
  - `tsc`, tests, build green.
- **Approach (grounded in real code):**
  - **Today's Focus already caches** — but *client-side* in `app/src/hooks/useTodaysFocus.ts` (Firestore doc `users/{uid}/children/{childId}/insights/todaysFocus`, 24h `dateKey` check). It routes through `/api/chat`, so it already avoids re-calling per render. PERF-4's net-new value is **server-side caching of the structured analyses** that have no cache at all today: `/api/analyze-behavior` (`api.ts` line ~1289) and `/api/generate-plan` (line ~1050) call `modelProvider.generateJson({ route: "analysis_structured", ... })` fresh every time.
  - **Reuse the proven Firestore-TTL pattern.** `app/src/server/quotaStore.ts` `FirestoreCounterStore` already shows the exact idiom: lazy `initializeApp({ credential: applicationDefault() })`, `getFirestore(config.firestoreDatabaseId)`, doc writes with an `expireAt: new Date(...)` for a Firestore TTL policy, and **fail-open** try/catch. Build `app/src/server/analysisCache.ts` with the same shape:
    - `interface AnalysisCache { get(key): Promise<unknown|null>; put(key, value, ttlMs): Promise<void>; }`
    - `FirestoreAnalysisCache` → collection `analysisCache`, doc id = sanitized hash; stores `{ value, createdAt, expireAt }`; `get` returns `null` on miss/expired/error (fail-open).
    - `MemoryAnalysisCache` for local/sandbox (mirrors `MemoryCounterStore`).
    - `createAnalysisCache(config)` = Firestore in prod (`memoryAdapter === "firestore"`), memory otherwise — identical selector to `createCounterStore`.
  - **Cache key.** Deterministic, PII-safe: `sha256(route + "|" + uid + "|" + childId + "|" + stableStringify(normalizedInput))`. Use the *redacted* input where possible — but simplest and safe is to hash the raw request body server-side and never store the body, only the hash → result. Store the model OUTPUT only (already non-diagnostic, already passes output screen). Because `analyze-behavior`/`generate-plan` redact `childProfile.name` before the model call, hash after the same normalization so a name change doesn't needlessly bust the cache (optional refinement).
  - **Wire-in (minimal, surgical).** In `api.ts` `/api/analyze-behavior`: after the existing `screenForImmediateEscalation` 409 guard (lines 1294–1302), compute the key, `const hit = await analysisCache.get(key)`; if hit, `res.json(hit)` and return. On miss, run the existing `modelProvider.generateJson(...)`, then `await analysisCache.put(key, result, TTL)` (fire-and-forget, fail-open) before `res.json(result)`. **Crucially the escalation screen runs BEFORE the cache lookup**, so escalation cases are never cached and never served from cache. Same wiring for `/api/generate-plan`.
  - **Inject the cache** through `ApiDeps` (`api.ts` lines 28–38) like every other store; construct it in `createApp.ts` next to `createCounterStore(config)` (line ~69) and pass it into `createApiRouter(...)` (line ~125).
  - **TTL choice.** Today's Focus uses a calendar-day window; for analyses a **24h TTL** is reasonable (behavior logs change daily). Make it a config knob: `ANALYSIS_CACHE_TTL_MS` (default 86_400_000) — but keep cost neutral: caching SAVES model calls, so this is a cost-down mission.
  - **firestore.rules:** the `analysisCache` collection is written/read **only by the Admin SDK server-side** (like `aiQuota`), so client rules must NOT grant access — confirm `firestore.rules` has no client rule exposing `analysisCache` (default-deny covers it; add an explicit deny comment for auditability). This is a **SHARED file** — touch only to add a comment/explicit deny, do not loosen anything.
- **Files to CREATE:**
  - `app/src/server/analysisCache.ts` — `AnalysisCache` interface + `FirestoreAnalysisCache` + `MemoryAnalysisCache` + `createAnalysisCache(config)` (modeled on `quotaStore.ts`).
  - `app/src/server/analysisCache.test.ts` — unit tests (memory impl + key determinism + fail-open).
- **Files to MODIFY:**
  - `app/src/routes/api.ts` — **SHARED/high-traffic.** Add `analysisCache` to `ApiDeps` (lines 28–38); add cache check+store in `/api/analyze-behavior` (~lines 1289–1355, after the escalation guard) and `/api/generate-plan` (~lines 1050+, after its escalation guard).
  - `app/src/server/createApp.ts` — **SHARED.** Construct `const analysisCache = createAnalysisCache(config);` near line ~69 (next to `createCounterStore`) and add it to the `createApiRouter({...})` deps object (line ~125).
  - `app/src/config/env.ts` — **SHARED.** Add `analysisCacheTtlMs: number` to `ArborConfig` (near `maxOutputTokens` ~line 32) + parse `Number(process.env.ANALYSIS_CACHE_TTL_MS || 86_400_000)` (~line 116). Additive field; does not touch the prod invariant block (lines 137–158).
  - `firestore.rules` — **SHARED.** Add an explicit comment/deny that `analysisCache` is server-only (default-deny already blocks clients; this is for auditability/B2G review). Do NOT add any client access.
  - `cloudbuild.prod.yaml` — **SHARED infra.** Optional: append `@ANALYSIS_CACHE_TTL_MS=86400000` to the `^@^…` env string (line 49) if overriding the default. Skip if default is fine.
- **Interfaces/contracts:**
  - `interface AnalysisCache { get(key: string): Promise<unknown | null>; put(key: string, value: unknown, ttlMs: number): Promise<void>; }`
  - Firestore collection `analysisCache`, doc: `{ value: unknown, createdAt: Timestamp, expireAt: Timestamp }` with a Firestore **TTL policy on `expireAt`** (configured in console/gcloud, same as the planned `aiQuota.expireAt` TTL).
  - New env var: `ANALYSIS_CACHE_TTL_MS` (default 86_400_000).
  - Cache key: `sha256("analyze-behavior|"+uid+"|"+childId+"|"+stableStringify(input))` (Node `crypto`, no new dep).
- **Test plan:**
  - Unit (`analysisCache.test.ts`): `MemoryAnalysisCache` get-after-put returns value; expired entry returns null; key is stable for equal inputs and differs for different inputs; `get`/`put` swallow errors (fail-open) → return null / no-throw.
  - Integration: hit `/api/analyze-behavior` twice with identical body → second call returns the cached object and (assert) does NOT invoke `modelProvider.generateJson` (spy). Hit with an escalation-tripping body → 409 both times, NOTHING cached (assert `put` not called).
  - Live: deploy; POST identical analyze-behavior twice, confirm second is sub-100ms and token usage (via the existing usage telemetry / `recordUsage`) shows zero on the repeat. Verify Firestore TTL policy is active on `analysisCache.expireAt`.
  - Guard: `npm run lint && npm test && npm run build` green.
- **NL note:** GDPR/AVG — **storage limitation + erasure.** Cached analyses derived from a child's logs are personal data; the `expireAt` TTL is the storage-limitation control, and the cache MUST be swept on a GDPR erasure request. Add `analysisCache` to whatever account-deletion/erasure routine exists (or note it as a follow-up to the erasure mission). Keying by `uid`/`childId` makes targeted deletion possible. DPIA-relevant (children + profiling): record this cache in the processing inventory. B2G gate: insurers/municipalities will ask where derived data lives and how long.
- **IL note:** Israel PPL + Amendment 13 — the cached output is a "database" of personal data; it falls under the same accountability/retention duties as the source logs. Hebrew/RTL input must hash consistently (normalize Unicode, e.g. NFC, before hashing so visually-identical Hebrew strings don't produce cache misses). Erasure must also clear the cache for IL users.
- **Effort:** M
- **Severity:** Low
- **Dependencies:** none structurally, but **shares `env.ts`, `createApp.ts`, `api.ts`, `firestore.rules`, and `cloudbuild.prod.yaml`** with PERF-1/PERF-2 and the cost/erasure missions — sequence so edits to those shared files are merged, not overwritten. Reuses (does not modify) the `quotaStore.ts` Firestore pattern.
- **Rollback:** Feature-flag-free but cleanly removable: revert the `api.ts` cache check (analyses go live again), drop the cache construction in `createApp.ts`. The `analysisCache` collection self-expires via TTL. Reversible with no data loss to source logs.
- **Cost impact:** **Cost-DOWN** — every cache hit avoids a Vertex `analysis_structured` (Gemini 2.5 Flash) call. Firestore reads/writes for the cache are far cheaper than a model call. The only added cost is trivial Firestore storage (bounded by the `expireAt` TTL). No Redis, no new managed service.

---

## Cross-mission shared-file map (for the conflict-mapper)

| File | PERF-1 | PERF-2 | PERF-3 | PERF-4 |
|---|---|---|---|---|
| `cloudbuild.prod.yaml` (run-deploy args, lines 34–49) | add `--min-instances=1` | add `--concurrency`/`--cpu`/`--memory`/`--max-instances` | — | optional `@ANALYSIS_CACHE_TTL_MS` on env string (line 49) |
| `app/src/server/createApp.ts` | `/healthz` route + `warmup()` call (lines 59–99) | — | — | construct + inject `analysisCache` (lines 69, 125) |
| `app/src/ai/modelRouter.ts` | add `warmup()` (lines 101, 258, 358) | — | — | — |
| `app/src/routes/api.ts` | — | — | — | `ApiDeps` + cache wiring in analyze-behavior/generate-plan |
| `app/src/config/env.ts` | — | — | — | add `analysisCacheTtlMs` |
| `firestore.rules` | — | — | — | server-only `analysisCache` deny comment |
| `.github/workflows/arbor-ci.yml` | — | — | add `check:bundle` step + `client-perf` job | — |
| `app/package.json` (scripts/devDeps) | — | — | add `check:bundle` + `@lhci/cli` | — |

PERF-1 and PERF-2 both edit the `gcloud run deploy` args block in `cloudbuild.prod.yaml` — apply PERF-1 then PERF-2 to the same block. PERF-4 only appends to the env-var string (line 49), a different region of the same file.
