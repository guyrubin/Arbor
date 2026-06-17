# Spec B — Security (NIST CSF 2.0)

**Domain:** Security hardening for the Arbor platform (React 19/Vite client on Firebase Hosting + Express API on Cloud Run `europe-west4` + Firestore + Vertex AI).
**Date:** 2026-06-17
**Author:** Principal Engineer, Architecture Advisory.

## Context discovered from the real code (read before this spec was written)

The codebase is **considerably ahead of the headline backlog wording**. Several SEC missions are already partly or fully shipped; this spec re-grounds each mission against current behavior so an engineer builds the *delta*, not a duplicate.

- **CSP is already enabled and tuned** in `app/src/server/createApp.ts` (`cspDirectives()`, lines 30–51; applied at lines 82–85 — *enforce* mode, not `false`, in non-local envs). The mission comment in the file still references "SEC-2" but the code is SEC-1's work. The residual SEC-1 gap is **report-only rollout + a report sink**, and **AI-markdown sanitization** — which the client already gets *for free* because `MarkdownBlock.tsx` renders via React JSX (no `dangerouslySetInnerHTML` anywhere in `app/src` — grep returned zero hits).
- **The IP rate-limit + AI quota are already shared and atomic** via `FirestoreCounterStore` (`app/src/server/quotaStore.ts`) and `createAiQuota` (`app/src/server/aiQuota.ts`), and `app.set("trust proxy", 1)` is set (`createApp.ts:59`). The residual SEC-2 gap is the **express-rate-limit IP limiter is still per-instance in-memory** (`createApp.ts:99–108`) and there is **no global ceiling** — only per-key.
- **Redaction/tokenization already exists** (`app/src/server/redaction.ts` + `redactProfile()` in `routes/api.ts:41–42`) and is wired into every AI route. The residual SEC-3 gap is **stable pseudonym mapping (today the alias is a single fixed `[Child]` token, not a per-child stable pseudonym), profile-field minimization, and DPIA documentation of residual PII**.
- **WIF is already scaffolded** in `.github/workflows/arbor-deploy.yml` (lines 64–80, conditional on `vars.GCP_WIF_PROVIDER`). SEC-4 residual = **provision the GCP-side pool/provider, set the repo vars, delete `GCP_SA_KEY`, and least-privilege the deploy SA**.
- **A Firestore rules test file already exists** (`app/src/firestore.rules.test.ts`) but only covers read paths and is **skipped unless `FIRESTORE_EMULATOR_HOST` is set** — CI never runs it. SEC-5 residual = **create-ownership + field/type validation in `firestore.rules` + emulator-backed tests wired into CI**.
- **Firebase client SDK is present** (`firebase/app|auth|firestore|storage` imported in `app/src/lib/firebase.ts`); `firebase/app-check` is therefore available with no new dependency. The client fetch wrapper `app/src/lib/api.ts` (`authHeaders()`, lines 36–45) is the exact header seam for SEC-6.
- **`/api/chat` already does Zod re-validation** (`coachResponseZodSchema.parse()`, `routes/api.ts:289`). SEC-7 residual = **bring plan/story/hero/analyze/handoff to parity** (they currently trust the Gemini structured-output schema only — see `routes/api.ts:1073, 1148, 1233, 1314, 1382`).
- **No dependency/container/secret scanning exists** in `.github/workflows/arbor-ci.yml` (lint/test/framework/safety-eval/build only). SEC-8 is greenfield.
- **CMEK is not configured anywhere**; SEC-9 is an evaluation gated on a B2G contract.

Two launch markets are treated as first-class throughout: **Netherlands (NL)** — GDPR + Dutch AVG/AP, DPIA mandatory (children + profiling), B2G via municipalities/JGZ-consultatiebureau/schools/insurers; **Israel (IL)** — Privacy Protection Law + Amendment 13 (in force Aug 2025), Hebrew/RTL already partly shipped.

---

### SEC-1 — Re-enable a tuned CSP via report-only → enforce, and guarantee AI-output is injection-safe

- **Objective / done-when:**
  - A `Content-Security-Policy-Report-Only` header ships first (one release), with a violation sink collecting reports for ≥1 week; then the enforcing `Content-Security-Policy` is switched on with zero console violations on the three primary flows (auth, coach chat with streamed markdown, avatar/image generation).
  - The enforced directive set explicitly constrains `script-src`, `style-src`, `connect-src`, `img-src`, and `frame-ancestors`.
  - AI-generated text is proven non-executable: a test asserts that a coach/story payload containing `<img onerror>` / `<script>` / `javascript:` renders as inert text, never as DOM.
  - `tsc`, `vitest`, and `vite build` stay green.
- **Approach (grounded in real code):**
  - CSP is **already enforced** in `app/src/server/createApp.ts:82–85` using `cspDirectives()` (lines 30–51). The directive set is already tuned: `scriptSrc ['self','https://apis.google.com']`, `frameAncestors ['self']`, `connectSrc` enumerating identitytoolkit/securetoken/googleapis/firestore/generativelanguage (HTTPS+WSS). The remaining work is a **safe rollout switch**, not a rewrite.
  - Add a `cspReportOnly: boolean` to `ArborConfig` (env `CSP_REPORT_ONLY`, default `true` for the first prod release, then flip to `false`). In `createApp.ts`, pass `reportOnly` through to `helmet.contentSecurityPolicy` and append a `report-uri`/`report-to` directive pointing at a new lightweight `/api/csp-report` route (or an external collector). Helmet supports `reportOnly: true`.
  - Add a `report-to`/`report-uri` directive and a new **`POST /api/csp-report`** handler (mounted *before* the auth chain, since the browser sends these unauthenticated) that logs via the existing `logger` (`app/src/server/logger.ts`) at `warn`, rate-limited to avoid log floods. This is additive and reversible.
  - **AI-markdown sanitization:** confirmed safe-by-construction. `app/src/components/ui/MarkdownBlock.tsx` (and `TypewriterMarkdown.tsx`, `CoachAnswerCards.tsx`) build React elements (`<strong>`, `<h3>`, `<li>`, `<p>`) from `parseInline()`/`renderMarkdown()` — no `dangerouslySetInnerHTML` exists in `app/src`. The only residual injection surface is **`style={{ color: 'var(--arbor-...)' }}`** (static, safe) and **image `data:`/`blob:` URLs** from generation routes (already constrained by `imgSrc` in CSP). Action: add a regression test that locks this property in, plus a one-line guard in `parseInline` that strips any raw `<`/`>` from inline segments as defense-in-depth (cheap, additive). Do **not** introduce DOMPurify — there is no HTML render path, so it would be dead weight.
- **Files to CREATE:**
  - `app/src/server/cspReport.ts` — `createCspReportRouter()` (parses `application/csp-report` + `application/reports+json`, logs throttled).
  - `app/src/components/ui/MarkdownBlock.test.ts` — asserts `<script>`/`onerror`/`javascript:` in AI text never produce executable nodes.
- **Files to MODIFY:**
  - `app/src/config/env.ts` **(SHARED)** — add `cspReportOnly` field + `CSP_REPORT_ONLY` parse (insert into the `config` object literal near line 115; no change to the prod-invariant block lines 137–150).
  - `app/src/server/createApp.ts` **(SHARED, high-traffic)** — lines 82–85 (helmet block): thread `reportOnly` + `report-uri`; mount `createCspReportRouter()` near the billing-webhook mount (line 98), **before** the `/api` auth chain.
  - `cloudbuild.prod.yaml` **(SHARED)** — line 49 env string: add `@CSP_REPORT_ONLY=true` for the first release, flip to `false` in the follow-up.
  - `app/src/components/ui/MarkdownBlock.tsx` — harden `parseInline` (strip raw angle brackets in text segments).
- **Interfaces/contracts:** new env `CSP_REPORT_ONLY` (bool); new route `POST /api/csp-report`; `cspDirectives()` gains `reportUri`. No change to the wire contract of any AI route.
- **Test plan:** unit test for the new markdown hardening + CSP-report router; integration: boot app with `ARBOR_ENV=prod`-like config, assert the response carries `Content-Security-Policy-Report-Only` when the flag is on and `Content-Security-Policy` when off; manual: open prod with DevTools console, exercise auth + chat-stream + avatar-gen, confirm zero CSP violations before flipping to enforce.
- **NL note:** CSP/anti-XSS is a baseline AVG "appropriate technical measure" (Art. 32) — record it in the DPIA's security-measures section as a B2G readiness item (municipalities/insurers expect a documented CSP).
- **IL note:** the coach renders **Hebrew/RTL** markdown; the `parseInline` angle-bracket guard and the test fixtures must include a Hebrew + RTL payload so hardening does not corrupt `dir="auto"` rendering (`MarkdownBlock.tsx:66`).
- **Effort:** S. **Severity:** High. **Dependencies:** none. **Rollback:** revert env flag (`CSP_REPORT_ONLY=true`) instantly disarms enforcement; routes are additive. **Cost impact:** ~zero (a few log lines; no new managed service if reports go to existing logging).

---

### SEC-2 — Shared, atomic IP rate-limit + per-user AND global AI ceilings

- **Objective / done-when:**
  - The IP rate-limit is no longer bypassable by Cloud Run scale-out: the limiter keys are backed by the shared `UsageCounterStore` (Firestore in prod), so the cap holds across instances.
  - The AI quota enforces **both** a per-user/IP ceiling (exists today) **and** a new platform-wide global ceiling per window (cost circuit-breaker).
  - `trust proxy` remains correctly scoped to one hop (already true).
  - Caps verified by an integration test that simulates two "instances" sharing one store.
- **Approach (grounded in real code):**
  - **Already done:** `app/src/server/quotaStore.ts` provides `FirestoreCounterStore` (atomic `FieldValue.increment`, fixed-window doc per key, TTL `expireAt`, fail-open). `createAiQuota` (`aiQuota.ts`) keys on `req.user.uid || req.ip` against that store. `app.set("trust proxy", 1)` is at `createApp.ts:59`. **Do not rebuild these.**
  - **Gap 1 — the IP limiter is still in-memory.** `createApp.ts:99–108` uses `express-rate-limit` with its default in-memory store, so 30 req/min is enforced *per instance*. Replace its store with a thin adapter over the existing `UsageCounterStore` (implement express-rate-limit's `Store` interface: `increment`, `decrement`, `resetKey`) so the IP limit is also shared/atomic. This rides entirely on the **already-deployed** Firestore counters — **no Redis required**.
  - **Gap 2 — no global ceiling.** Extend `createAiQuota` (or add a sibling middleware) to also `increment("ai_hourly_global", "ALL", WINDOW_MS)` and 429 when a configurable `AI_GLOBAL_HOURLY_LIMIT` is exceeded. This is the cost circuit-breaker that protects against a credential-leak fan-out or a viral spike. Keep fail-open semantics (availability over enforcement) consistent with the store's existing behavior.
  - **Cheaper-alternative note:** Redis (Memorystore) would be lower-latency but adds ~€35+/mo recurring + VPC connector cost. Firestore counters are already provisioned and atomic; **stay on Firestore** until measured contention (>1 write/sec on a single window doc) justifies Redis. Document this as the deferred upgrade path.
- **Files to CREATE:**
  - `app/src/server/rateLimitStore.ts` — `createCounterRateLimitStore(counters)` adapting `UsageCounterStore` to express-rate-limit's `Store`.
  - `app/src/server/rateLimitStore.test.ts`, and extend `app/src/server/aiQuota` coverage for the global ceiling.
- **Files to MODIFY:**
  - `app/src/server/createApp.ts` **(SHARED, high-traffic)** — lines 99–108: pass `store: createCounterRateLimitStore(counters)` to `rateLimit(...)`. Note `counters` is already constructed at line 70.
  - `app/src/server/aiQuota.ts` **(SHARED)** — add the global-ceiling increment + 429; read `AI_GLOBAL_HOURLY_LIMIT` (mirrors the existing `AI_USER_HOURLY_LIMIT` pattern at line 12).
  - `cloudbuild.prod.yaml` **(SHARED)** — line 49: add `@AI_GLOBAL_HOURLY_LIMIT=<n>` (tune to budget).
- **Interfaces/contracts:** new env `AI_GLOBAL_HOURLY_LIMIT`; `UsageCounterStore` (unchanged interface) now also backs IP limiting; response headers `X-AI-Quota-*` unchanged, optionally add `X-AI-Global-Remaining`.
- **Test plan:** unit: the rate-limit store adapter round-trips increments; integration: instantiate two `createApp` instances sharing one `MemoryCounterStore` (the test double for Firestore) and assert the 31st request across both is 429'd; assert global ceiling 429s independently of per-user. `tsc`+tests+build green.
- **NL note:** rate-limiting/abuse-prevention is an Art. 32 measure; the global ceiling also caps the **profiling volume** on children's data, which the DPIA should cite. B2G insurers/municipalities will ask for documented abuse controls.
- **IL note:** Amendment 13 raises enforcement/accountability — a documented, enforced ceiling supports the "reasonable security measures" bar; no RTL/Hebrew specifics (server-side).
- **Effort:** M. **Severity:** High. **Dependencies:** none (rides existing store). **Rollback:** revert `createApp` store wiring to default (in-memory) and remove global increment — both isolated edits. **Cost impact:** negligible incremental Firestore writes (one extra global counter doc per window). Explicitly avoids Redis recurring cost.

---

### SEC-3 — Stable per-child pseudonym tokenization + profile-field minimization + DPIA residual-PII record

- **Objective / done-when:**
  - The child's name is mapped to a **stable pseudonym** before prompt assembly (so multi-child and council/multi-agent prompts stay coherent), restored losslessly on output — generalizing today's single fixed `[Child]` token.
  - Only the minimum profile fields needed for coaching are sent to Vertex; high-sensitivity/free-text fields are dropped or generalized before `JSON.stringify(childProfile)` reaches a prompt.
  - The residual PII that *does* leave the trust boundary is enumerated in the DPIA.
  - All existing redaction tests stay green and new tests prove name/field minimization.
- **Approach (grounded in real code):**
  - **Already done:** `app/src/server/redaction.ts` (`createRedaction`, `redact`/`restore`/`restoreDeep`/`createStreamRestorer`) plus `redactProfile()` (`routes/api.ts:41–42`) round-trip the profile JSON through the redactor before every model call. Email/phone regex scrubbing exists. The single alias is `CHILD_ALIAS = "[Child]"` (`redaction.ts:14`).
  - **Gap 1 — single alias, not a stable pseudonym.** Generalize `createRedaction` to accept an optional list of named entities (child + siblings/co-parent if present) and assign each a **stable token** (`[Child]`, `[Sibling1]`, …) so prompts that mention more than one person (council synthesis, handoff briefs) restore unambiguously. Keep `[Child]` as the default for the single-name case (backward compatible; existing tests unaffected).
  - **Gap 2 — field minimization.** Today the *entire* `childProfile` object is serialized into prompts (`routes/api.ts:255, 400, 1068, 1309, 1376`, etc.) after name redaction, but other fields (exact `name` already aliased, but `age`, `domains`, `strengths`, `challenges`, free-text notes) flow verbatim. Add a `minimizeProfileForPrompt(profile)` helper that **allowlists** only the coaching-relevant fields (e.g. `ageBand`/`age`, `domains`, generalized strengths/challenges) and drops/truncates raw free-text and any direct identifiers, *before* `redact()`. Apply it at each prompt-assembly site (or centralize via a small wrapper). This reduces residual PII without changing the product's output quality.
  - **Gap 3 — DPIA record.** Document the *post-minimization, post-redaction* residual that still reaches Vertex (generalized developmental signals, no direct identifiers) in `docs/architecture/security-privacy.md` and the DPIA, so the data-flow is auditable.
  - This is **additive and reversible** — the minimizer can be feature-flagged (`PROMPT_FIELD_MINIMIZATION`, default on in prod) to allow A/B of answer quality.
- **Files to CREATE:**
  - `app/src/server/profileMinimize.ts` — `minimizeProfileForPrompt()` + allowlist; `profileMinimize.test.ts`.
- **Files to MODIFY:**
  - `app/src/server/redaction.ts` **(SHARED across all AI routes)** — generalize `createRedaction` to multi-entity stable tokens; keep `CHILD_ALIAS`/`REDACTION_DIRECTIVE` for the single case.
  - `app/src/routes/api.ts` **(SHARED, very high-traffic — 15+ AI routes)** — wrap each `JSON.stringify(childProfile)` prompt-site through `minimizeProfileForPrompt()` before `privacy.redact(...)`. Lines to touch: 255, 400, 475, 557, 641/648, 1068, 1144, 1232/1309, 1376, 1495. Sequence this carefully with any other mission editing `api.ts` (SEC-7 also edits this file).
  - `docs/architecture/security-privacy.md` + DPIA doc — residual-PII table.
  - `app/src/config/env.ts` **(SHARED)** — optional `PROMPT_FIELD_MINIMIZATION` flag.
- **Interfaces/contracts:** `createRedaction(names: string | string[] | null)`; new `minimizeProfileForPrompt(profile, opts)`; env `PROMPT_FIELD_MINIMIZATION`. `REDACTION_DIRECTIVE` extended if multiple aliases are introduced (must instruct the model to keep each token verbatim).
- **Test plan:** unit: multi-name redact/restore round-trip (incl. RTL); minimizer drops disallowed fields; integration: snapshot a coach prompt and assert no raw name / no disallowed field present; all existing `redaction.test.ts` green. `tsc`+tests+build green.
- **NL note:** **data minimization (GDPR Art. 5(1)(c)) is directly served here** — this is the strongest single DPIA line item for the NL launch (children + profiling makes the DPIA mandatory). Record the residual-PII table and the "name never leaves the boundary" guarantee explicitly; B2G (JGZ, insurers) will scrutinize cross-border AI processing even though residency is EU.
- **IL note:** the redactor's name regex and stable tokens **must handle Hebrew names and code-switching** (Hebrew name in an English sentence and vice-versa). Add Hebrew name fixtures; ensure `escapeRegExp` + `\b` word-boundary logic (`redaction.ts:43`) works for Hebrew (note: JS `\b` is ASCII-oriented — verify and, if needed, switch to a Unicode-aware boundary for Hebrew names).
- **Effort:** M. **Severity:** High. **Dependencies:** none, but **edit-sequence with SEC-7** (both touch `routes/api.ts`). **Rollback:** flag off (`PROMPT_FIELD_MINIMIZATION=false`) reverts to current redact-only behavior; multi-entity redactor is backward compatible. **Cost impact:** zero recurring (smaller prompts marginally *reduce* token cost).

---

### SEC-4 — Replace `GCP_SA_KEY` with Workload Identity Federation; least-privilege the deploy SA

- **Objective / done-when:**
  - The deploy workflow authenticates to GCP **keyless** via WIF on every run; the long-lived `GCP_SA_KEY` secret is deleted from the repo and the JSON key is deleted in IAM.
  - The deploy service account holds only the roles it needs (no `Owner`/broad roles).
  - A deploy from `main` succeeds end-to-end under WIF.
- **Approach (grounded in real code):**
  - **Already scaffolded:** `.github/workflows/arbor-deploy.yml:64–80` already has the conditional WIF path (`vars.GCP_WIF_PROVIDER != ''` → `google-github-actions/auth@v2` with `workload_identity_provider` + `service_account`) and the key fallback, plus `permissions: id-token: write` (line 39) and the `credentials_file_path` plumbing (line 109). **No workflow code change is required to switch on WIF** — only GCP-side provisioning + repo vars + secret deletion.
  - GCP-side (one-time, via gcloud/console, documented in `docs/ops/wif-migration.md` referenced at line 6):
    1. Create a Workload Identity **Pool** + **Provider** for GitHub OIDC (`token.actions.githubusercontent.com`), attribute-mapped to `repository`/`ref`, with an **attribute condition restricting to this repo** (and ideally `ref == refs/heads/main` for the deploy job).
    2. Create/confirm the deploy SA `arbor-deployer@<project>.iam.gserviceaccount.com` and grant the WIF principal `roles/iam.workloadIdentityUser` on it, scoped to the repo attribute.
    3. Grant the SA **least-privilege** roles only: `roles/cloudbuild.builds.editor`, `roles/run.admin`, `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser` (to actAs the Cloud Run runtime SA), `roles/firebasehosting.admin` (or the narrower hosting deployer), and `roles/datastore.user` / Firebase rules-release role for the `firestore` deploy. **Remove** `Datastore Owner`/`Firebase Admin` breadth where `*.user`/release-scoped roles suffice (the current doc block lines 11–13 over-grants).
    4. Set repo **Variables** `GCP_WIF_PROVIDER` + `GCP_DEPLOY_SA`; then **delete** the `GCP_SA_KEY` secret and the IAM key.
  - Update the doc comment to drop the over-broad role list once least-privilege is confirmed.
- **Files to CREATE:**
  - `docs/ops/wif-migration.md` if not already present (referenced but verify) — the runbook + exact gcloud commands + the least-privilege role matrix.
- **Files to MODIFY:**
  - `.github/workflows/arbor-deploy.yml` **(SHARED, CI)** — comment-only cleanup (lines 5–13, 72–74) once WIF is live; the executable steps already support both paths. Optionally remove the `auth-key` fallback step (lines 75–79) **after** WIF is verified, to eliminate the key path entirely.
- **Interfaces/contracts:** repo vars `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`; GCP WIF pool/provider; deploy SA role bindings. No app code touched.
- **Test plan:** trigger `workflow_dispatch` on `arbor-deploy.yml` with the vars set and `GCP_SA_KEY` removed; assert auth-wif step runs and Cloud Run + Hosting + Firestore deploy succeed. Verify in Cloud Audit Logs that the build ran as the deploy SA. App `tsc`/tests/build are unaffected.
- **NL note:** keyless CI + least-privilege is an Art. 32 control and a concrete answer to a B2G procurement security questionnaire (municipalities/insurers routinely require "no long-lived cloud keys").
- **IL note:** supports Amendment 13's accountability/"reasonable security" expectations for the database operator; no market-specific UI.
- **Effort:** S. **Severity:** High. **Dependencies:** none. **Rollback:** unset the repo vars → the workflow automatically falls back to the key path (keep the key until WIF is proven, then delete). **Cost impact:** zero (WIF is free; removes a standing credential-theft liability).

---

### SEC-5 — Firestore rules: validate familyId ownership + field/type validation on create, with emulator-backed rules tests in CI

- **Objective / done-when:**
  - `create` on `children/{childId}` and `families/{familyId}` is allowed **only** when the caller is establishing ownership they legitimately hold (familyId membership / self), and the document passes field+type validation (required keys present, correct types, no unexpected fields).
  - `@firebase/rules-unit-testing` tests cover allow+deny for create-ownership and field validation, and **run in CI** against the Firestore emulator.
  - All existing rules tests stay green.
- **Approach (grounded in real code):**
  - Current `firestore.rules`: `children/{childId}` `allow create: if signedIn();` (line 40) and `families/{familyId}` `allow create: if signedIn();` (line 31) — **any signed-in user can create any child/family doc with arbitrary fields**, including a `familyId` they are not a member of. The `users/{userId}` subtree is correctly self-scoped (lines 22–27); the gap is the top-level `children`/`families` collections.
  - Tighten `create` rules:
    - `families/{familyId}` create: require `request.resource.data` to contain a typed `familyId == familyId`, and that the creator immediately becomes a member (or pair the create with the `members/{uid}` write the app already does in `onboarding/family-child`). Add field allowlist via `request.resource.data.keys().hasOnly([...])` + per-field `is string`/`is int` checks.
    - `children/{childId}` create: require `request.resource.data.familyId is string` **and** `isFamilyMember(request.resource.data.familyId)` so a child can only be created under a family the caller belongs to. Add field/type validation (`childId`, `familyId`, optional typed fields).
  - **Verify against the real write path:** `routes/api.ts` `POST /onboarding/family-child` (lines 177–194) and `memoryStore.ensureFamilyChild` use the **Admin SDK** (bypasses rules), so server-side onboarding is unaffected by tighter rules. The rules guard the **client SDK** direct writes (`app/src/lib/firebase.ts` Firestore). Confirm the client onboarding flow writes the membership doc before/with the family/child doc, or move first-create to the server route (preferred — it already exists).
  - Wire the **existing** `app/src/firestore.rules.test.ts` into CI: it currently self-skips unless `FIRESTORE_EMULATOR_HOST` is set (line 7). Add a CI step that boots the Firestore emulator (`firebase-tools`) and runs `vitest` with that env set. Extend the test to cover create-ownership + field validation (the file today only tests read allow/deny).
- **Files to CREATE:**
  - `app/scripts/test-rules.mjs` (or a `package.json` script) — start emulator, set `FIRESTORE_EMULATOR_HOST`, run the rules vitest, tear down.
- **Files to MODIFY:**
  - `firestore.rules` **(SHARED)** — lines 29–45: add `request.resource.data` ownership + field/type validation to `families` and `children` `create`. Leave `users/**`, `aiRuns`, `safetyReviews`, `organizations` rules untouched.
  - `app/src/firestore.rules.test.ts` — add create allow/deny + bad-field-rejection cases (NL+IL/Hebrew familyId values).
  - `.github/workflows/arbor-ci.yml` **(SHARED, CI)** — add an emulator-backed `npm run test:rules` step after `npm test` (line 24).
  - `app/package.json` **(SHARED)** — add `test:rules` script. (`@firebase/rules-unit-testing@5` already a devDep; `firebase` client SDK already present.)
- **Interfaces/contracts:** `firestore.rules` create predicates + field allowlists; new `test:rules` script; CI job step. No runtime app code.
- **Test plan:** emulator rules tests: non-member cannot create a child under a family they don't belong to (deny); member can (allow); create with an extra/wrong-typed field is rejected; existing read tests still pass. Run locally via the new script and in CI.
- **NL note:** ownership + minimization at the data layer is a core DPIA control for children's data; B2G (schools/JGZ) will require evidence that one family cannot access another's child records — these tests are that evidence.
- **IL note:** include Hebrew-character `familyId`/name fixtures to ensure rules string predicates don't misbehave on non-ASCII; supports Amendment 13's data-segregation/accountability expectations.
- **Effort:** M. **Severity:** Med. **Dependencies:** none (but coordinate with anyone changing the client onboarding write path). **Rollback:** revert `firestore.rules` (rules deploy is independently revertible via `firebase deploy --only firestore:rules`); CI step is additive. **Cost impact:** zero runtime; CI minutes for the emulator (~1 min/run).

---

### SEC-6 — Enable Firebase App Check (client attestation) on the API + Firestore

- **Objective / done-when:**
  - The client obtains an App Check token (reCAPTCHA Enterprise on web; DeviceCheck/Play Integrity on the Capacitor iOS/Android shells) and sends it on every API call.
  - The Express API **verifies** the App Check token (Admin SDK `appCheck().verifyToken`) and Firestore **enforces** App Check, rejecting un-attested traffic.
  - Rollout is **monitor-first** (App Check "unenforced/metrics" mode) for ≥1 week before enforcement, so legitimate clients are not locked out.
- **Approach (grounded in real code):**
  - Client init is centralized in `app/src/lib/firebase.ts` — add `initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true })` right after `initializeApp` (line 54), guarded so local sandbox (no Firebase) is unaffected. `firebase/app-check` ships with the already-present `firebase` SDK — **no new dependency**.
  - Attach the token to outgoing requests at the **single existing seam**: `app/src/lib/api.ts` `authHeaders()` (lines 36–45) — call `getToken(appCheck)` and set the `X-Firebase-AppCheck` header alongside the existing `Authorization` bearer. SSE/`fetch` and `request()` (line 47) all funnel through `authHeaders`, so one edit covers every route.
  - Server verification: add an **App Check middleware** mounted on `/api` in `createApp.ts` (after CORS, ideally before/around the auth middleware at line 112), reading `X-Firebase-AppCheck` and calling `getAppCheck().verifyToken(token)` via the Admin SDK (already initialized in `authMiddleware.ts`). Gate enforcement behind `REQUIRE_APP_CHECK` (default `false` → metrics-only, log-and-pass; `true` → 401 on missing/invalid) so rollout is safe and reversible — mirrors the existing `REQUIRE_AUTH` pattern (`authMiddleware.ts:11`).
  - Firestore enforcement: enable App Check in the Firebase console for Firestore (metrics → enforce). No rules change needed.
  - Capacitor: the iOS/Android shells (deps `@capacitor/ios|android`) need the native App Check providers (DeviceCheck/App Attest, Play Integrity) configured; web uses reCAPTCHA Enterprise. Document the per-platform provider in the mobile setup doc.
- **Files to CREATE:**
  - `app/src/server/appCheckMiddleware.ts` — `createAppCheckMiddleware(config)` (metrics-only vs enforce).
  - `app/src/server/appCheckMiddleware.test.ts`.
- **Files to MODIFY:**
  - `app/src/lib/firebase.ts` — init App Check after `initializeApp` (guarded by `firebaseEnabled`).
  - `app/src/lib/api.ts` **(SHARED seam — every API call)** — `authHeaders()` adds `X-Firebase-AppCheck`.
  - `app/src/server/createApp.ts` **(SHARED, high-traffic)** — mount `createAppCheckMiddleware` on `/api` near line 112.
  - `app/src/config/env.ts` **(SHARED)** — add `requireAppCheck` (`REQUIRE_APP_CHECK`).
  - `cloudbuild.prod.yaml` **(SHARED)** — line 49: add `@REQUIRE_APP_CHECK=false` (flip to `true` after metrics window).
  - `.github/workflows/arbor-deploy.yml` — add `VITE_FIREBASE_APPCHECK_SITE_KEY` to the client build env (lines 95–101).
  - `app/MOBILE.md` (or the Capacitor setup doc) — native provider config.
- **Interfaces/contracts:** env `REQUIRE_APP_CHECK`, build env `VITE_FIREBASE_APPCHECK_SITE_KEY`; header `X-Firebase-AppCheck`; Admin `appCheck().verifyToken`.
- **Test plan:** unit: middleware passes in metrics mode regardless; 401s on missing token when enforcing. Manual: deploy with metrics-only, watch App Check metrics in console for legit traffic %, then enforce. Verify Capacitor builds still attest. `tsc`+tests+build green.
- **NL note:** App Check is a named **B2G-readiness gate** (the brief lists it among the bars municipalities/JGZ/insurers raise) — it materially reduces scraping/abuse of children's-data endpoints. Document in DPIA security measures.
- **IL note:** same attestation applies to the Hebrew/RTL web app and IL App Store/Play builds; no UX change. Ensure reCAPTCHA Enterprise challenge (rare) is RTL-tolerant.
- **Effort:** S. **Severity:** Med. **Dependencies:** soft on SEC-4 (keyless deploy preferred before adding build secrets, but not blocking). **Rollback:** `REQUIRE_APP_CHECK=false` + Firestore "unenforce" instantly revert to metrics-only; client init is guarded. **Cost impact:** reCAPTCHA Enterprise has a free monthly assessment tier; beyond it, low per-assessment cost. App Check token verification is free. Flag the reCAPTCHA tier as the only potential recurring cost.

---

### SEC-7 — Zod re-validation parity on plan/story/hero/analyze/handoff (match `/api/chat`)

- **Objective / done-when:**
  - Each of `/api/generate-plan`, `/api/generate-story`, `/api/generate-hero-journey`, `/api/analyze-behavior`, `/api/generate-handoff` parses the model output through a Zod schema (parity with `/api/chat`), and **rejects or repairs** on failure instead of returning unvalidated model JSON to the client.
  - A malformed/partial model response yields a controlled 502/repaired payload, never a runtime crash or a contract-violating body.
  - `tsc`+tests stay green.
- **Approach (grounded in real code):**
  - `/api/chat` already does this: `coachResponseZodSchema.parse(parseJson(rawResponse.trim()))` (`routes/api.ts:289`) after `restoreDeep`. The five listed routes only pass a **Gemini structured-output `schema`** to `modelProvider.generateJson(...)` and return `privacy.restoreDeep(response)` **without** a Zod parse (see lines 1073–1119 plan, 1148–1163 story, 1233–1276 hero, 1314–1350 analyze, 1382–1399 handoff). Vertex/Gemini structured output is best-effort, not a guarantee — the missing Zod layer is the real gap.
  - Define Zod schemas mirroring each route's existing Gemini schema (the shapes are already fully specified inline in `api.ts`). Co-locate them with the relevant contract module (e.g. extend `app/src/contracts/` like `coach.ts` does) so client `types.ts` and server stay in sync.
  - At each route, after `generateJson`, run `schema.safeParse(restored)`:
    - on success → return parsed data;
    - on failure → attempt a light **repair** (e.g. coerce missing arrays to `[]`, clamp enums) then re-parse; if still failing, return `502 { error: "...", details }` and `logger.warn` with `requestId` (consistent with existing error handling).
  - This is purely additive at the model-output seam; no prompt or client change.
  - **Edit-sequence with SEC-3** (also edits `routes/api.ts`) — apply SEC-3's prompt-input minimization and SEC-7's output-validation in one coordinated pass per route to avoid clobbering.
- **Files to CREATE:**
  - `app/src/contracts/plan.ts`, `story.ts`, `heroJourney.ts`, `analysis.ts`, `handoff.ts` (Zod schemas + inferred types), or a single `app/src/contracts/structuredOutputs.ts`. Plus `*.test.ts` parse/repair cases.
- **Files to MODIFY:**
  - `app/src/routes/api.ts` **(SHARED, very high-traffic)** — wrap the five `generateJson` results in `safeParse`+repair: lines 1073–1120 (plan), 1148–1163 (story), 1233–1276 (hero), 1314–1350 (analyze), 1382–1399 (handoff).
  - `app/src/types.ts` (optional) — re-export inferred Zod types to keep client types aligned.
- **Interfaces/contracts:** new Zod schemas (server-authoritative); route responses unchanged on the happy path, controlled 502 on validation failure. No env/infra change.
- **Test plan:** unit: each schema accepts a known-good payload, repairs a recoverable one, rejects an irreparable one; integration: stub `modelProvider.generateJson` to return malformed JSON and assert a 502 (not a 500/crash). `tsc`+tests+build green.
- **NL note:** output validation reduces the chance a malformed/hallucinated brief reaches a professional handoff (school/JGZ) — relevant to the non-diagnostic + accuracy posture the DPIA/AP would expect for child profiling outputs.
- **IL note:** schemas must accept **Hebrew string values** (they already would — strings are unicode); add a Hebrew-payload test for `/api/generate-hero-journey` and `/api/generate-handoff` given RTL is shipped.
- **Effort:** S. **Severity:** Med. **Dependencies:** **edit-sequence with SEC-3** (shared `api.ts`). **Rollback:** the `safeParse` wrappers are per-route and independently revertible. **Cost impact:** zero.

---

### SEC-8 — Supply-chain scanning in CI: Dependabot/Snyk + Trivy image scan + SBOM + secret scanning

- **Objective / done-when:**
  - Dependency vulnerabilities are surfaced automatically (Dependabot alerts/PRs and/or `npm audit`/Snyk gate in CI).
  - The Cloud Run container image is scanned (Trivy) in CI and an SBOM is produced and retained as a build artifact.
  - Repository **secret scanning + push protection** is enabled.
  - The new gates run in `arbor-ci.yml` without breaking the existing pipeline.
- **Approach (grounded in real code):**
  - `.github/workflows/arbor-ci.yml` currently runs only `npm ci → lint → test → check:framework → eval:safety → build` (lines 22–27). Add, additively:
    - `.github/dependabot.yml` for the `app/` npm ecosystem (weekly) + GitHub Actions ecosystem.
    - A CI job (or steps) running `npm audit --audit-level=high` (non-blocking first, then blocking) — Snyk optional if a token is available; prefer the free `npm audit` + Dependabot to avoid a paid dependency.
    - **Trivy** image + filesystem scan: build the image (the repo already builds via `app/Dockerfile` referenced in `cloudbuild.prod.yaml:24`) and run `aquasecurity/trivy-action` against it; fail on HIGH/CRITICAL (start non-blocking).
    - **SBOM**: generate with `anchore/sbom-action` (Syft) or `trivy --format cyclonedx`, upload as a workflow artifact.
    - Enable **GitHub secret scanning + push protection** (repo setting; document it) — and add a CI secret scan (e.g. `gitleaks`) as belt-and-suspenders.
  - Keep these on a **separate CI job** so a scan finding doesn't block the core quality gates until the team opts to make them blocking — gradual hardening.
- **Files to CREATE:**
  - `.github/dependabot.yml`.
  - `.github/workflows/arbor-security-scan.yml` (or extend `arbor-ci.yml`) — `npm audit`, Trivy, SBOM upload, gitleaks.
- **Files to MODIFY:**
  - `.github/workflows/arbor-ci.yml` **(SHARED, CI)** — optionally add a `security` job alongside `app-quality-gates` (lines 9–27). Keep edits additive.
- **Interfaces/contracts:** new workflow/jobs; optional `SNYK_TOKEN` secret if Snyk is used; repo settings (secret scanning, push protection).
- **Test plan:** open a PR and confirm the scan job runs, Trivy reports, SBOM artifact appears, `npm audit` runs; confirm Dependabot opens its first PR. Existing `app-quality-gates` job unaffected.
- **NL note:** documented supply-chain/vuln-management is a standard B2G procurement requirement (municipalities/insurers) and an Art. 32 measure; SBOM is increasingly requested in EU public-sector tenders.
- **IL note:** supports Amendment 13's "reasonable security measures"/accountability; no market UI specifics.
- **Effort:** S. **Severity:** Med. **Dependencies:** none. **Rollback:** delete/disable the scan workflow; gates are non-blocking until promoted. **Cost impact:** zero with the free stack (Dependabot, `npm audit`, Trivy, Syft, gitleaks are free in GitHub Actions); Snyk optional/paid — recommend deferring Snyk and using the free stack.

---

### SEC-9 — Evaluate CMEK for Firestore/Storage when an institutional (B2G) contract requires it

- **Objective / done-when:**
  - A decision record exists stating whether CMEK is adopted, the trigger (a signed/likely B2G contract clause requiring customer-managed keys), the cost, and the operational impact (key rotation, availability dependency on Cloud KMS).
  - If adopted: a Cloud KMS key ring + key in `europe-west4`, and the Firestore database + Storage bucket configured for CMEK, with the runtime/deploy SAs granted `roles/cloudkms.cryptoKeyEncrypterDecrypter`.
  - If deferred: the assessment is recorded so it can be activated on contract signature without re-discovery.
- **Approach (grounded in real code):**
  - Today there is **no CMEK** anywhere; data is encrypted with Google-managed keys (the default, already compliant with GDPR/AVG and Israeli law for the consumer launch). CMEK is **not required** for the NL/IL *consumer* launch and adds recurring KMS cost + an availability dependency (a KMS outage or a destroyed key can make data unreadable). Therefore: **do not adopt now** — produce the evaluation + a ready-to-execute runbook gated on a B2G trigger.
  - **Important Firestore constraint:** CMEK for Firestore must be chosen **at database creation** — an existing default database cannot be converted in place. The runbook must therefore plan a **new CMEK-enabled Firestore database** (`firestoreDatabaseId` is already configurable via `FIRESTORE_DATABASE_ID`, default `(default)` — see `env.ts:111`) and a data migration, *or* provision the B2G tenant on its own CMEK database from the start. Storage CMEK can be applied per-bucket. Capture this so the trigger doesn't surprise the team mid-contract.
  - When triggered: create KMS key ring/key in `europe-west4` (co-region with data residency), grant the Firestore/Storage service agents the KMS encrypter/decrypter role, provision the CMEK database, wire `FIRESTORE_DATABASE_ID` in `cloudbuild.prod.yaml`, and migrate/backfill.
- **Files to CREATE:**
  - `docs/architecture/migration-2026-06-17/cmek-evaluation.md` — the ADR-style evaluation + trigger + cost + KMS region + the Firestore-create-time constraint + activation runbook.
- **Files to MODIFY:** none now. (On activation: `cloudbuild.prod.yaml` `FIRESTORE_DATABASE_ID`, and IAM/KMS config — out of scope until triggered.)
- **Interfaces/contracts:** (on activation) Cloud KMS key ring/key in `europe-west4`; Firestore CMEK database; Storage bucket CMEK; SA KMS role bindings; `FIRESTORE_DATABASE_ID` env.
- **Test plan:** none runtime now (doc deliverable). On activation: validate reads/writes against the CMEK database in a staging project and confirm a key-disable makes data inaccessible (proving CMEK control) then re-enable.
- **NL note:** CMEK is a **B2G upsell/gate**, not a launch requirement — some Dutch municipalities/insurers/health bodies (JGZ) may demand customer-managed keys in a DPA. The runbook makes Arbor able to say "yes" on a tender without re-architecting. EU residency (`europe-west4`) is already met; CMEK is the incremental control.
- **IL note:** EU adequacy means `europe-west4` residency satisfies IL; CMEK is not required by Amendment 13 for the consumer launch — treat as the same B2G-gated option. No RTL/UI impact.
- **Effort:** M (the activation, if triggered; the evaluation doc itself is S). **Severity:** Low. **Dependencies:** soft on SEC-4/SEC-6 (full B2G posture). **Rollback:** N/A for the doc; CMEK activation is a forward migration (key destruction is irreversible — call this out). **Cost impact:** Cloud KMS key + operations are low monthly cost, but CMEK introduces an **availability dependency** and migration effort — the reason to defer until a contract pays for it.

---

## Cross-mission shared-file edit map (for the conflict-sequencer)

| File | SEC-1 | SEC-2 | SEC-3 | SEC-4 | SEC-5 | SEC-6 | SEC-7 | SEC-8 |
|---|---|---|---|---|---|---|---|---|
| `app/src/config/env.ts` | add `CSP_REPORT_ONLY` | add `AI_GLOBAL_HOURLY_LIMIT` (cloudbuild) | add `PROMPT_FIELD_MINIMIZATION` | — | — | add `REQUIRE_APP_CHECK` | — | — |
| `app/src/server/createApp.ts` | helmet 82–85 + mount csp-report ~98 | rate-limit store 99–108 | — | — | — | mount appCheck ~112 | — | — |
| `cloudbuild.prod.yaml` | line 49 env | line 49 env | line 49 env (flag) | — | — | line 49 env | — | — |
| `firestore.rules` | — | — | — | — | lines 29–45 create rules | — | — | — |
| `app/src/server/aiQuota.ts` | — | global ceiling | — | — | — | — | — | — |
| `app/src/server/redaction.ts` | — | — | multi-entity tokens | — | — | — | — | — |
| `app/src/routes/api.ts` | — | — | prompt-input minimize (10+ sites) | — | — | — | output Zod (5 routes) | — |
| `app/src/lib/api.ts` | — | — | — | — | — | `authHeaders` App Check | — | — |
| `.github/workflows/arbor-ci.yml` | — | — | — | — | add `test:rules` step | — | — | add security job |
| `.github/workflows/arbor-deploy.yml` | — | — | — | comment cleanup / drop key step | — | add APPCHECK build env | — | — |
| `app/package.json` | — | — | — | — | add `test:rules` | — | — | — |

**Key sequencing constraint:** **SEC-3 and SEC-7 both edit `app/src/routes/api.ts`** — apply them in one coordinated pass (SEC-3 at prompt-input seams, SEC-7 at model-output seams) to avoid clobbering. `cloudbuild.prod.yaml` line 49 and `config/env.ts` are touched by SEC-1/2/3/6 — batch the env-var additions.
