# Records of Processing (Art. 30) + Subprocessor / DPA Register — Arbor

**Mission:** CMP-4 (Wave 0, Arbor WAF migration)
**Owner:** Privacy & Compliance Lead (controller: Arbor / Guy Rubin)
**Date:** 2026-06-17
**Status:** Build-ready governance artifact. Drop-in. Replaces no code.
**Markets in scope (both first-class):** Netherlands (NL — GDPR + Dutch *AVG*, supervised by *Autoriteit Persoonsgegevens* / APg) and Israel (IL — Privacy Protection Law 5741-1981 + **Amendment 13**, in force August 2025, supervised by the Privacy Protection Authority / PPA, formerly ILITA).
**Legal sign-off required before B2G / production launch.** This document is the engineering source of truth; a DPO/lawyer must execute the DPAs and counter-sign §8.

> **Grounding discipline.** Every subprocessor, region, and model below is read from the real code/infra, not assumed:
> - `app/src/config/env.ts` (model + ASR + Firebase config)
> - `cloudbuild.prod.yaml` (the live prod env string — the `^@^…` line)
> - `firebase.json` (Hosting → Cloud Run rewrite, region pin)
> - `app/src/lib/firebase.ts` (which Firebase client SDKs init: Auth, Firestore, Storage)
> - `app/src/context/AuthContext.tsx` (auth methods: Google OAuth + Email/Password)
> - `app/src/lib/analytics.ts` (analytics is **first-party Firestore**, no third-party tracker)
> - `app/src/ai/modelRouter.ts`, `app/src/ai/claudeVertexProvider.ts` (route→model→region)
> - `app/src/lib/storage.ts` (child photo uploads under `users/{uid}/children/{childId}/photos/`)

---

## 0. The single most important truth this document records

**Prod chat is Gemini-on-Vertex-in-EU, not Claude.**

`app/src/config/env.ts:101` defaults `vertexModelChat` to `claude-3-5-sonnet@anthropic`, **but** `cloudbuild.prod.yaml` overrides it at deploy time:

```
…@VERTEX_LOCATION=${_REGION}@VERTEX_MODEL_CHAT=gemini-2.5-flash@VERTEX_MODEL_IMAGE=gemini-2.5-flash-image@…
substitutions:
  _REGION: europe-west4
```

So in production **today**:
- All four text routes (`coach_high_stakes`, `creative_low_risk`, `analysis_structured`, `handoff_structured`) and image generation resolve to **Gemini on Vertex AI in `europe-west4`**.
- **Anthropic/Claude-via-Vertex is NOT a live subprocessor in prod.** The code path exists (`ai/claudeVertexProvider.ts`, which calls `https://{vertexLocation}-aiplatform.googleapis.com/.../publishers/anthropic/models/{model}:rawPredict` — i.e. it *would* stay EU-resident), but it is dormant because `VERTEX_MODEL_CHAT` is Gemini.
- **Child ASR third parties (SoapBox Labs, Whisper) are NOT live.** `CHILD_ASR_PROVIDER` defaults to `none` (`env.ts:126-129`) and is not set in `cloudbuild.prod.yaml`, so child audio is never sent to a third party today.

The register below records **reality** (live now) separately from **gated/conditional** subprocessors so the APg/PPA and B2G buyers see the truthful current state plus the change-control gate that must fire before any dormant vendor goes live.

---

## 1. Controller identity & roles (both markets)

| Field | Value |
| :-- | :-- |
| **Controller** | Arbor (sole trader / venture of Guy Rubin) — `bguy.rubin@gmail.com` |
| **EU/NL role** | **Controller** under GDPR Art. 4(7); determines purposes & means of processing child + parent data |
| **IL role** | **Database owner / controller** under the Privacy Protection Law; Arbor's user database is a registrable database under Amendment 13 (see §6) |
| **DPO (NL)** | Not yet appointed. **Art. 37(1)(b) trigger:** core activity = large-scale, systematic processing of children's special-category-adjacent developmental data → **DPO likely required before scale launch.** Decision + appointment date to be recorded in the DPIA (`docs/architecture/dpia-2026-06-17.md`, CMP-2). |
| **DPO (IL)** | Amendment 13 introduces a **DPO (*memuneh al haganat hapratiyut*) appointment threshold.** Arbor must assess whether it crosses it (public-body customers via B2G + large-scale sensitive data on minors push toward "yes"). Record the determination in §6 + the DPIA. |
| **EU representative (Art. 27)** | Required only if Arbor has no EU establishment and offers services to EU data subjects. NL launch via local establishment/partner removes the need — **confirm with counsel**; otherwise appoint an Art. 27 representative in NL. |
| **IL representative** | Amendment 13 can require a foreign controller targeting Israeli residents to appoint a local representative — **confirm with IL counsel** given the IL-first GTM. |

---

## 2. Records of Processing Activities (RoPA) — Art. 30(1) controller record

Two processing activities cover the whole product. Both run on `europe-west4`.

### RoPA-1 — Child developmental coaching & memory (core product)

| Art. 30(1) element | Record |
| :-- | :-- |
| **(a) Controller & contact** | Arbor / Guy Rubin, `bguy.rubin@gmail.com`. DPO TBD (§1). |
| **(b) Purposes of processing** | Provide AI parenting/developmental coaching to parents about their child; persist an approved-memory ledger so guidance is personalised over time; generate plans, stories, comics, avatars, milestone tracking, and professional handoff documents. |
| **Lawful basis (NL/GDPR)** | **Art. 6(1)(a) consent** + **Art. 8 parental consent** for a child data subject (captured by CMP-1, `POST /api/consent`). Where developmental observations touch health-adjacent data, treat as **Art. 9** special category → rely on **Art. 9(2)(a) explicit consent**. No legitimate-interest basis for child data. |
| **Lawful basis (IL)** | Consent of the parent/guardian per the Privacy Protection Law; Amendment 13 guardian-consent expectations for minors. Recorded with `market:"IL"` in the consent store (CMP-1). |
| **(c) Categories of data subjects** | (1) **Children (minors, 0–18)** — the primary, vulnerable data subjects; (2) **Parents/guardians** (account holders); (3) optionally **invited professionals** (therapist/educator) who receive a shared handoff. |
| **(c) Categories of personal data** | Child: first name (redacted before any LLM call — see §5), age/birth band, languages, developmental concerns, strengths, school context, **behaviour logs**, milestones, action plans, saved stories, **uploaded photos** (`users/{uid}/children/{childId}/photos/`), generated avatar images. Parent: email, Firebase UID, auth identifier (Google account or email). Derived: approved-memory ledger facts, weekly reports, insights, AI run telemetry. |
| **Special-category note** | Developmental/behavioural observations about a child are **health-adjacent** and must be handled as Art. 9 special-category data out of caution. Children + profiling + special category = **mandatory DPIA** (Art. 35) — see CMP-2. |
| **(d) Categories of recipients** | **Subprocessors only** (see §3): Google Cloud (Firestore, Cloud Run, Cloud Storage, Vertex AI Gemini), Firebase (Auth, Hosting). **No advertising, no data brokers, no third-party analytics.** Parent-initiated share grants disclose a child's handoff to a professional the parent explicitly invites (`/api/shares`). |
| **(e) Third-country transfers** | **None outside the EU.** All compute + storage pinned to `europe-west4` (NL — Eemshaven). Vertex AI inference is EU-region. See §4. |
| **(f) Retention** | Per CMP-7 retention policy: approved-memory ledger expires per its parsed `retention` field (TTL-enforced); behaviour logs / milestones retained while the child profile is active; consent records retained for the limitation period as accountability evidence; **audit events (CMP-5) are PII-scrubbed and may be retained longer than the data they describe**. Erasure on request (CMP-3) deletes both data trees + Storage + writes a tombstone. |
| **(g) Security measures** | Firebase Auth ID-token gate on every API route; Firestore security rules (owner-scoped reads, append-only `aiRuns`/`safetyReviews`/`consents`/`auditEvents`); PII redaction at every model-call seam (`server/redaction.ts`); EU residency; planned immutable audit log (CMP-5); planned retention TTL (CMP-7); breach runbook (CMP-6). |

### RoPA-2 — Account, authentication, billing & first-party analytics

| Art. 30(1) element | Record |
| :-- | :-- |
| **(a) Controller & contact** | As RoPA-1. |
| **(b) Purposes** | Authenticate the parent (Firebase Auth — Google OAuth or email/password); operate subscription billing/entitlements (RevenueCat + Stripe-hosted checkout links, web; native iOS/Play in-app); measure feature usage + acquisition attribution via **first-party** event logging. |
| **Lawful basis (NL/GDPR)** | Auth + billing = **Art. 6(1)(b) contract**. First-party product analytics = **Art. 6(1)(f) legitimate interest** (no cross-site tracking, no third-party tags) — document the LIA; offer opt-out. |
| **Lawful basis (IL)** | Consent + necessity for service provision under the Privacy Protection Law. |
| **(c) Data subjects** | Parents/guardians (account holders). |
| **(c) Categories of data** | Email, Firebase UID, Google account identifier (if Google sign-in), session/auth tokens, subscription/entitlement state, **first-party** usage events (`users/{uid}/events`) with attribution props (market, source, utm_*, referral_code). No child data in this activity except the `childId` key linking analytics to a child profile the parent owns. |
| **(d) Recipients** | Firebase Auth (Google), RevenueCat (entitlement broker), Stripe (web checkout), Apple/Google (native in-app purchase). See §3. |
| **(e) Transfers** | Firebase Auth + Firestore EU-resident. **RevenueCat and Stripe are US-headquartered processors** → require **SCC-backed DPAs** (see §3, §8). Apple/Google IAP governed by their platform DPAs. |
| **(f) Retention** | Account data retained while the account is active + statutory billing-record retention; analytics events retained per CMP-7 retention policy. |
| **(g) Security** | Firebase Auth, signed webhooks (`REVENUECAT_WEBHOOK_AUTH`), HTTPS-only, owner-scoped Firestore rules. |

---

## 3. Subprocessor / DPA Register

Legend — **Status:** `LIVE` = receives data in prod today · `GATED` = code path exists but not enabled in prod (env-gated) · `PLANNED` = roadmap.
**Region** column is read from `cloudbuild.prod.yaml` / `firebase.json` / `env.ts`, not assumed.

### 3.1 LIVE subprocessors (receive data in production today)

| # | Subprocessor | Service / component | Purpose | Data categories received | Region (verified) | Transfer mechanism | DPA to execute | Status |
| :-: | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-: |
| 1 | **Google Cloud / Firebase** (Google Ireland Ltd / Google LLC) | **Cloud Firestore** (`firestoreDatabaseId`, `memory/firestoreMemoryStore.ts`) | Primary datastore: child profiles, behaviour logs, milestones, memory ledger, shares, consents, audit events, analytics events | All RoPA-1 + RoPA-2 personal data (child + parent) | `europe-west4` (NL). Firestore location set at DB creation — **verify the `(default)` DB is `eur3`/`europe-west4`, not multi-region `nam5`** (action §7) | EU-resident; Google Cloud DPA + EU SCCs (Module 2) | **Google Cloud Data Processing Addendum** + **Cloud Data Processing & Security Terms (CDPST)** | LIVE |
| 2 | **Google Cloud** | **Cloud Run** (`arbor-api` service; `firebase.json` rewrite pins `region: europe-west4`; `cloudbuild.prod.yaml` `_REGION: europe-west4`) | Hosts the API server (Express) that brokers all model calls + Firestore writes | All personal data transits here in-memory (not persisted by Cloud Run) | `europe-west4` (NL) | EU-resident; covered by Google Cloud DPA | Same Google Cloud DPA (#1) | LIVE |
| 3 | **Google Cloud** | **Cloud Storage** (`lib/storage.ts` → `users/{uid}/children/{childId}/photos/…`; `firebase.json` `storage.rules`) | Stores parent-uploaded **child photos** + (future) generated avatars | Child images (special-category-adjacent) | `europe-west4` (NL) — **verify bucket location** (action §7) | EU-resident; Google Cloud DPA | Same Google Cloud DPA (#1) | LIVE |
| 4 | **Google Cloud** | **Vertex AI — Gemini** (`gemini-2.5-flash`, `gemini-2.5-flash-image`; `ai/modelRouter.ts`; prod-pinned in `cloudbuild.prod.yaml`) | LLM inference for coach chat, council, plans, stories, comics, avatars, vision, scoring, handoffs (all four model routes resolve to Gemini in prod) | Redacted prompts: child **name/email/phone removed** by `server/redaction.ts`; **but full profile JSON (age, languages, challenges, strengths, school context) still sent** — see §5 residual risk | `europe-west4` (NL), pinned by `VERTEX_LOCATION` | EU-resident inference; Google Cloud DPA + Vertex AI service terms; **Google does not use Vertex prompt/response data to train its models** (Generative AI / Vertex data-governance terms) — cite in DPA | Google Cloud DPA (#1) + **Vertex AI / Generative AI service-specific terms** (confirm "no training on customer data") | LIVE |
| 5 | **Google (Firebase Authentication)** | **Firebase Auth** (`lib/firebase.ts`, `context/AuthContext.tsx`: `GoogleAuthProvider` + email/password) | Authenticates parents; issues ID tokens that gate every API route | Parent email, UID, Google account identifier, auth tokens | Google global identity infra (Auth is **not** region-pinnable like Firestore) — **document this as the one identity-data exception**; covered by Google DPA + SCCs | Google Cloud DPA + EU SCCs | Google Cloud DPA (#1) covers Firebase | LIVE |
| 6 | **Google (Firebase Hosting)** | **Firebase Hosting** (`firebase.json` `public: app/dist`; serves `$PROJECT_ID.web.app` / `.firebaseapp.com`) | Serves the static SPA + CDN; rewrites `/api/**` to Cloud Run EU | Parent IP/user-agent (CDN edge logs); no application personal data persisted | Google global CDN edge; origin compute EU | Google Cloud DPA + SCCs | Google Cloud DPA (#1) | LIVE |
| 7 | **Google (first-party analytics — NOT a third party)** | `lib/analytics.ts` writes to **the user's own Firestore** `users/{uid}/events` | Product/feature usage + acquisition attribution | Parent UID + event name + attribution props (no child PII beyond owned `childId`) | `europe-west4` (NL) — same Firestore as #1 | EU-resident; **no third-party analytics SDK, no Google Analytics/GA4, no cross-site tags** | Covered by Google Cloud DPA (#1) | LIVE |

> **Note on #7:** `lib/analytics.ts` explicitly states "no third-party scripts, no cross-site tracking." This is a **privacy strength** — record it as a differentiator for B2G procurement. There is **no** Segment/Amplitude/Mixpanel/GA pixel in the data plane.

### 3.2 GATED subprocessors (code path exists; NOT enabled in prod — must clear the change-control gate in §7 before going live)

| # | Subprocessor | Service | Purpose | Data categories | Region | Transfer mechanism | DPA to execute | Status |
| :-: | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-: |
| 8 | **Anthropic (via Google Vertex AI)** | Claude (`claude-3-5-sonnet@anthropic`) — the `env.ts:101` default, **overridden to Gemini in prod** | Would serve `coach_high_stakes` chat if `VERTEX_MODEL_CHAT` were flipped back to a `claude-*` model | Same redacted prompts as #4 | **MUST be a EU Vertex region.** `ai/claudeVertexProvider.ts` builds the URL from `vertexLocation` (→ `europe-west4`), so it would stay EU **IF** Claude is offered in `europe-west4`. **Anthropic-on-Vertex has limited regional availability — verify `europe-west4` (or another EU region) offers the chosen Claude model BEFORE flipping.** | Consumed **as a Google Cloud Vertex subprocessor** — Anthropic-on-Vertex is governed by the **Google Cloud DPA + Vertex AI terms**, not a separate Anthropic commercial DPA. If Anthropic API (direct, not via Vertex) is ever used, a **separate Anthropic DPA + zero-data-retention/SCCs** is required. | Google Cloud DPA (#1) covers Vertex-mediated Claude; **separate Anthropic DPA only if direct API used** | GATED |
| 9 | **SoapBox Labs** (kid-ASR) | `childAsrProvider:"soapbox"` (`env.ts:43,48-50`, `SOAPBOX_API_URL/KEY`) | Phoneme-level scoring of the **child's** spoken articulation | **Child audio** (biometric-adjacent, special category) | **Unverified / non-EU likely** — endpoint is operator-supplied | **BLOCKED until:** (a) EU region or SCC-backed transfer confirmed, (b) DPA signed, (c) DPIA updated. Child audio leaving the EU to a third party is a **high-risk transfer**. | **SoapBox Labs DPA + SCCs** + region confirmation | GATED (default `none`) |
| 10 | **Whisper-compatible ASR host** | `childAsrProvider:"whisper"` (`env.ts:43-47`, `WHISPER_API_URL/KEY`, OpenAI-compatible) | Fallback child articulation transcription | **Child audio** | Depends on the host configured (could be OpenAI US, a self-hosted EU endpoint, etc.) | **BLOCKED until** the concrete host is named, its region confirmed, and a DPA signed. If OpenAI API → **OpenAI DPA + US SCCs + zero-retention**. Prefer a **self-hosted EU Whisper** to avoid a US transfer of child audio. | DPA of whichever host is chosen; **default to EU self-host** | GATED (default `none`) |

### 3.3 PLANNED subprocessors (RoPA-2 billing path — confirm live status with the billing in-flight work)

| # | Subprocessor | Service | Purpose | Data categories | Region/HQ | Transfer mechanism | DPA to execute | Status |
| :-: | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-: |
| 11 | **RevenueCat, Inc.** | Unified entitlement broker (`REVENUECAT_WEBHOOK_AUTH` in `env.ts`) | Cross-platform subscription/entitlement state | Parent UID, subscription status, purchase tokens (no child PII) | US HQ | **SCC-backed DPA** required (US transfer) | **RevenueCat DPA + EU SCCs** | PLANNED/IN-FLIGHT |
| 12 | **Stripe** (Stripe Payments Europe, Ltd.) | Web hosted checkout (`BILLING_URL_*` links) + billing portal | Payment processing for web subscriptions | Parent email, payment instrument (held by Stripe, not Arbor), billing address | EU entity available (Stripe Payments Europe, Ireland) → prefer EU contracting | Stripe DPA; Stripe is an independent controller for payment data + processor for the rest | **Stripe DPA** (Stripe Payments Europe) | PLANNED/IN-FLIGHT |
| 13 | **Apple** (App Store) & **Google** (Play) | Native in-app purchase (per `MOBILE.md` Capacitor shells) | iOS/Android subscription purchase | Purchase tokens; Apple/Google hold the payment data | Apple/Google global; platform DPAs | Apple/Google platform terms + DPA | **Apple Developer + Google Play DPA** (platform-level, already accepted on enrolment — confirm) | PLANNED |

---

## 4. EU model-region confirmation (`europe-west4`)

| Evidence | Source | Confirms |
| :-- | :-- | :-- |
| `VERTEX_LOCATION=${_REGION}`, `_REGION: europe-west4` | `cloudbuild.prod.yaml` | All Vertex inference (Gemini text + image) executes in `europe-west4` (Netherlands, Eemshaven). |
| `gcpRegion`/`vertexLocation` default `europe-west4` | `app/src/config/env.ts:99-100` | Code default matches prod env — no accidental US fallback. |
| Cloud Run rewrite `region: europe-west4` | `firebase.json` (`/api/**` → `arbor-api`) | API compute is EU. |
| `ai/claudeVertexProvider.ts:67` builds `https://{vertexLocation}-aiplatform.googleapis.com/…` | source | Even the dormant Claude path is region-parametrised → stays EU **if** the model is EU-available. |
| **Both markets satisfied:** NL is in the EEA (residency native). **Israel has an EU adequacy decision** (Commission decision on Israel, upheld under GDPR) → EU-resident processing is lawful for IL data subjects **and** transfers EU↔IL are adequacy-covered. | Adequacy | **`europe-west4` is correct for both NL and IL.** No additional transfer tool needed between the EU and Israel in either direction. |

**One identity-data caveat:** Firebase **Authentication** identity records are not region-pinnable the way Firestore is. This is the single Google-global data flow; it is covered by the Google Cloud DPA + EU SCCs and carries only parent account identifiers (no child data). Record this honestly in the DPIA.

**Gemini Image C2PA/SynthID note:** generated avatar/scene images carry SynthID + C2PA provenance (`env.ts:18`) — useful for the DPIA's "automated content" transparency line; not a transfer concern.

---

## 5. PII-to-LLM seam — residual transfer/processing risk (feeds CMP-2 DPIA)

The redaction control (`server/redaction.ts`) removes **child name, email, phone** before any Vertex call and restores after. **However, the full child profile JSON — age, languages, challenges, strengths, school context — is still sent to Gemini** on several routes (e.g. `/chat`, `/generate-plan`). Because Gemini-on-Vertex is **EU-resident and contractually not used for training**, this is an *in-EU processing* risk, not a cross-border transfer risk — but it is a **residual special-category-data exposure** to a subprocessor and must appear in the DPIA risk register as **SEC-3**. Do not represent the LLM seam as "no child data reaches the model."

---

## 6. Israel — Amendment 13 database-registration & processor view (Hebrew note included)

Amendment 13 to the Privacy Protection Law (in force **August 2025**) modernises the IL regime. Arbor's obligations, mapped:

| Amendment 13 element | Arbor position | Action |
| :-- | :-- | :-- |
| **Database accountability** (registration regime narrowed but accountability + documentation broadened) | Arbor operates **one database**: the parent+child developmental dataset in Firestore. Treat this RoPA as the database documentation. | Determine whether Arbor's database still requires **registration with the Database Registrar** (the obligation now turns on sensitivity + scale; a large database of **minors' sensitive data** is the category most likely still to require registration/notification). **Confirm with IL counsel.** |
| **DPO (*memuneh*) appointment threshold** | Large-scale sensitive data on minors + (via B2G) public-body customers pushes toward "must appoint." | Make + record the determination in the DPIA and §1. |
| **Breach / serious security-incident notification** | New statutory duty to notify the **PPA** (and, for serious incidents, affected data subjects). | Implemented operationally in the **breach-response runbook (CMP-6)** with an IL branch; this register is the evidence source (subprocessor list to assess blast radius). |
| **Guardian consent for minors** | Captured by CMP-1 with `market:"IL"` and the Art.8-analog parental attestation. | Ensure the IL consent text + Settings read-back render **RTL/Hebrew** (CMP-1 i18n HE keys). |
| **Cross-border transfer** | IL↔EU covered by **EU adequacy**; `europe-west4` residency means **no onward third-country transfer** in the live path. | State adequacy reliance explicitly in IL data-processing terms with B2G buyers. |
| **Processor (*holech*) view** | Arbor is the **database owner/controller**; Google (Firestore/Vertex/Auth) is the **holder/processor** (*mahzik*). The Google Cloud DPA governs the holder relationship for IL purposes too. | Reference the Google Cloud DPA as the IL processor agreement. |

> **Hebrew note (parent/authority-facing):** Any consent text, privacy notice, breach notice, or Settings privacy read-back shown to IL parents must be authored in **Hebrew with correct RTL layout** (אבחון, ויסות, הסכמת הורים). The PPA notification template and the data-subject breach notice (CMP-6) need a Hebrew version. The database documentation submitted to the **רשם מאגרי המידע** (Database Registrar) must be in Hebrew. Engineering carries the `market:"IL"` flag + HE i18n keys; **a Hebrew-fluent reviewer/lawyer must finalise the legal wording.**

---

## 7. Verification & change-control gates (what a human/clean-baseline run must do)

These are **read-only confirmations + legal executions** — no agent can complete them; they require GCP console access, vendor portals, and counsel.

1. **Confirm Firestore `(default)` DB location** is `europe-west4` (or EU multi-region `eur3`), NOT `nam5`/US. `gcloud firestore databases describe --database="(default)"` → check `locationId`. If it is US, **this is a launch-blocking residency failure** — Firestore location is immutable post-creation and would require a new database + migration.
2. **Confirm the Cloud Storage bucket location** for `users/*/children/*/photos/*` is EU. `gsutil ls -L -b gs://<bucket>` → check `Location constraint`.
3. **Confirm Vertex `europe-west4` actually serves** `gemini-2.5-flash` + `gemini-2.5-flash-image` (it does today; record the date) — and, **before** ever flipping `VERTEX_MODEL_CHAT` back to a `claude-*` model, confirm that Claude SKU is offered in an EU Vertex region; if not, **do not flip** (it would create a non-EU inference path).
4. **Execute the Google Cloud DPA / CDPST** acceptance under the org's billing account (Admin console → legal/agreements) and retain the executed copy. Confirm **EU SCCs (Module 2)** are incorporated and **Vertex "no training on customer data"** terms apply.
5. **Keep GATED vendors gated.** Do not set `CHILD_ASR_PROVIDER`, `SOAPBOX_*`, `WHISPER_*`, or a `claude-*` `VERTEX_MODEL_CHAT` in any prod deploy until that vendor's row in §3 has DPA-signed + region-confirmed + DPIA-updated. Add a CI guard (out of scope for CMP-4, recommend to CMP-2/OPS) that fails the build if a non-EU `VERTEX_LOCATION` or an un-DPA'd ASR provider is set in prod env.
6. **Execute billing-path DPAs** (RevenueCat SCC-DPA, Stripe DPA via Stripe Payments Europe) before the billing rails go live; confirm Apple/Google platform DPAs accepted.
7. **IL database determination:** counsel confirms registration/notification obligation + DPO threshold; file Hebrew database documentation with the Registrar if required.
8. **NL:** finalise the DPIA (CMP-2) — it is **effectively mandatory** (children + profiling + special-category) and is the gate the APg expects before any municipality/JGZ/insurer B2G deal. Appoint a DPO and (if no EU establishment) an Art. 27 representative.

---

## 8. DPA execution checklist (the exact agreements to sign + where)

| Subprocessor | Exact agreement | Where to execute | Owner | Status |
| :-- | :-- | :-- | :-- | :-- |
| Google Cloud / Firebase | **Google Cloud Data Processing Addendum** + **Cloud Data Processing & Security Terms (CDPST)**, incl. **EU SCCs Module 2** | Google Cloud Console → IAM & Admin → Legal/Agreements (or accepted on Cloud Terms acceptance); Firebase Console terms | Controller + counsel | ☐ |
| Vertex AI (Gemini) | **Vertex AI / Generative AI service-specific terms** (confirm "no training on customer data" + EU data-governance) — rides the Google Cloud DPA | Google Cloud terms | Counsel | ☐ |
| Anthropic (via Vertex) | **Covered by Google Cloud DPA** while Vertex-mediated. Separate **Anthropic Commercial DPA + zero-retention** ONLY if direct Anthropic API is ever used | n/a unless direct API | Counsel | ☐ (GATED) |
| SoapBox Labs | **SoapBox Labs DPA + SCCs** + EU region confirmation | Vendor contracting | Counsel | ☐ (GATED — keep off) |
| Whisper host | DPA of the chosen host; **prefer EU self-host (no DPA/transfer)** | Depends on host | Eng + counsel | ☐ (GATED — keep off) |
| RevenueCat | **RevenueCat DPA + EU SCCs** | RevenueCat dashboard → Legal | Controller + counsel | ☐ (billing in-flight) |
| Stripe | **Stripe DPA** (contract via **Stripe Payments Europe, Ltd.**) | Stripe Dashboard → Settings → Legal/DPA | Controller + counsel | ☐ (billing in-flight) |
| Apple App Store / Google Play | Platform DPA (accepted on developer enrolment) | App Store Connect / Play Console agreements | Controller | ☐ (confirm) |

---

## 9. Cross-references

- **DPIA (CMP-2):** `docs/architecture/dpia-2026-06-17.md` — cites this register for subprocessors + the §5 residual LLM-seam risk (SEC-3). **Mandatory (NL) before B2G.**
- **Audit log (CMP-5):** PII-scrubbed `auditEvents` — the disclosure/access evidence a B2G buyer + the PPA/APg will request.
- **Retention (CMP-7):** `docs/architecture/retention-policy.md` — the retention column of RoPA-1/2.
- **Breach (CMP-6):** `docs/architecture/breach-response-runbook.md` — consumes this register to scope breach blast radius per market (NL APg / IL PPA, both 72h-class clocks, Hebrew + Dutch templates).
- **Consent (CMP-1):** `POST /api/consent` — the lawful-basis record per child, carrying `market` (NL/IL) for the lawful-basis rows above.
- **WAF assessment:** `docs/architecture/well-architected-assessment-2026-06-04.md` §"Privacy & Compliance" (CMP-4 near line 184). **Apply step:** add a link to this file there (snippet in the return).

---

*End of artifact. Engineering-complete and grounded in the real codebase + prod env as of 2026-06-17. The DPA executions in §8 and the determinations in §6–§7 require a human with GCP/vendor/console access and legal counsel — they cannot be performed by an agent.*
