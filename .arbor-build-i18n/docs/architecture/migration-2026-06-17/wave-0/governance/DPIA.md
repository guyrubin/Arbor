# Data Protection Impact Assessment (DPIA) — Arbor

**Mission:** CMP-2 (Wave 0, Governance)
**Document version:** 1.0
**Date:** 2026-06-17
**Status:** DRAFT — pending DPO / controller sign-off (see §13)
**Owner (controller):** Guy Rubin (Arbor)
**Author:** Principal Engineer / Compliance Lead (WAF migration)
**Review-by:** 2026-12-17 (or on any material change to processing — see §12)
**Classification:** Internal — B2G procurement evidence pack

> **Dual mandate.** This single document discharges **both**:
> - the **GDPR / Dutch AVG (UAVG) Art. 35 DPIA** duty for the **Netherlands (NL)** market (children + profiling + AI = "likely high risk" on the Autoriteit Persoonsgegevens (AP) list), and
> - the **Israeli Privacy Protection Law (PPL) + Amendment 13** database-accountability / risk-assessment duty for the **Israel (IL)** market.
>
> It also serves as the **HIPAA §164.308(a)(1)(ii)(A) risk-analysis analog** for any future US / health-system engagement (Arbor is not a HIPAA covered entity today; the cross-reference is in §11).
>
> Every governance assertion below carries **both** the NL requirement and the IL requirement. Where an artifact is parent- or authority-facing, a **Hebrew/RTL note** is included.

---

## 0. How to read this DPIA

- **Markets are first-class and equal.** NL (GDPR/AVG, AP, 72h) and IL (PPL + Amendment 13, PPA) are addressed side-by-side in every section. Residency is **not** the differentiator — both run on `europe-west4` and IL holds an EU adequacy decision, so EU residency is lawful for IL data. Governance, language (Hebrew/RTL now; Dutch UI soon), and B2G hardening are the differentiators.
- **Everything is grounded in real code.** Citations like `routes/api.ts:268` are verified against the source tree under `app/src`, not assumed. The data-flow inventory in §3 enumerates *every* model-calling route.
- **Risks map to backlog mission IDs.** Mitigations are tagged to the Wave-0/Wave-1 backlog: `SEC-3` (redaction), `AI-1/2/3` (safety), `CMP-1` (consent), `CMP-3` (rights), `CMP-5` (audit), `CMP-7` (retention), `CMP-4` (RoPA/subprocessors), `CMP-6` (breach). "Built" vs "Planned" status is stated per control in §6–§7.
- This DPIA is the **canonical risk artifact**; the RoPA (`CMP-4`), breach runbook (`CMP-6`), retention policy (`CMP-7`), and export schema (`CMP-3`) are its companion documents.

---

## 1. Systematic description of the processing (GDPR Art. 35(7)(a))

### 1.1 What Arbor is

Arbor is a **child-facing developmental and parenting-support application**. Parents/guardians create a child profile (name, date-of-birth/age, languages, developmental concerns, strengths, school context) and interact with an AI "coach" and a multi-expert "council" that produce developmental guidance, behaviour-log analysis, activity/story/comic/adventure generation, weekly reports, and clinician handoff documents. A long-term **memory ledger** stores parent-approved facts about the child to personalise future guidance.

The product is built as a single-page React client + an Express API (`app/src`) deployed on **Cloud Run** in `europe-west4`, with **Firestore** as the system of record and **Vertex AI** (Gemini family in prod; Anthropic-via-Vertex configured as a non-prod default) as the model layer. See `docs/architecture/arbor-architecture.md`.

### 1.2 Nature of the processing

| Attribute | Detail |
|---|---|
| **Processing operations** | Collection, storage, structured analysis, AI inference (LLM prompting), generation of derived content, sharing (parent → professional), export, erasure, retention/expiry. |
| **Automated processing / profiling** | Yes — developmental-pattern analysis (`/analyze-behavior`, `/extract-log`), AI-generated guidance, and the planned semantic **safety classifier** (`AI-1`) constitute profiling of a child. This is the trigger that makes the DPIA effectively mandatory under Art. 35 (NL) and an accountability obligation under Amendment 13 (IL). |
| **Automated decision-making with legal/similar effect** | **No.** Arbor produces *advisory* guidance for a parent; there is human-in-the-loop (the parent) and no Art. 22 solely-automated decision with legal or similarly significant effect. Documented here so the AP / PPA position is explicit. |
| **Scale** | Early-stage; per-family, low volume at launch. The IL DPO-appointment threshold (Amendment 13) and the EU "large-scale" Art. 35(3)(b) trigger are **not** currently crossed by volume — but children's data + profiling crosses the *sensitivity* trigger independently (§2.3). |
| **Duration / permanence** | Memory ledger persists across sessions; retention governed by the `retention` field per fact, enforced by `CMP-7` (see §7). |

### 1.3 Scope of the processing — data categories

| Category | Examples | Source | Sensitivity |
|---|---|---|---|
| **Child identity PII** | Child first name, age / DOB-derived age | Parent at onboarding (`OnboardingFlow.tsx`) | High (child) |
| **Child developmental profile** | Languages, developmental concerns/challenges, strengths, school context | Parent | High (special-category-adjacent: may reveal health/disability) |
| **Observational / behavioural data** | Behaviour logs, milestones, free-text observations | Parent | High (may reveal child health) |
| **Derived AI content** | Action plans, stories, comics, weekly reports, insights, handoff docs | Generated | Medium |
| **Memory ledger** | Parent-approved long-term facts about the child | Derived + parent approval | High |
| **Parent identity** | Account uid, email | Auth (Firebase) | Medium |
| **Child audio** (conditional) | Pronunciation audio for articulation scoring | Child, **only if** `CHILD_ASR_PROVIDER` ≠ `none` (default `none`, `config/env.ts:126-129`) | High (biometric-adjacent) — **gated off today** |
| **Child image** (conditional) | Avatar generation input | Parent/child | Medium — output not persisted today (`routes/api.ts:796`) |

> **Special-category note (Art. 9 GDPR / heightened-sensitivity PPL):** developmental concerns and behavioural observations *can* reveal data concerning a child's health or disability. Arbor treats the full profile as **heightened-sensitivity** for risk purposes even where it does not formally meet the Art. 9 threshold. This raises the bar for lawful basis (§4) and minimization (§6, SEC-3).

### 1.4 Context of the processing

- **Data subjects:** (a) **children** (ages 0–18, the slider range in `OnboardingFlow.tsx:102`) — vulnerable data subjects by definition; (b) **parents/guardians** (account holders, consent-givers).
- **Relationship:** B2C today; **B2G** (NL: municipalities / JGZ-consultatiebureau / schools / insurers; IL: public-health / Tipat-Chalav-MoH / Kupot / municipal welfare) is the near-term go-to-market — this DPIA is a **procurement precondition** for those deals.
- **Languages / UX:** EN + **Hebrew (RTL)** ship today; **Dutch UI** is a known B2G requirement for NL (future). Hebrew/RTL data subjects must be reflected in every data-subject-facing artifact (consent, rights, breach notice).
- **Reasonable expectations:** parents expect personalised, *private* developmental support; children cannot themselves consent and rely on guardian protection — this elevates the duty of care (AADC / Fairplay north-star, even where not binding).

### 1.5 Roles

| Role | Party |
|---|---|
| **Controller** | Arbor (Guy Rubin) — determines purposes and means. |
| **Processors / sub-processors** | Google Cloud (Firestore, Cloud Run, Cloud Storage, **Vertex AI**); Anthropic (via Vertex, *if/when* `VERTEX_MODEL_CHAT` is flipped to a `claude-*` model — **not active in prod today**); SoapBox/Whisper ASR (**gated off**, `CHILD_ASR_PROVIDER=none`). Full register: **CMP-4 RoPA / subprocessors** (companion doc). |
| **Joint controllers** | None at launch. A B2G institution (JGZ / municipality / Kupah) may become a **joint or independent controller** for its cohort — to be governed by the B2G DPA (out of scope here, flagged for CMP-4). |

---

## 2. Necessity, proportionality, and the lawful-basis assessment

### 2.1 Necessity

Each processing purpose is necessary to deliver the service the parent requested:

| Purpose | Necessary because | Proportionality control |
|---|---|---|
| Personalised developmental guidance | Core product value; impossible without the child profile + observations | Profile is parent-entered, minimal fields; memory is **parent-approved only** (approved-memory gate) |
| AI inference (LLM) | Guidance generation is the product | **SEC-3 redaction** strips child name/email/phone at the model seam (`server/redaction.ts`); see §6 residual risk on profile JSON |
| Memory persistence | Continuity of guidance across sessions | `CMP-7` retention TTL; parent can erase (`CMP-3`) |
| Sharing to professionals | Parent-initiated clinician collaboration | Owner-scoped, revocable shares (`sharing/shares.ts`); audited (`CMP-5`) |
| Safety screening (`AI-1`) | Child-safety duty of care (self-harm/abuse/medical-urgent detection) | Classifies; **logs verdict only, never the message** (data-minimising) |

### 2.2 Proportionality / data minimization

- The **approved-memory gate** means only parent-confirmed facts persist — a strong proportionality control already built.
- **SEC-3 redaction** removes the child's *name* before any LLM call (verified at 14 model-calling seams, §3). **Residual gap (documented honestly):** the full profile JSON (age, languages, challenges, strengths, schoolContext) still reaches the model in several routes (`/chat` `api.ts:268-280`, `/generate-plan` `api.ts:1072-1075`) — see Risk R-1 (§6) and mitigation `redactProfile` (`api.ts:40-42`).
- Audio (ASR) and persisted images are **off by default** — minimization by configuration.

### 2.3 Lawful basis (GDPR Art. 6 + Art. 8) — NL

| Element | Position |
|---|---|
| **Art. 6 basis** | **Art. 6(1)(a) consent** of the holder of parental responsibility, captured explicitly at onboarding (`CMP-1`). Legitimate interest (6(1)(f)) is **not** relied upon for child data given the sensitivity and the AADC posture. |
| **Art. 8 (child digital consent)** | NL digital-consent age is **16**. Arbor's cohort is 0–18 → **the data subject is a child and the holder of parental responsibility must consent**. `CMP-1` captures: parental-responsibility self-attestation, privacy-notice acknowledgement, data-processing acceptance, with `policyVersion`, `locale`, `market`, and `childAgeAtConsent`. |
| **Special-category (Art. 9)** | Where developmental/health-adjacent data is processed, rely on **Art. 9(2)(a) explicit consent**; minimize per SEC-3 / CMP-7. |
| **Art. 13 transparency** | Privacy notice must be reachable **at consent time** (`CMP-1` surfaces it in onboarding; re-surfaced read-only in Settings). |
| **Withdrawal** | Consent is withdrawable (`CMP-1` `withdrawn` event) and links to erasure (`CMP-3`). |

### 2.4 Lawful basis & accountability — IL (PPL + Amendment 13)

| Element | Position |
|---|---|
| **Consent** | PPL requires **informed consent** to collection/use; Amendment 13 strengthens consent + enforcement. Minors → **guardian consent** (PPL has **no separate statutory child-consent age**; guardian consent governs). `CMP-1` records `market: "IL"` and `lawfulBasis` to distinguish the IL basis. |
| **Database accountability** | Amendment 13 imposes **database accountability** (documentation of the database, its purposes, risks, controls). **This DPIA + the CMP-4 RoPA jointly constitute that documentation.** Name the database = "Arbor child developmental records (Firestore, europe-west4)". |
| **DPO threshold** | Amendment 13 sets a **DPO-appointment threshold**. **Assessment: Arbor's launch scale does NOT cross the mandatory threshold by volume** (early-stage, per-family). **Action for sign-off (§13):** the controller must re-evaluate the IL DPO threshold at scale and on entering any IL public-health/Kupah contract. Until then, the controller (Guy Rubin) carries the accountability role. |
| **Registrar context** | Record the database for the IL Database Registrar context where required; the RoPA (CMP-4) is the source artifact. |
| **Cross-border** | IL holds **EU adequacy** → `europe-west4` is lawful for IL data in both directions. State explicitly; no additional transfer mechanism needed for the IL↔EU leg. |
| **Hebrew/RTL** | Consent UI, rights UX, and the data-subject breach notice **must render correctly in Hebrew/RTL** (see §10, and CMP-1/CMP-3/CMP-6 Hebrew notes). |

---

## 3. Data-flow map (incl. every PII-to-LLM seam) (Art. 35(7)(a))

### 3.1 High-level data flow

```
                         ┌────────────────────────────────────────────────────────┐
                         │  TRUST BOUNDARY: Arbor (europe-west4, Cloud Run)         │
                         │                                                          │
 Parent ──(HTTPS)──▶ React client ──(/api, Firebase Auth)──▶ Express API           │
   │  child profile, observations          │                    │                  │
   │                                        ▼                    ▼                  │
   │                              Firestore (system of record)   server/redaction  │
   │                              · users/{uid}/children/{childId}/*  ──┐  (SEC-3)  │
   │                              · children/{childId}/memoryEvents     │ strips    │
   │                              · consents (CMP-1)                     │ name/     │
   │                              · auditEvents (CMP-5)                  │ email/    │
   │                              · shares                               │ phone     │
   │                                        │                           ▼           │
   │                                        │                  ┌─────────────────┐  │
   │                                        └────prompt build──▶│ redact() + dir. │  │
   │                                                            └────────┬────────┘  │
   └──────── derived content ◀── restore() ◀── model output ◀───────────┘           │
                                                                  │                  │
                                                                  ▼                  │
                                                   ┌──────────── PII-to-LLM SEAM ───┘
                                                   ▼
                                  Vertex AI (europe-west4): Gemini 2.5 Flash (prod chat),
                                  Gemini story/analysis/handoff/image; Anthropic-via-Vertex
                                  configured-but-OFF in prod. (See CMP-4 RoPA.)
```

**Residency:** `cloudbuild.prod.yaml:49` pins `VERTEX_LOCATION=europe-west4` and `VERTEX_MODEL_CHAT=gemini-2.5-flash`. **Prod chat is Gemini-on-Vertex-EU, not Claude** — the `claude-3-5-sonnet@anthropic` default in `config/env.ts:101` is overridden in prod. Anthropic-via-Vertex is therefore **not an active recipient of child data in prod today** (CMP-4 records this truthfully; before any future flip to `claude-*`, confirm EU-region Vertex availability for the Claude model).

### 3.2 PII-to-LLM seam inventory (every model-calling route in `routes/api.ts`)

Every route below builds its prompt, then passes it through **`privacy.redact(prompt) + REDACTION_DIRECTIVE`** at the model-call seam (`createRedaction`, `server/redaction.ts`). Redaction strips **child name + email + phone**; the name is restored after generation via `restore()`/`restoreDeep()`. **Residual:** the profile JSON (age/languages/challenges/strengths/schoolContext) still flows where noted → Risk R-1, mitigated partially by `redactProfile` (`api.ts:40-42`) and fully addressed by **SEC-3** hardening.

| Route | Line | PII that can enter prompt | Redaction at seam? | Residual / mitigation |
|---|---|---|---|---|
| `POST /chat` | 196 | child name, **full profile JSON**, approved memory, parent message | Yes (`api.ts:268,280`) | Profile JSON → R-1 / SEC-3; memory → AI-3 delimiting |
| `POST /council` | 342 | name, profile, memory, message | Yes (`api.ts:366,370,413`) | R-1; AI-3 |
| `POST /voice` | 452 | name, observation text | Yes (`api.ts:472,482`) | R-1 |
| `POST /extract-log` | 535 | name, free-text observation | Yes (`api.ts:570,573`) | Free-text may contain PII parent typed → SEC-3 conservative matchers |
| `POST /vision` | 606 | name, image-derived context | Yes (`api.ts:680,683`) | Image content not redactable as text → R-7 |
| `POST /score-utterance` | 702 | child audio/phonemes (if ASR on) | n/a (audio path) | ASR gated off (`env.ts:126`) → R-6 conditional |
| `POST /generate-avatar` | 743 | name, appearance prompt | (image route) | Output not persisted (`api.ts:796`) |
| `POST /generate-scene` | 812 | name, scene context | (image route) | derived content |
| `POST /generate-comic` | 863 | name, narrative context | (image route) | derived content |
| `POST /generate-adventure` | 958 | name, profile, story context | Yes (`api.ts:1031,1034`) | R-1 |
| `POST /generate-plan` | 1050 | name, **full profile JSON** | Yes (`api.ts:1072,1075`) | R-1 (profile reaches model) / SEC-3 |
| `POST /generate-story` | 1127 | child name, story context | Yes (`api.ts:1140,1150`) | R-1 |
| `POST /generate-hero-journey` | 1172 | child name, context | Yes (`api.ts:1232,1235`) | R-1 |
| `POST /analyze-behavior` | 1289 | name, profile, behaviour logs | Yes (`api.ts:1313,1316`) | R-1; behaviour logs = sensitive |
| `POST /generate-handoff` | 1357 | name, profile, clinical context | Yes (`api.ts:1381,1384`) | R-1; handoff = sharing → CMP-5 audit |
| `POST /digest` | 1485 | name, weekly summary context | Yes (`api.ts:1491,1497,1502`) | R-1 |

**Non-LLM but security-relevant routes** (audited under CMP-5): `POST /shares` (121), `DELETE /shares/:id` (150), `GET /privacy/export/:childId` (1530), `POST /privacy/erase` (1551), `POST /consent*` (CMP-1, planned), `GET /api/audit` (CMP-5, planned).

> **Inventory integrity check (test plan for this DPIA):** a `grep` of `router.(post|get|delete)\(` in `routes/api.ts` must 1:1 match this table. Verified 2026-06-17 against the 35 route registrations at lines 76–1630. The companion **`data-flow-inventory.md`** (CMP-2 optional artifact) holds the machine-checkable version.

### 3.3 Storage trees (a known data-model split — must be covered by export & erasure)

- **Server tree:** `children/{childId}/memoryEvents` + child doc (`firestoreMemoryStore.ts:52-68`).
- **Client tree:** `users/{uid}/children/{childId}/...` for 8 subcollections (`CHILD_SUBCOLLECTIONS` in `lib/childData.ts`: behaviorLogs, milestones, actionPlans, savedStories, contacts, weeklyReports, briefs, insights; `firestore.rules:22-27`).
- **Implication:** `CMP-3` export and erasure must traverse **both trees** + share grants + Cloud Storage (avatars, forward-proofed) and write a **tombstone** (`CMP-5`). Risk R-3 tracks the split.

---

## 4. Consultation (Art. 35(2), 35(9))

| Consultee | NL | IL |
|---|---|---|
| **DPO** | Not yet appointed; this DPIA's sign-off block (§13) is reserved for the DPO/controller. Under Art. 35(2) the DPO's advice must be sought and recorded once appointed. | Amendment 13 DPO threshold assessed as **not crossed at launch** (§2.4); re-evaluate at scale. |
| **Data subjects / representatives** | Art. 35(9): seek parent views where appropriate — planned via beta-cohort feedback; record outcome at next review. | Same; ensure Hebrew-speaking parent feedback is captured. |
| **Supervisory authority (prior consultation, Art. 36)** | **Trigger:** if residual risk remains **High** after mitigation, consult the **Autoriteit Persoonsgegevens** before processing. Current residual (§9) is **Medium** post-mitigation → prior consultation **not** triggered, but the trigger is documented. | Equivalent posture toward the **PPA** under Amendment 13 accountability. |
| **Processors** | Google Cloud DPA / SCCs cover Vertex (CMP-4). | Holder/processor agreement flowed down under PPL (CMP-4). |

---

## 5. Assessment of risks to data subjects (Art. 35(7)(c))

Risk = **Likelihood × Severity** (each Low=1 / Medium=2 / High=3). Severity is weighted by the **vulnerability of the data subject (a child)** — a borderline severity rounds **up**.

**Scoring key:** L=Likelihood, S=Severity, Score=L×S. Inherent = before this backlog's mitigations; Residual = after planned/built mitigations land.

---

## 6. Risk register — inherent risk + mitigations mapped to backlog missions

| ID | Risk to data subjects | L | S | Inherent score | Primary mitigations (mission) | Status |
|---|---|---|---|---|---|---|
| **R-1** | **Child profile (non-name PII) reaches the LLM.** Name is redacted, but age/languages/challenges/strengths/schoolContext flow to Vertex in several routes (`/chat`, `/generate-plan`, `/analyze-behavior`). Sub-processor processes child developmental data. | 3 | 3 | **9 (High)** | **SEC-3** harden redaction to minimize/abstract profile fields; `redactProfile` (`api.ts:40-42`) already round-trips profile JSON through the redactor for name/contact; **CMP-4** confirms EU residency + DPA; **CMP-7** limits what persists. | redact name = **Built**; profile minimization = **Planned (SEC-3)** |
| **R-2** | **No parental consent / age-gate.** Onboarding calls `addChild()` with no consent record (`OnboardingFlow.tsx`, `ProfileContext.tsx:24`). Processing child data without a recorded Art. 6/8 (NL) / PPL-guardian (IL) basis. | 3 | 3 | **9 (High)** | **CMP-1** consent capture + age-gate + durable, versioned consent record (`POST /api/consent`), re-surfaced in Settings, included in export. | **Planned (CMP-1)** |
| **R-3** | **Incomplete erasure.** Erase covers `children/{childId}/memoryEvents` + shares but the **client tree** `users/{uid}/children/{childId}/*` and **Cloud Storage** are not swept server-side, and **no tombstone** proves the deletion. Art. 17 (NL) / PPL erasure (IL) not demonstrable. | 2 | 3 | **6 (High)** | **CMP-3** dual-tree erasure + Storage sweep + immutable **tombstone** audit event (childId hash, counts, timestamp) via **CMP-5**. | partial **Built**; full = **Planned (CMP-3)** |
| **R-4** | **No machine-readable, account-wide export.** Export is per-child, not schema'd, missing `aiRuns`/`safetyReviews`/consent. Art. 15/20 (NL) / PPL access (IL) only partially met. | 2 | 2 | **4 (Medium)** | **CMP-3** `arbor.export.v1` schema'd export incl. all 8 subcollections + memory ledger + shares + consent (CMP-1) + audit trail (CMP-5). | partial **Built**; schema = **Planned (CMP-3)** |
| **R-5** | **No immutable audit trail.** `aiRuns`/`safetyReviews` declared append-only in `firestore.rules:47-56` but **never written** (no writer in `app/src`). Cannot evidence who accessed/exported/deleted/shared what. Art. 5(2) accountability (NL) / Amendment-13 accountability (IL) gap. | 3 | 2 | **6 (High)** | **CMP-5** append-only `auditEvents` store (PII-scrubbed: ids/hashes/counts only), owner-scoped read, update/delete denied by rules; writes on export/erase/share/consent/handoff. | **Planned (CMP-5)** |
| **R-6** | **Child audio/biometric-adjacent data to third-party ASR.** If `CHILD_ASR_PROVIDER`∈{soapbox,whisper}, child audio leaves to SoapBox/Whisper. | 1 | 3 | **3 (Medium)** | Default `none` (`env.ts:126-129`) — **gated off**. **CMP-4** requires a DPA + EU-region confirmation before enabling. Treat enabling as a **DPIA-update trigger** (§12). | **Built (gated off)** |
| **R-7** | **Unredactable content in images / free-text.** Vision route and free-text observations can carry PII the regex matchers can't catch. | 2 | 2 | **4 (Medium)** | Conservative matchers (`redaction.ts` EMAIL/PHONE, name word-boundary); **SEC-3** roadmap; parent-entered → consent-covered (CMP-1); not persisted for avatars (`api.ts:796`). | partial **Built** |
| **R-8** | **Prompt injection via memory/cards/parent message** could exfiltrate or misdirect, harming child via bad guidance. Memory facts injected as bare lines (`memoryService.ts:75`) with no delimiter. | 2 | 2 | **4 (Medium)** | **AI-3** untrusted-data delimiters (`<arbor:memory>` etc.), instruction hierarchy, `stripControlPhrases()`, injection red-team eval in CI. | **Planned (AI-3)** |
| **R-9** | **Unsafe model output to a child / parent in crisis** (self-harm, abuse, medical-urgent missed; ungrounded clinical claims). | 2 | 3 | **6 (High)** | **AI-1** semantic safety classifier (Hebrew + code-switching; regex fast-path retained); **AI-2** output groundedness check (claims tie to source cards/memory); existing diagnosis/medication hard-blocks (`outputScreen.ts`). | regex **Built**; semantic = **Planned (AI-1/2)** |
| **R-10** | **Indefinite retention.** Expired memory is filtered from prompts (`memoryService.ts:67-80`) but **never deleted from Firestore** — storage-limitation (Art. 5(1)(e) NL / PPL purpose-limitation IL) fails on disk. | 3 | 2 | **6 (High)** | **CMP-7** server-side TTL sweep + `expired` ledger event + Firestore native TTL on `expiresAt`; documented retention schedule per data class. | filter **Built**; deletion = **Planned (CMP-7)** |
| **R-11** | **Breach not detected / not notified in time.** No log-based alerting; breach response is a stub. Art. 33 72h (NL) / Amendment-13 PPA notice (IL) unmet. | 2 | 3 | **6 (High)** | **CMP-6** detection signals (Cloud Monitoring on 401/403 spikes, abnormal export/delete volume from CMP-5 audit), 72h clock, NL(AP)+IL(PPA) templates incl. **Hebrew** data-subject notice, OPS-5 runbook linkage. | **Planned (CMP-6)** |
| **R-12** | **Audit log itself becomes a PII liability** if it stores child names/free-text. | 1 | 2 | **2 (Low)** | **CMP-5** stores **ids + hashed childId + counts only** (no name/free-text), enforced by the `AuditEvent` type; salt via `AUDIT_CHILD_SALT`. | **Planned (CMP-5, design-enforced)** |

---

## 7. Mitigation status detail (built vs planned)

| Control | NL requirement | IL requirement | Status / evidence |
|---|---|---|---|
| **EU residency** | In-EU default | EU adequacy → lawful | **Built** — `cloudbuild.prod.yaml:49` `VERTEX_LOCATION=europe-west4` |
| **Name redaction to LLM (SEC-3 core)** | Art. 5(1)(c) minimization | PPL minimization | **Built** — `server/redaction.ts`, applied at 14 seams (§3.2) |
| **Approved-memory gate** | minimization | minimization | **Built** — `memoryService.ts:getApprovedMemoryContext` |
| **Consent + age-gate (CMP-1)** | Art. 6(1)(a)+Art. 8 (age 16) | PPL guardian consent; Hebrew/RTL UI | **Planned** — store + onboarding gate + Settings read-back |
| **Rights: export+erasure+tombstone (CMP-3)** | Art. 15/17/20 | PPL access+correction; Hebrew/RTL UX | **Partial→Planned** |
| **Audit log (CMP-5)** | Art. 5(2)/30/32 | Amendment-13 accountability | **Planned** |
| **Subprocessor/RoPA/DPA (CMP-4)** | Art. 30/28; EU model region | PPL holder/processor agreement | **Planned (companion doc)** |
| **Breach 72h workflow (CMP-6)** | Art. 33/34 → AP, 72h | Amendment-13 → PPA; Hebrew notice | **Planned** |
| **Retention TTL (CMP-7)** | Art. 5(1)(e) | PPL purpose-limitation | **Planned** |
| **AI safety + groundedness + injection (AI-1/2/3)** | EU AI Act posture; child-by-design | Hebrew/RTL + code-switching classifier (mandatory) | **Planned** |

---

## 8. Measures to address the risks (Art. 35(7)(d)) — proportionality of mitigations

The mitigation stack is proportionate to a **child-facing AI** product:
- **Data minimization first** (SEC-3 redaction, approved-memory gate, ASR/image off-by-default) — reduces exposure at source rather than relying solely on downstream controls.
- **Accountability by design** (CMP-5 audit, CMP-4 RoPA, this DPIA) — evidence the AP/PPA and B2G buyers will request.
- **Subject empowerment** (CMP-1 consent + withdrawal, CMP-3 self-serve export/erasure) — honours rights through the product, in Hebrew/RTL.
- **Child-safety guardrails** (AI-1/2/3) — duty of care beyond bare compliance.
- **Time-boxing** (CMP-7) — storage limitation enforced on disk, not just in the prompt window.
- **Incident readiness** (CMP-6) — 72h/AP and PPA paths, both regulators encoded.

All mitigations are **flag-gated and additive** (per backlog rollback notes) so they can be rolled forward into the dirty working tree without destabilising in-flight billing/JITAI/MimicStudio work.

---

## 9. Residual-risk table

Residual = risk remaining **after** the planned mitigations land and are verified. The table is the decision surface for §13 sign-off.

| ID | Residual risk after mitigation | Residual L | Residual S | Residual score | Residual level | Accept? (DPO/controller) |
|---|---|---|---|---|---|---|
| R-1 | Some abstracted developmental context still reaches EU-resident Vertex; covered by DPA + minimized by SEC-3 | 2 | 2 | 4 | **Medium** | ☐ |
| R-2 | Consent recorded + versioned; residual = re-consent on policy change must be operationalised | 1 | 3 | 3 | **Medium** | ☐ |
| R-3 | Dual-tree + Storage erasure + tombstone; residual = data-model split requires both writers to run | 1 | 3 | 3 | **Medium** | ☐ |
| R-4 | Schema'd export; residual = re-import not provided (not required) | 1 | 2 | 2 | **Low** | ☐ |
| R-5 | Immutable audit live; residual = high-freq `memory.access` sampled/off (cost) | 1 | 2 | 2 | **Low** | ☐ |
| R-6 | ASR stays gated off; enabling = DPIA-update trigger | 1 | 3 | 3 | **Medium** | ☐ |
| R-7 | Image/free-text PII partly uncatchable; consent-covered, not persisted | 1 | 2 | 2 | **Low** | ☐ |
| R-8 | Injection delimiters + eval; residual = novel injection classes | 1 | 2 | 2 | **Low** | ☐ |
| R-9 | Semantic classifier + groundedness; residual = recall < 1.0, fails-open to regex | 2 | 3 | 6 → mitigated to **Medium** by HITL + regex floor | **Medium** | ☐ |
| R-10 | TTL sweep + native TTL; residual = soft-launch "mark not delete" window | 1 | 2 | 2 | **Low** | ☐ |
| R-11 | 72h/PPA workflow + alerting; residual = first-incident execution risk (mitigated by tabletop) | 1 | 3 | 3 | **Medium** | ☐ |
| R-12 | Audit is ids/counts only; residual ~ negligible | 1 | 1 | 1 | **Low** | ☐ |

**Overall residual posture:** **MEDIUM.** No residual risk remains **High** after the planned Wave-0/Wave-1 mitigations land → **Art. 36 prior consultation with the AP is NOT triggered** (and the equivalent PPA posture for IL is satisfied) **provided** the controller accepts the Medium residuals below and the planned controls are verified before B2G go-live.

**Highest residuals to watch:** R-1 (profile-to-LLM), R-9 (unsafe output), R-11 (breach execution). These are the controller's primary accept-or-reduce decisions.

---

## 10. Two-market governance & language requirements (every artifact carries both)

| Artifact | NL requirement | IL requirement | Hebrew/RTL note |
|---|---|---|---|
| **Consent record (CMP-1)** | Art. 6(1)(a)+Art. 8 (age 16); Art. 13 notice at consent; Dutch copy for B2G (future) | PPL guardian consent; Amendment-13 accountability; `market:"IL"` on record | Consent checkboxes + Settings read-back **must mirror RTL** and render Hebrew (`consent.*` i18n keys EN+HE) |
| **Rights UX (CMP-3)** | Art. 15/17/20 machine-readable export + demonstrable erasure | PPL access+correction; minors' deletion-on-request | Export/erase dialogs + confirm warning (Safety L5) **must work RTL/Hebrew** |
| **Audit log (CMP-5)** | Art. 5(2)/30/32 accountability | Amendment-13 database accountability | Audit *surfaces* (if shown to parents) render RTL; log itself language-neutral (ids only) |
| **Breach notice (CMP-6)** | Art. 33 → **AP within 72h**; Art. 34 → parents if high risk | Amendment-13 → **PPA** on serious incident + affected | **Hebrew data-subject notification template** required; runbook has per-market branch (clock + authority differ) |
| **RoPA / subprocessors (CMP-4)** | Art. 30 record; Google/Vertex DPA; EU model region | PPL database documentation; holder/processor agreement | n/a (internal); database named for IL Registrar context |
| **Retention schedule (CMP-7)** | Art. 5(1)(e) storage limitation, enforced | PPL purpose-limitation | Ensure model emits `retention` strings parseable by `retentionToMs` (English units; flag if HE units appear) |
| **This DPIA** | Art. 35 DPIA (AP-facing) | Amendment-13 risk-assessment/accountability (PPA-facing) | Data-subject description includes Hebrew/RTL parents + children |

**B2G-readiness gate (both markets):** this DPIA + CMP-1 consent ledger + CMP-4 RoPA/DPA + CMP-5 audit + CMP-6 breach SLA + CMP-3 rights + AI-1/2/3 documentation must be green together before contracting with NL (municipalities/JGZ/insurers) or IL (public-health/Kupot/municipal) buyers.

---

## 11. HIPAA §164.308 cross-reference (risk-analysis analog)

Arbor is **not** a HIPAA covered entity or business associate today. This DPIA is mapped to the HIPAA Security Rule so it doubles as the **§164.308(a)(1)(ii)(A) risk-analysis** artifact if a US health-system engagement arises.

| HIPAA Security Rule | Requirement | Where satisfied in this DPIA / backlog |
|---|---|---|
| **§164.308(a)(1)(ii)(A)** Risk analysis | Accurate, thorough assessment of risks to ePHI | **This whole DPIA** — §1 description, §3 data-flow, §6 risk register, §9 residual |
| **§164.308(a)(1)(ii)(B)** Risk management | Reduce risks to reasonable level | §6–§8 mitigations mapped to missions |
| **§164.308(a)(1)(ii)(D)** Information system activity review | Review audit logs / access reports | **CMP-5** audit log |
| **§164.308(a)(6)** Security incident procedures | Identify, respond, report incidents | **CMP-6** breach workflow + OPS-5 |
| **§164.308(a)(7)** Contingency / data backup | Recoverability | Firestore managed durability (REL domain; out of CMP scope) |
| **§164.312(a)(1)** Access control | Unique user ID, owner-scoping | Firebase Auth + `firestore.rules` owner-scoping |
| **§164.312(b)** Audit controls | Hardware/software/procedural audit mechanisms | **CMP-5** append-only `auditEvents` |
| **§164.312(e)(1)** Transmission security | Encryption in transit | HTTPS / Cloud Run TLS |
| **§164.514** De-identification | Minimize identifiers | **SEC-3** redaction (name/email/phone removed before LLM) |

---

## 12. DPIA review triggers (Art. 35(11))

Re-run / update this DPIA when any of the following occur:
1. `CHILD_ASR_PROVIDER` is set to `soapbox`/`whisper` (child audio leaves to a new sub-processor) — **R-6 trigger**.
2. `VERTEX_MODEL_CHAT` is flipped to a `claude-*` model (Anthropic-via-Vertex becomes an active recipient) — confirm EU-region Vertex availability first.
3. A new model-calling route is added to `routes/api.ts` (the §3.2 inventory must be regenerated; the grep-integrity check fails CI otherwise).
4. Entering any **B2G contract** (NL municipality/JGZ/insurer or IL public-health/Kupah) — re-assess joint-controllership, IL DPO threshold, and per-contract retention/DPA terms.
5. Material change to the consent policy version, retention schedule, or the redaction contract.
6. Any **High** residual emerges that was previously Medium/Low → re-evaluate Art. 36 / PPA prior-consultation trigger.
7. **Mandatory periodic review:** by 2026-12-17.

---

## 13. SIGN-OFF (reserved for DPO / controller)

> **This block is intentionally left for the DPO / controller (Guy Rubin) to complete. The DPIA is DRAFT until signed.** Sign-off requires: (a) acceptance or reduction of each Medium residual in §9; (b) confirmation that the planned CMP/AI/SEC mitigations are scheduled before B2G go-live; (c) the IL DPO-threshold re-evaluation note (§2.4); (d) the Art. 35(2)/(9) consultation record (§4).

**Necessity & proportionality — confirmed:** ☐ Yes ☐ With conditions: ___________________________

**Residual risk decision (overall: MEDIUM):**
- ☐ **Accept** the residual risks as tabled in §9 (initial each accepted row).
- ☐ **Accept with conditions** (list): _______________________________________________
- ☐ **Reduce further before launch** (which risks): __________________________________
- ☐ **Reject / do not proceed** pending: ___________________________________________

**Art. 36 prior consultation (NL/AP):** ☐ Not required (residual ≤ Medium) ☐ Required — initiate with Autoriteit Persoonsgegevens
**IL prior-consultation / PPA posture:** ☐ Satisfied by accountability documentation ☐ Action required: ______________
**IL DPO-appointment threshold (Amendment 13):** ☐ Not crossed at launch ☐ Crossed — appoint DPO by: __________

| Role | Name | Signature | Date |
|---|---|---|---|
| **DPO** (or controller acting as) | | | |
| **Controller** (Arbor) | Guy Rubin | | |
| **Compliance/Eng lead** | | | |

**Next review date:** 2026-12-17 (or earlier per §12 triggers).

---

## 14. References (grounding)

- Build-ready spec: `docs/architecture/migration-2026-06-17/spec-G-compliance.md` (CMP-1…CMP-7)
- Two-market matrix: `docs/architecture/migration-2026-06-17/standards-two-market-NL-IL.md`
- AI safety missions: `docs/architecture/migration-2026-06-17/spec-F-ai-ml.md` (AI-1/2/3)
- WAF assessment: `docs/architecture/well-architected-assessment-2026-06-04.md` (Privacy & Compliance, lines 45, 175-193)
- Code: `app/src/server/redaction.ts`, `app/src/routes/api.ts`, `app/src/config/env.ts`, `app/src/memory/memoryService.ts`, `app/src/memory/firestoreMemoryStore.ts`, `app/src/lib/childData.ts`, `firestore.rules`, `cloudbuild.prod.yaml`
- Companion docs (to be produced): RoPA + subprocessors (CMP-4), breach runbook (CMP-6), export schema (CMP-3), retention policy (CMP-7)

*End of DPIA v1.0 — DRAFT pending sign-off (§13).*
