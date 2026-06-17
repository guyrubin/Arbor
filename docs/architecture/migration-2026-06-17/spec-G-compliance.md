# Spec G — Privacy & Compliance (GDPR + HIPAA-analog)

**Domain owner:** Privacy & Compliance
**WAF score today:** 2.5 / 5 (EU residency + approved-memory gate are good; no DPIA, partial export/delete, partial audit). See `docs/architecture/well-architected-assessment-2026-06-04.md` §"Privacy & Compliance" (lines 45, 175-193).
**Date:** 2026-06-17
**Markets:** Netherlands (NL — GDPR + Dutch AVG/Autoriteit Persoonsgegevens) and Israel (IL — Privacy Protection Law + Amendment 13, in force Aug 2025). Both sit on `europe-west4`; IL has EU adequacy so residency is already met for both.

## Ground truth (what exists today)

Verified by reading the source, not assumed:

- **Stores follow one pattern**: `Local<X>Store` + `Firestore<X>Store` + `create<X>Store(config)` switched on `config.memoryAdapter` (`server/consultRequests.ts:34-66`, `sharing/shares.ts:86-184`, `memory/firestoreMemoryStore.ts`). Every new compliance store in this spec reuses this exact shape so it works in local sandbox and prod identically.
- **Export (CMP-3 partial)**: `GET /api/privacy/export/:childId` exists (`routes/api.ts:1530-1546`) returning `serverData: { memoryEvents, shares }`. The client merges it with client-side Firestore subcollections in `lib/childData.ts:exportChildData` (`CHILD_SUBCOLLECTIONS` = behaviorLogs, milestones, actionPlans, savedStories, contacts, weeklyReports, briefs, insights). **Gap:** export is per-child only (no family/account-wide), not machine-readable schema'd, and does not include `aiRuns`/`safetyReviews` or a consent record.
- **Erasure (CMP-3 partial)**: `POST /api/privacy/erase` (`routes/api.ts:1551-1567`) → `memoryStore.eraseChild()` (`firestoreMemoryStore.ts:52-68`, hard-deletes `children/{childId}/memoryEvents` + child doc) and `shareStore.eraseByChild()` (`shares.ts:176-183`). Client deletes its own subcollections in `lib/childData.ts:deleteChildData`. **Gaps:** (1) no **tombstone audit** record of the erasure; (2) a **data-model split** — server writes `children/{childId}/memoryEvents` but the client stores under `users/{uid}/children/{childId}/...` (`childData.ts:46`, `firestore.rules:22-27`); erasure must cover both trees; (3) Cloud Storage (avatars/uploads) is not swept.
- **Consent / age-gate (CMP-1): absent.** `components/auth/OnboardingFlow.tsx` captures name + age (slider 0-18, line 102) + concern + languages and calls `addChild()` (`context/ProfileContext.tsx:24`). No consent checkbox, no parental-confirmation, no consent record persisted. Assessment line 179 confirms "Invite-only; no consent capture/age-gate".
- **Audit (CMP-5 partial)**: `firestore.rules:47-56` define append-only `aiRuns` and `safetyReviews` collections (`create` only; `read/update/delete:false` or owner-read), **but `grep` finds NO writer in `app/src`** — the collections are declared, never written. The real per-request log is `server/logger.ts` (Cloud Logging JSON lines; AI bodies never logged, `logger.ts:48`). So "audit" today = ephemeral Cloud Logging, not an immutable in-product ledger.
- **Retention (CMP-7 partial)**: `MemoryLedgerEvent.retention` is a free-text string (`memory/types.ts:15`); `memoryService.ts:46-65` parses it to a TTL and **filters expired facts out of prompts at read time** (`getApprovedMemoryContext`, line 67-80). **Gap:** expired memory is never deleted from Firestore and no `expired` ledger event is written — it lingers indefinitely on disk, which is a storage-limitation (Art. 5(1)(e)) failure even though it is not *used*.
- **DPIA (CMP-2): absent** (assessment line 180). No `aiRuns` PII telemetry to feed it.
- **Subprocessor region (CMP-4)**: `cloudbuild.prod.yaml:49` pins `VERTEX_LOCATION=europe-west4` and `VERTEX_MODEL_CHAT=gemini-2.5-flash` (note: prod currently overrides the Claude default in `config/env.ts:101` to Gemini — Anthropic-via-Vertex is **not** wired in prod today; CMP-4 must record reality, not the default).
- **Breach (CMP-6): stub** (assessment line 188 → OPS-5).

**Shared-file budget for this domain (so the conflict-mapper can sequence):**

| Shared file | Missions touching it | Nature of edit |
| :-- | :-- | :-- |
| `app/src/config/env.ts` | CMP-1, CMP-5, CMP-7 | additive config fields + env parsing (append to `ArborConfig` + `loadConfig` object literal; no prod-invariant changes except CMP-7 optional) |
| `app/src/server/createApp.ts` | CMP-5, CMP-7 | instantiate new store(s) (`createAuditStore`, `createConsentStore`) + pass into `createApiRouter` deps; CMP-7 mounts a sweep initializer like `initUsageRollup` (line 75) |
| `app/src/routes/api.ts` | CMP-1, CMP-3, CMP-5 | new routes + audit-write calls inside existing export/erase/share handlers |
| `firestore.rules` | CMP-1, CMP-5, CMP-7 | new `match` blocks (consents, auditEvents); align with existing `aiRuns`/`safetyReviews` append-only style (lines 47-56) |
| `firestore.indexes.json` | CMP-5, CMP-7 | new composite indexes for audit + retention queries |
| `cloudbuild.prod.yaml` | CMP-7 | one env var (`MEMORY_RETENTION_SWEEP_ENABLED`) appended to the `^@^` string (line 49) |
| `package.json` (`app/`) | none required | tests ride existing `npm test` (vitest) + `npm run build` |
| CI (`.github/workflows/arbor-ci.yml`) | CMP-5 (optional) | rules emulator test step is optional/additive |

CI gate for every mission: `npm run lint` (tsc --noEmit) + `npm test` (vitest) + `npm run build` (vite + esbuild) must stay green (`app/package.json` scripts; CI runs `npm test` then `npm run build`, `arbor-ci.yml:24-27`).

---

### CMP-1 — Parental consent capture + age-gate (Art. 8), with a durable consent record surfaced in onboarding

- **Objective / done-when:**
  - Onboarding cannot complete (`addChild` not called) until the parent (a) self-attests they are the holder of parental responsibility and (b) accepts the privacy notice + processing of child data; the attestation is captured with a versioned policy id, timestamp, locale, and market.
  - An **age-gate** runs: if the child's age implies the data subject is a child (always true for Arbor's 0-18 range), Art. 8 child-data consent flow is shown; the consent record stores `childAgeAtConsent`.
  - A consent record is **persisted server-side** (`POST /api/consent`) keyed by `{uid, childId}` and **re-surfaced** in Settings ("You consented to X on DATE, policy vX") and included in the data export (CMP-3).
  - Withdrawing consent is possible (record a `withdrawn` event) and links to erasure (CMP-3).
  - **Done-when test:** a new account with no consent record is blocked at onboarding; after consent, `GET /api/consent/:childId` returns the record; tsc+tests+build green.
- **Approach (grounded):**
  - New store `server/consent.ts` mirroring `server/consultRequests.ts:34-66` exactly: `ConsentRecord` type, `LocalConsentStore`, `FirestoreConsentStore` (collection `consents`, doc id `${uid}_${childId}_${policyVersion}` so re-consent appends a new immutable row), `createConsentStore(config)`.
  - `ConsentRecord = { id, uid, childId, policyVersion, locale, market: "NL"|"IL"|"other", lawfulBasis: "art6_consent"|"art8_parental", childAgeAtConsent, attestations: { parentalResponsibility: boolean, privacyNotice: boolean, dataProcessing: boolean }, status: "granted"|"withdrawn", createdAt }`.
  - Routes in `routes/api.ts`: `POST /api/consent` (writes a `granted` record via `actorOf(req).uid`, like `/api/shares` at line 121), `GET /api/consent/:childId` (latest record for owner+child), `POST /api/consent/withdraw`.
  - Client: add a **consent step** to `components/auth/OnboardingFlow.tsx` before the existing `submit()` (line 43) — a checkbox block ("I am the parent/guardian", "I've read the privacy notice", "I agree to Arbor processing my child's information") gated on `submit` being disabled until all checked; on submit, call `api.consent({...})` BEFORE `addChild()`. Surface the record read-only in `components/layout/SettingsModal.tsx` under the existing "Data & privacy" section (line 169).
  - Add `api.consent`/`api.consentStatus`/`api.consentWithdraw` to `lib/api.ts` next to `privacyExport` (line 174-178).
  - `POLICY_VERSION` constant (e.g. `"2026-06-17"`) lives in a new `lib/consent.ts` so client and server agree.
- **Files to CREATE:**
  - `app/src/server/consent.ts`
  - `app/src/server/consent.test.ts`
  - `app/src/lib/consent.ts` (shared policy version + types + i18n keys list)
  - `app/src/components/auth/ConsentStep.tsx` (the checkbox block, reused by onboarding)
- **Files to MODIFY:**
  - `app/src/routes/api.ts` **[SHARED]** — add 3 routes; add `consentStore` to `ApiDeps` (line 28-38) + destructure (line 71).
  - `app/src/server/createApp.ts` **[SHARED]** — `const consentStore = createConsentStore(config);` (near line 71) + pass into `createApiRouter` deps (line 125).
  - `app/src/components/auth/OnboardingFlow.tsx` — insert consent gate before `addChild`.
  - `app/src/components/layout/SettingsModal.tsx` — show consent record.
  - `app/src/lib/api.ts` — `api.consent*` methods.
  - `app/src/lib/i18n.ts` **[SHARED-ish]** — add `consent.*` keys in EN + HE (RTL).
  - `firestore.rules` **[SHARED]** — `match /consents/{id}` : `allow create: if signedIn() && request.resource.data.uid == request.auth.uid; allow read: if signedIn() && resource.data.uid == request.auth.uid; allow update, delete: if false;` (append-only, mirrors `aiRuns` lines 47-51).
- **Interfaces/contracts:** `POST /api/consent` body `{ childId, policyVersion, locale, market, childAgeAtConsent, attestations }`; `ConsentRecord` schema; new env `CONSENT_POLICY_VERSION` (optional, defaults to the constant) added to `config/env.ts` **[SHARED]** `ArborConfig` + `loadConfig`.
- **Test plan:** unit (`consent.test.ts`) on `LocalConsentStore` create/get/withdraw + id determinism; route test (extend `server/admin.test.ts` style) that POST then GET round-trips; a client test that onboarding submit is disabled until all attestations checked. Live: sign up fresh → confirm onboarding blocks → confirm Settings shows the record.
- **NL note:** AVG requires the lawful basis be explicit and the privacy notice (Art. 13) reachable at consent time; Dutch UI is a *future* need (app is EN/HE today) — store `locale` so a later Dutch notice version is record-compatible. B2G (JGZ/municipality) will demand this record exists per child → this is a **B2G-readiness gate**.
- **IL note:** Amendment 13 strengthens consent + database accountability. The consent UI and the Settings read-back **must render correctly RTL/Hebrew** — add `consent.*` i18n keys to both EN and HE in `lib/i18n.ts`; checkbox rows must mirror in RTL. `market: "IL"` record distinguishes the lawful basis.
- **Effort:** M · **Severity:** High · **Dependencies:** none (CMP-3 consumes its output) · **Rollback:** feature-flag the consent gate (`CONSENT_GATE_ENABLED`, default on in prod) so onboarding can revert to current behavior; store is additive. · **Cost impact:** negligible (one extra Firestore write per child at onboarding; no recurring cost).

---

### CMP-2 — DPIA completed (data flows incl. PII-to-LLM, risks, mitigations, residual-risk sign-off) = HIPAA §164.308(a)(1) risk-analysis analog

- **Objective / done-when:** a committed, versioned DPIA document exists at `docs/architecture/dpia-2026-06-17.md` covering: (1) systematic description of processing, (2) data-flow inventory incl. every PII-to-LLM seam, (3) necessity/proportionality, (4) risk register with likelihood/impact, (5) mitigations mapped to existing controls + this backlog, (6) residual-risk sign-off line. Done-when: doc merged + linked from the assessment; a one-page **data-flow inventory table** is accurate against the code (every model-calling route enumerated).
- **Approach (grounded — this is a *document* mission, not code, but it must cite real seams):**
  - Enumerate every PII-to-LLM seam from `routes/api.ts`: `/chat` (line 196), `/council` (342), `/voice` (452), `/extract-log` (535), `/vision` (606), `/score-utterance` (702), `/generate-avatar` (743), `/generate-scene` (812), `/generate-comic` (863), `/generate-adventure` (958), `/generate-plan` (1050), `/generate-story` (1127), `/generate-hero-journey` (1172), `/digest`. For each: what PII could enter, and which mitigation applies. **Key mitigation to document accurately:** `server/redaction.ts` redacts child name + email + phone at the model-call seam (`createRedaction`, applied as `privacy.redact(prompt) + REDACTION_DIRECTIVE` on every route) and restores after — so the child's *name* does not reach the LLM, but the **full profile JSON** (age, languages, challenges, strengths, schoolContext) still does in several routes (e.g. `/chat` line 255, `/generate-plan` line 1068) → document this as residual risk SEC-3.
  - Document residency: `cloudbuild.prod.yaml:49` `VERTEX_LOCATION=europe-west4`; flag that prod chat currently routes to `gemini-2.5-flash` (Vertex, EU) and Anthropic-via-Vertex is not active → tie to CMP-4.
  - Risk register rows must reference mitigations by mission id (CMP-1/3/5/6/7, SEC-3/6, AI-1/2/3).
  - Add an executive residual-risk sign-off block (owner, date, accepted residual risks, review-by date) so it doubles as the HIPAA risk-analysis artifact.
- **Files to CREATE:** `docs/architecture/dpia-2026-06-17.md`; optionally `docs/architecture/data-flow-inventory.md` (the route→PII→mitigation table, generated by hand from `routes/api.ts`).
- **Files to MODIFY:** `docs/architecture/well-architected-assessment-2026-06-04.md` — add a link to the DPIA next to line 180 (CMP-2). No source code touched.
- **Interfaces/contracts:** none (documentation). The DPIA references env vars (`VERTEX_LOCATION`, `MODEL_PROVIDER`) and the redaction contract as evidence.
- **Test plan:** no automated test. Verification = checklist review: every model-calling route in `routes/api.ts` appears in the inventory table; every High/Med CMP mission appears as a mitigation. A `grep` of route registrations (`router.post`/`router.get` in `routes/api.ts`) must 1:1 match the inventory.
- **NL note:** DPIA is **effectively mandatory under Art. 35** (children + profiling, assessment line 175) — this is the single highest-leverage NL B2G-readiness gate; the Autoriteit Persoonsgegevens expects it before any municipality/JGZ deal. Note the Dutch DPIA expectation of a documented prior-consultation trigger if residual risk stays high.
- **IL note:** Amendment 13 introduces **database accountability + a DPO threshold**; the DPIA should record whether Arbor's processing scale crosses the IL DPO-appointment threshold and name the database for the IL Database Registrar context. Hebrew/RTL data subjects must be reflected in the data-subject description.
- **Effort:** M · **Severity:** High · **Dependencies:** reads outputs of CMP-4 (subprocessor region), CMP-5 (audit), CMP-3 (DSR) to describe mitigations as "built" vs "planned" — can be drafted in parallel and finalized after those land. · **Rollback:** n/a (doc). · **Cost impact:** none.

---

### CMP-3 — Self-serve export (machine-readable full child record) + erasure across Firestore/Storage/ledger, with tombstone audit

- **Objective / done-when:**
  - **Export:** one action produces a **single machine-readable JSON** (schema-versioned: `{ schema: "arbor.export.v1", ... }`) containing the child profile, **all** client subcollections (`CHILD_SUBCOLLECTIONS`, `childData.ts:7-16`), server memory ledger, share grants, **the consent record (CMP-1)**, and **the child's audit trail (CMP-5)**. Done-when: export validates against a documented schema and round-trips (re-import not required, but every collection present).
  - **Erasure:** deletes across **both data trees** (`children/{childId}/*` server-side AND `users/{uid}/children/{childId}/*` client-side), share grants, AND any **Cloud Storage** objects for the child (avatars). Writes an immutable **tombstone** audit event (childId hash, uid, counts, timestamp) so the deletion itself is provable without retaining the data.
  - **Done-when test:** erase returns counts for memoryEvents, shares, storageObjects, and writes one tombstone retrievable via the audit API (CMP-5); export contains all 8 subcollections + serverData + consent + audit.
- **Approach (grounded):**
  - Export already merges client + server (`childData.ts:exportChildData` line 22, calling `api.privacyExport` line 37). Extend: (a) wrap output in `{ schema: "arbor.export.v1", generatedAt, subject: { childId } }`; (b) server `GET /api/privacy/export/:childId` (`routes/api.ts:1530`) adds `consent` (from CMP-1 store) and `auditEvents` (from CMP-5 store) to `serverData`.
  - Erasure: server `POST /api/privacy/erase` (`routes/api.ts:1551`) already calls `memoryStore.eraseChild` + `shareStore.eraseByChild`. Add: (a) **Storage sweep** — delete `gs://.../children/{childId}/**` via `firebase-admin/storage` (only avatars are stored today and they are *not* persisted per `routes/api.ts:796`, so this is forward-proofing — guard behind existence check); (b) **tombstone** — write an audit event `data.delete` via CMP-5 store with `{ childId, uid, removed: { memoryEvents, shares, storageObjects }, erasedAt }`; (c) keep the client-side `users/{uid}/children/{childId}` deletion (`childData.ts:deleteChildData` line 64) — document the data-model split as known and ensure both run.
  - Add `exportChildAudit`/tombstone helpers to the CMP-5 audit store so erase can write before it deletes (the tombstone must survive erasure → it is keyed by uid, not nested under the child doc).
- **Files to CREATE:** `app/src/server/privacyExport.ts` (assemble the v1 schema server-side, keep `routes/api.ts` thin); `app/src/server/privacyExport.test.ts`; `docs/architecture/export-schema-v1.md` (the documented machine-readable schema).
- **Files to MODIFY:**
  - `app/src/routes/api.ts` **[SHARED]** — extend `/privacy/export/:childId` (1530) + `/privacy/erase` (1551) to call the new assembler + write tombstone; pass `auditStore`/`consentStore` from deps.
  - `app/src/lib/childData.ts` — wrap export in `schema: "arbor.export.v1"`; keep dual-tree delete.
  - `app/src/memory/firestoreMemoryStore.ts` — no change to `eraseChild` (already correct, line 52-68); confirm covered by test.
  - `app/src/components/sections/Reports.tsx` and/or `SettingsModal.tsx` — surface "Download my child's full record" + "Delete child & data" with a confirm dialog (Safety level 5 — irreversible; show explicit warning).
  - `storage.rules` — confirm child-scoped storage paths are owner-only (for future avatar persistence).
- **Interfaces/contracts:** `arbor.export.v1` JSON schema; erase response `{ erased: { memoryEvents, shares, storageObjects }, tombstoneId, erasedAt }`; depends on CMP-5 `auditStore.append()` and CMP-1 `consentStore`.
- **Test plan:** unit on the assembler (all collections present, schema tag set); integration test that erase writes a tombstone and returns counts; a `sharesErase.test.ts`-style test (`sharing/sharesErase.test.ts` already exists) extended for the storage path. Live: create child with memory + a share → export → verify JSON completeness → erase → verify ledger empty (`GET /api/memory/:childId` returns `[]`) and tombstone present.
- **NL note:** Art. 15 (access) + Art. 20 (portability) require a **machine-readable, structured** export — JSON with a documented schema satisfies this; Art. 17 erasure must be demonstrable → the tombstone is the evidence the APg/B2G buyer will ask for. **B2G-readiness gate.**
- **IL note:** Israel's Privacy Law grants access + correction rights; Amendment 13 sharpens enforcement. The export download UI + the erase confirm dialog **must work RTL/Hebrew** — add export/erase strings to `lib/i18n.ts` HE. The tombstone supports IL breach/accountability evidence.
- **Effort:** L · **Severity:** High · **Dependencies:** CMP-5 (tombstone target), CMP-1 (consent in export). Can ship export-schema + storage-sweep first, tombstone after CMP-5. · **Rollback:** assembler is additive; if it throws, fall back to current `serverData` shape (wrap in try/catch like `childData.ts:39`). Erase tombstone write is best-effort (deletion proceeds even if audit write fails, but logs an error). · **Cost impact:** one extra Firestore write (tombstone) + Storage list/delete per erase — negligible; no recurring cost.

---

### CMP-4 — Records of processing (Art. 30) + subprocessor DPAs (Google/Vertex, Anthropic-via-Vertex); confirm model region = EU

- **Objective / done-when:** a committed **Records of Processing Activities (RoPA)** document + a **subprocessor register** listing Google Cloud (Firestore, Cloud Run, Cloud Storage, Vertex AI), Anthropic (via Vertex, if/when enabled), and any ASR vendor (SoapBox/Whisper, `config/env.ts:43-49`), each with: processing purpose, data categories, region, and DPA reference. Done-when: every subprocessor that can receive child data has a documented DPA + confirmed EU region; the doc states the **actual** prod model routing (not the default).
- **Approach (grounded):**
  - Build the subprocessor list from real config: `config/env.ts` model fields (`vertexModelChat` line 101 default `claude-3-5-sonnet@anthropic`, `vertexModelStory/Analysis/Handoff` Gemini, `vertexModelImage` `gemini-2.5-flash-image`), `childAsrProvider` + Whisper/SoapBox endpoints (lines 43-49), Firebase/Firestore (`firestoreDatabaseId`), Cloud Run.
  - **Confirm model region:** `cloudbuild.prod.yaml:49` sets `VERTEX_LOCATION=europe-west4` AND overrides `VERTEX_MODEL_CHAT=gemini-2.5-flash` — so **prod chat is Gemini-on-Vertex-EU, not Claude**. The RoPA must record this truthfully and flag: *if* Anthropic-via-Vertex is enabled later, confirm the Claude model is offered in a EU Vertex region (Anthropic models have limited regional availability — verify before flipping `VERTEX_MODEL_CHAT` back to `claude-*`). Cross-check `ai/modelRouter.ts` for per-route model env so the register matches routing.
  - ASR: if `CHILD_ASR_PROVIDER` is ever set to `whisper`/`soapbox`, child *audio* leaves to a third party → that vendor needs a DPA + region confirmation; today default is `none` (`env.ts:127`) so document as "not active, gated."
  - Add an Art. 30 controller/processor record table (categories of data subjects = children + parents; categories of data = developmental observations, profile, audio/image; recipients = subprocessors; retention = CMP-7 policy; transfers = none outside EU).
- **Files to CREATE:** `docs/architecture/ropa-2026-06-17.md` (Art. 30 record); `docs/architecture/subprocessors.md` (register + DPA links + region per vendor).
- **Files to MODIFY:** `docs/architecture/well-architected-assessment-2026-06-04.md` (link near line 184); optionally a comment in `cloudbuild.prod.yaml` near line 49 noting the chat-model override is intentional and EU-resident. No application code.
- **Interfaces/contracts:** documents the env contract (`VERTEX_LOCATION`, `VERTEX_MODEL_*`, `CHILD_ASR_PROVIDER`, `WHISPER_*`, `SOAPBOX_*`) as the source of truth for which subprocessors are live.
- **Test plan:** no automated test. Verification: the subprocessor register's "region" column for every model var matches `cloudbuild.prod.yaml`; an assertion (manual or a tiny script) that prod env has no non-EU `VERTEX_LOCATION`. Recommend a CI guard later (out of scope): fail build if `VERTEX_LOCATION` not in an EU allowlist.
- **NL note:** Art. 30 RoPA is mandatory for the controller; B2G procurement (municipality/insurer) will request the subprocessor list + Google Cloud DPA + the data-processing-agreement chain. **B2G-readiness gate.** Confirm Google Cloud's EU SCCs/DPA cover Vertex.
- **IL note:** Amendment 13 imposes **database accountability** + breach/registration duties; the RoPA doubles as the IL database documentation. IL has EU adequacy, so EU residency satisfies cross-border concerns in both directions — state this explicitly.
- **Effort:** M · **Severity:** High · **Dependencies:** feeds CMP-2 (DPIA cites the register). Independent to build. · **Rollback:** n/a (doc). · **Cost impact:** none.

---

### CMP-5 — Immutable audit log for data access, export, delete, sharing, handoff (extend the aiRuns/safetyReviews pattern); PII-scrubbed

- **Objective / done-when:**
  - A server-side **append-only audit store** records security-relevant events: `data.export`, `data.delete` (tombstone), `share.create`, `share.revoke`, `consent.grant`, `consent.withdraw`, `handoff.generate`, `memory.access` (optional/sampled). Each event is **PII-scrubbed** (no child name, free-text, or message bodies — only ids, hashed childId, event type, actor uid, counts, timestamp).
  - Events are **immutable** (no update/delete) and readable only by the owning user (and, later, an admin/auditor role).
  - Done-when: export/erase/share routes write an audit event; `GET /api/audit?childId=` returns the owner's events; tampering (update/delete) is rejected by rules; tsc+tests+build green.
- **Approach (grounded):**
  - The codebase *declares* `aiRuns` + `safetyReviews` as append-only in `firestore.rules:47-56` but **never writes them** (grep-confirmed). CMP-5 implements the missing writer as a first-class store, reusing the `consultRequests.ts` pattern.
  - New `server/audit.ts`: `AuditEvent = { id, type, actorUid, childIdHash, subjectChildId?, counts?, meta?: Record<string,string|number>, createdAt }` (meta is a small allowlist of non-PII scalars). `LocalAuditStore`, `FirestoreAuditStore` (collection `auditEvents`, partition-friendly: store `actorUid` + `createdAt` for query), `createAuditStore(config)`. Hash childId with a server-side salt (`AUDIT_CHILD_SALT` env) so the tombstone can prove "this child was deleted" without retaining the raw id.
  - Wire writes into existing handlers in `routes/api.ts`: `/shares` POST (line 121) → `share.create`; `/shares/:id` DELETE (line 150) → `share.revoke`; `/privacy/export/:childId` (1530) → `data.export`; `/privacy/erase` (1551) → `data.delete` (the CMP-3 tombstone); `/generate-handoff` route → `handoff.generate`; CMP-1 consent routes → `consent.*`.
  - Add `GET /api/audit` (owner-scoped via `actorOf`).
  - Reuse `server/redaction.ts:createRedaction` is **not** needed here because we never store free text — the discipline is "ids + counts only," enforced by the `AuditEvent` type. Document that rule in the file header.
- **Files to CREATE:** `app/src/server/audit.ts`; `app/src/server/audit.test.ts`.
- **Files to MODIFY:**
  - `app/src/server/createApp.ts` **[SHARED]** — `const auditStore = createAuditStore(config);` (near line 71) + into `createApiRouter` deps (line 125).
  - `app/src/routes/api.ts` **[SHARED]** — add `auditStore` to `ApiDeps` (28-38) + destructure (71); add `audit.append(...)` calls in the 6 handlers above; add `GET /api/audit`.
  - `app/src/config/env.ts` **[SHARED]** — add `auditChildSalt?: string` to `ArborConfig` + `loadConfig` (`process.env.AUDIT_CHILD_SALT`).
  - `firestore.rules` **[SHARED]** — `match /auditEvents/{id}` : `allow create: if signedIn() && request.resource.data.actorUid == request.auth.uid; allow read: if signedIn() && resource.data.actorUid == request.auth.uid; allow update, delete: if false;` (mirrors `aiRuns` lines 47-51 exactly).
  - `firestore.indexes.json` **[SHARED]** — composite index `auditEvents (actorUid ASC, createdAt DESC)` for the list query.
  - `app/src/lib/api.ts` — `api.audit(childId?)`.
- **Interfaces/contracts:** `AuditEvent` type; `auditStore.append(event)`; `GET /api/audit?childId=`; env `AUDIT_CHILD_SALT`. Other missions consume `auditStore.append` (CMP-1, CMP-3).
- **Test plan:** unit (`audit.test.ts`) — append + list-by-owner ordering + immutability of the type; a `firestore.rules.test.ts` case (file exists at `app/src/firestore.rules.test.ts`) asserting `update`/`delete` on `auditEvents` is denied and cross-user read is denied; integration that an export call produces a `data.export` event. Optionally add a rules-emulator step to CI (`arbor-ci.yml`). Live: export a child → `GET /api/audit` shows the event with no PII.
- **NL note:** Art. 30/32 + HIPAA §164.312(b) audit-controls analog (assessment line 185, 192). B2G (insurers/JGZ) raises the bar — they will require an access/disclosure audit trail. **B2G-readiness gate.** PII-scrubbing is essential so the audit log itself is not a new data-protection liability.
- **IL note:** Amendment 13's accountability + breach-notification duties are far easier to satisfy with a queryable audit trail (who accessed/exported/deleted what, when). No PII means the log is safe to retain longer than the data it describes.
- **Effort:** M · **Severity:** Med · **Dependencies:** none to build; CMP-1 and CMP-3 *write into* it (so land CMP-5 first or in the same wave). · **Rollback:** all writes are best-effort (wrap in try/catch, log on failure, never block the user action); store is additive; flag `AUDIT_ENABLED` if needed. · **Cost impact:** one small Firestore write per security event (export/delete/share are low-frequency) — negligible. `memory.access` should be **sampled or off by default** to avoid a write per read (recurring-cost flag); cheaper alternative = rely on Cloud Logging (`logger.ts`) for high-frequency access and reserve `auditEvents` for the discrete export/delete/share/consent events.

---

### CMP-6 — Breach detection → 72h notification workflow tied to the OPS-5 runbook

- **Objective / done-when:** a documented, testable breach-response workflow: (1) **detection signals** wired to Cloud Logging/alerting, (2) a **severity/triage decision tree**, (3) a **72-hour notification clock** with templates for the supervisory authority + affected data subjects, (4) linkage to the OPS-5 incident runbook and the CMP-5 audit log as the evidence source. Done-when: the runbook exists, a log-based alert policy is defined (as IaC/doc), and a tabletop "dry-run" checklist passes.
- **Approach (grounded — mostly process + managed-service config, minimal code):**
  - Detection: lean on existing structured logging (`server/logger.ts` emits Cloud-Logging-native JSON; 4xx/5xx already separated, lines 70-72). Define **log-based metrics + alert policies** (Cloud Monitoring) for: spikes in 401/403 (auth-bypass attempts), unusual `data.export`/`data.delete` volume (read from CMP-5 audit), CSP/CORS violations, and Cloud Run error-rate. These are **config, not code** (gcloud/Terraform snippets in the runbook) → cheapest path.
  - Workflow doc: triage severity (confirmed personal-data breach vs near-miss), the **72h Art. 33 clock** (start = awareness), notification templates (NL: Autoriteit Persoonsgegevens; IL: PPA + data subjects under Amendment 13), and an evidence checklist pointing at the CMP-5 audit trail + Cloud Logging.
  - Tie to OPS-5: reference the incident runbook stub (assessment line 188); this mission supplies the *privacy-breach* branch of it.
- **Files to CREATE:** `docs/architecture/breach-response-runbook.md` (the 72h workflow + templates + alert-policy definitions). Optionally `infra/monitoring/breach-alerts.tf` or a `gcloud monitoring` snippet block inside the runbook.
- **Files to MODIFY:** `docs/architecture/well-architected-assessment-2026-06-04.md` (link near line 188). No application code required for v1 (detection rides managed monitoring + CMP-5 audit).
- **Interfaces/contracts:** consumes CMP-5 audit events + `logger.ts` log fields (`severity`, `httpRequest.status`, `userUid`); defines Cloud Monitoring alert-policy filters. No new app env unless an alert webhook is added later.
- **Test plan:** tabletop dry-run checklist (simulate "exfil via stolen token" → confirm the alert fires from a synthetic log line, the audit trail shows the access, the 72h template is fillable). Optionally a smoke test that emits a high-severity log line and verifies the alert policy filter matches. No unit test needed for the doc.
- **NL note:** Art. 33 = **72h to the Autoriteit Persoonsgegevens**; Art. 34 = notify data subjects if high risk. Children's data raises the "high risk" likelihood → templates must default to notifying parents. **B2G contracts will mandate breach-notification SLAs to the public body too** (often tighter than 72h) — note this in the runbook.
- **IL note:** Amendment 13 (in force Aug 2025) introduces a **statutory breach-notification regime** to the Israeli PPA (and affected subjects). Provide a Hebrew data-subject notification template; the clock + authority differ from NL → the runbook needs a per-market branch.
- **Effort:** S · **Severity:** Med · **Dependencies:** CMP-5 (audit trail is the evidence source); OPS-5 (parent runbook). · **Rollback:** n/a (doc + managed-config; alert policies can be disabled). · **Cost impact:** Cloud Monitoring alert policies + log-based metrics are effectively free at Arbor's volume; **no min-instances or new infra**. Avoid a paid PagerDuty tier for v1 — email/Slack notification channel suffices.

---

### CMP-7 — Enforce the documented retention policy server-side (TTL/expiry on the modeled memory `retention` field)

- **Objective / done-when:**
  - Approved memory past its parsed retention is not only **filtered from prompts** (already true, `memoryService.ts:67-80`) but **actually deleted** from Firestore (or transitioned to an `expired` tombstone event then purged), so storage-limitation (Art. 5(1)(e)) holds on disk, not just in the prompt window.
  - A documented retention policy maps each data class (memory ledger, behaviorLogs, audit events, consent records) to a retention period; the sweep enforces the memory one. Done-when: a scheduled sweep marks+removes expired memory, writes an `expired` ledger event (existing event type, `memory/types.ts:10`), and is idempotent + safe (never touches `permanent`/unparseable retention).
- **Approach (grounded — additive, reuses existing primitives):**
  - The retention machinery already exists: `retentionToMs` + `isMemoryExpired` (`memoryService.ts:46-65`, tested in `memory/memoryExpiry.test.ts`). The `expired` status + `MemoryStatus`/`eventType` are modeled (`memory/types.ts:3,10`). What's missing is a **writer that acts on expiry**.
  - Add `expireStaleMemory(store, now)` to `memoryService.ts`: list events, fold, find approved-but-expired items, and for each append an `expired` event via `store.appendEvent` (so the ledger stays append-only and auditable) — and optionally hard-delete the underlying events for true storage minimization (a new `store.purgeExpired(childId)` on `MemoryStore`, implemented in `firestoreMemoryStore.ts` mirroring `eraseChild` line 52-68 but filtered to expired memoryIds).
  - **Scheduling (cost-conscious):** prefer a **lazy/opportunistic sweep** — run `expireStaleMemory` for a child the next time their memory is read (`getApprovedMemoryContext`) behind a flag, OR a lightweight interval like the existing `initUsageRollup(config)` (`createApp.ts:75`, `server/usageRollup.ts`) which already runs an in-process periodic job. **Avoid** a new always-on Cloud Scheduler + min-instance just for this (recurring cost). Gate with `MEMORY_RETENTION_SWEEP_ENABLED` (default on in prod, off in local).
  - Firestore native **TTL policy** is the cheapest enforcement for *new* writes: add an `expiresAt` timestamp field when appending approved memory (compute from `retentionToMs`) and configure a Firestore TTL policy on `memoryEvents.expiresAt` — Google deletes expired docs server-side at no compute cost. Use this for hard-deletion and the in-process sweep only for the `expired` *ledger event* (audit trail). Document both.
- **Files to CREATE:** `app/src/memory/retentionSweep.ts` (the `expireStaleMemory` orchestrator + interval starter, modeled on `usageRollup.ts`); `app/src/memory/retentionSweep.test.ts`.
- **Files to MODIFY:**
  - `app/src/memory/memoryService.ts` — add `expireStaleMemory`; when appending approved memory, set `expiresAt` (additive field).
  - `app/src/memory/types.ts` — add optional `expiresAt?: string` to `MemoryLedgerEvent`; add `purgeExpired(childId)?` to `MemoryStore` (optional, like `eraseChild`).
  - `app/src/memory/firestoreMemoryStore.ts` — implement `purgeExpired`; write `expiresAt` on append.
  - `app/src/server/createApp.ts` **[SHARED]** — start the sweep (one line like `initUsageRollup(config)` at line 75), flag-gated.
  - `app/src/config/env.ts` **[SHARED]** — add `memoryRetentionSweepEnabled: boolean` to `ArborConfig` + `loadConfig` (`boolFromEnv(process.env.MEMORY_RETENTION_SWEEP_ENABLED, arborEnv === "prod")`).
  - `cloudbuild.prod.yaml` **[SHARED]** — append `@MEMORY_RETENTION_SWEEP_ENABLED=true` to the `^@^` env string (line 49).
  - `firestore.indexes.json` **[SHARED]** — if sweeping by `expiresAt`, add an index; the Firestore **TTL policy** on `memoryEvents.expiresAt` is configured out-of-band (gcloud/console) — document in the runbook.
  - `docs/architecture/well-architected-assessment-2026-06-04.md` + a new `docs/architecture/retention-policy.md` (the data-class → period table).
- **Interfaces/contracts:** `expireStaleMemory(store, now?)`; `MemoryStore.purgeExpired?`; `MemoryLedgerEvent.expiresAt?`; env `MEMORY_RETENTION_SWEEP_ENABLED`; Firestore TTL policy on `memoryEvents.expiresAt`.
- **Test plan:** extend `memory/memoryExpiry.test.ts` — `expireStaleMemory` appends exactly one `expired` event per stale approved fact, is idempotent (re-running adds none), and never touches `permanent`/unparseable retention (the existing test at line 15 guards the conservative case). Unit for `purgeExpired`. Live: seed a 30-day fact dated 40 days ago → run sweep → confirm an `expired` event exists and the fact is gone from `GET /api/memory/:childId`.
- **NL note:** Art. 5(1)(e) storage limitation — a *documented + enforced* retention schedule is exactly what the APg checks; "we filter it from prompts but keep it forever" fails. B2G data-processing addenda specify retention/return-or-destroy clauses → enforced TTL satisfies them. **B2G-readiness gate.**
- **IL note:** Amendment 13 reinforces purpose-limitation/retention discipline; the same sweep satisfies it. No locale-specific UI (server-side job) — but the `retention` strings the model emits must be parseable in Hebrew contexts too; `retentionToMs` parses English unit words, so ensure the model is instructed (existing redaction/prompt path) to emit retention in English or extend the regex (`memoryService.ts:50`) for Hebrew units (out-of-scope flag if HE retention strings appear).
- **Effort:** M · **Severity:** Med · **Dependencies:** none (self-contained; CMP-5 optionally records a `memory.expire` audit event). · **Rollback:** flag-gated (`MEMORY_RETENTION_SWEEP_ENABLED=false` disables); `expired` events are reversible (the data is gone only if `purgeExpired`/TTL also runs — keep purge behind a second flag for a soft-launch where you only mark, not delete). · **Cost impact:** lowest with Firestore native TTL (free server-side deletion) + in-process sweep on the existing interval — **no new scheduler, no min-instances, no Redis.** Cheaper alternative to a dedicated Cloud Scheduler is explicitly chosen.

---

## Sequencing note for the conflict-mapper

- **Wave 1 (docs, no code conflicts):** CMP-2 (DPIA), CMP-4 (RoPA/subprocessors), CMP-6 (breach runbook) — pure `docs/` additions, parallel-safe.
- **Wave 2 (shared-file code):** CMP-5 (audit store) **first** — it owns the new `createApp.ts`/`routes/api.ts`/`firestore.rules`/`indexes` edits that CMP-1 and CMP-3 then *add onto*. CMP-7 also touches `createApp.ts`/`env.ts`/`cloudbuild.prod.yaml` but in disjoint regions (sweep init vs store init; appended env var) — coordinate the `env.ts` `ArborConfig` additions (CMP-1 `consentPolicyVersion`, CMP-5 `auditChildSalt`, CMP-7 `memoryRetentionSweepEnabled`) as one combined patch to avoid three-way conflict.
- **Wave 3:** CMP-1 (consent) and CMP-3 (export/erase/tombstone) — both write into CMP-5's audit store and share `routes/api.ts` + `createApp.ts` deps; land after CMP-5, ideally same PR or back-to-back.
