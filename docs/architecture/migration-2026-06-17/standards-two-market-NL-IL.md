# Arbor — Two-Market Standards Matrix (NL + IL)

**Date:** 2026-06-17
**Author:** Privacy/Compliance Counsel + Standards Architect (advisory)
**Scope:** The compliance/standards bar the Arbor migration must satisfy to launch in **the Netherlands (NL)** and **Israel (IL)** as first-class markets, for a **child-facing AI developmental product**.
**Mission ID source:** [`docs/architecture/enhancement-backlog-waf-2026-06-04.md`](../enhancement-backlog-waf-2026-06-04.md) (domains OPS / SEC / REL / COST / AI / CMP).

---

## How to read this matrix

- Every area is specified **per market**. "Same baseline" still means *evidence must be produced in each jurisdiction's language and authority frame.*
- **B2G gate = Yes** means: this control is a **precondition to selling to municipalities / JGZ-consultatiebureau / schools / insurers (NL) and public-health / Kupot / municipal welfare buyers (IL)**. Failing it doesn't just risk a fine — it loses the deal at procurement/security-review.
- Residency baseline for **both** markets is met today: data + models in **`europe-west4`**. Israel holds an **EU adequacy decision**, so EU residency is lawful for IL data; NL is in-EU by default. Residency is therefore *not* the differentiator — **governance, language, and B2G hardening are.**

---

## Market posture summary

| Dimension | Netherlands (NL) | Israel (IL) |
|---|---|---|
| Primary law | GDPR + Dutch **UAVG** (implementing act); supervised by **Autoriteit Persoonsgegevens (AP)** | **Privacy Protection Law (PPL)** as amended by **Amendment 13** (in force Aug 2025); supervised by **PPA (Privacy Protection Authority)** |
| Children regime | GDPR Art. 8 — NL digital-consent age **16** | PPL — no separate child-consent age; **parental/guardian consent** governs minors; child data treated as heightened-sensitivity in practice |
| Residency | In-EU (`europe-west4`) ✓ | **EU adequacy** → `europe-west4` lawful ✓ |
| Language/UX bar | EN/HE today; **Dutch UI is a future B2G requirement** (public-sector buyers expect NL) | **Hebrew + RTL already partly shipped** → safety classifier, consent, audit, erasure UX must all work in **Hebrew + code-switching, RTL** |
| Breach clock | **72h** to AP (+ data-subject notice if high risk) | **Amendment 13**: notify **PPA** and affected on a serious security incident; documented breach-response duty |
| North-star (not strictly in-scope) | UK **AADC**, **Fairplay**, **COPPA-2026** as design north-star for child-by-design | Same north-star; plus Hebrew-first child-safety classification |

---

## The matrix

### 1. Lawful basis & consent

| | Detail |
|---|---|
| **NL** | GDPR **Art. 6** (basis) + **Art. 8** (child digital consent, NL age **16** → parent/guardian consent required for the target child cohort). Consent must be specific, informed, freely given, withdrawable; consent record per family surfaced in onboarding. Dutch-language consent copy needed for B2G. |
| **IL** | **PPL consent** (informed consent to collection/use; Amendment 13 strengthens consent + enforcement). Minors → **parental/guardian consent**. Consent flow + record must render correctly in **Hebrew/RTL**. |
| **Missions** | **CMP-1** (consent capture + age-gate), **CMP-4** (purpose/processing record). |
| **B2G gate** | **Yes** — public buyers will not contract without demonstrable lawful basis + consent ledger. |
| **Differs by market** | Yes: NL has a hard **Art. 8 age-16** gate; IL has no statutory child-consent age but requires guardian consent + Hebrew/RTL consent UX. |

### 2. DPIA / risk-analysis duty

| | Detail |
|---|---|
| **NL** | **DPIA effectively mandatory** — children + profiling + AI on the AP's "likely high risk" list (GDPR **Art. 35**). Must cover PII-to-LLM data flows, residual-risk sign-off; AP may expect to see it at B2G due diligence. |
| **IL** | Amendment 13 introduces a **risk-assessment / database-accountability** duty (DPO-led where threshold met). Functionally an IL-flavored DPIA: document the database, purposes, risks, and controls. |
| **Missions** | **CMP-2** (DPIA / §risk-analysis analog), feeding **SEC-3** (PII redaction), **AI-1/2/3** (AI risk controls). |
| **B2G gate** | **Yes** — JGZ/municipal/insurer security reviews request the DPIA; IL public buyers expect the accountability assessment. |
| **Differs by market** | Mostly shared artifact; produce **one DPIA with an NL (AP/Art.35) section and an IL (Amendment-13 accountability) section**. |

### 3. Data residency & subprocessor / DPA

| | Detail |
|---|---|
| **NL** | In-EU (`europe-west4`) ✓. Need **Art. 30** records of processing + **Art. 28 DPA** with Google/Vertex and **Anthropic (via Vertex)**; confirm model region = EU; subprocessor list maintained. |
| **IL** | **EU adequacy** makes `europe-west4` lawful for IL data. PPL requires the database be registered/accountable and that **outsourced processing (Vertex/Anthropic) sit under a data-processing/holder agreement** with security obligations flowed down. |
| **Missions** | **CMP-4** (Art. 30 + DPA, EU model region), supported by **SEC-9** (CMEK option for institutional contracts). |
| **B2G gate** | **Yes** — DPAs + EU-region attestation + subprocessor transparency are standard procurement bars in both markets. |
| **Differs by market** | Low: same EU region; NL frames it as Art. 28/30, IL as PPL holder/processor agreement. |

### 4. Breach notification

| | Detail |
|---|---|
| **NL** | GDPR **Art. 33/34**: notify **AP within 72h**; notify data subjects without undue delay if high risk. |
| **IL** | **Amendment 13**: documented **breach-response** duty — notify **PPA** and, where required, affected individuals on a serious security incident; stronger enforcement than pre-amendment regime. |
| **Missions** | **CMP-6** (breach detection → notification workflow), **OPS-5** (incident-response runbook with breach-notification trigger). |
| **B2G gate** | **Yes** — public/health buyers require a tested breach-notification SLA in the contract. |
| **Differs by market** | Yes on **clock + authority**: NL = 72h/AP (hard deadline); IL = PPA on serious incident. Runbook must encode **both timelines and both regulators**. |

### 5. Data subject rights (access / portability / erasure)

| | Detail |
|---|---|
| **NL** | GDPR **Art. 15/17/20**: self-serve access, machine-readable export (portability), and erasure across Firestore/Storage/ledger with tombstone audit. |
| **IL** | PPL **right of access + correction**; Amendment 13 strengthens subject rights and enforcement. Erasure/deletion-on-request expected for minors' data. **Rights UX must work in Hebrew/RTL.** |
| **Missions** | **CMP-3** (self-serve export + erasure; = product L1), audited by **CMP-5**. |
| **B2G gate** | **Yes** — institutions must be able to honor parent rights requests through the product. |
| **Differs by market** | Yes on **UX**: NL needs Dutch-language flows; IL needs **RTL-correct** access/export/erasure screens. Portability (Art. 20) is explicit in NL, weaker as a statutory right in IL but ship it for both. |

### 6. Children-specific design (north-star: AADC / Fairplay / COPPA-2026)

| | Detail |
|---|---|
| **NL** | Beyond Art. 8: adopt **AADC-style** defaults — data minimization, high-privacy defaults, no nudging/dark patterns toward sharing, age-appropriate transparency. AP scrutinizes child profiling. |
| **IL** | No statutory AADC equivalent, but adopt the **same child-by-design north-star**; ensure child-facing text + safety prompts are **Hebrew/RTL** native, not translated afterthoughts. |
| **Missions** | **SEC-3** (minimize child PII to model), **CMP-1** (age-gate), **AI-1/2/3** (child-safety classification incl. Hebrew + code-switching), **CMP-7** (retention minimization). |
| **B2G gate** | **Partial** — not a hard statutory gate in either market, but a strong trust/differentiator at procurement; treat as **soft gate** for school/health buyers. |
| **Differs by market** | Design north-star is **shared**; IL adds the hard requirement that the classifier and child UX are **Hebrew + RTL + code-switching** capable. |

### 7. Audit logging

| | Detail |
|---|---|
| **NL** | GDPR **Art. 5(2) accountability** + HIPAA-analog: immutable, PII-scrubbed audit log of data access, export, delete, sharing, handoff. |
| **IL** | Amendment 13 **database-accountability** → access/security logging expected as evidence of controls; surfaced for PPA on inquiry. |
| **Missions** | **CMP-5** (immutable audit log), **OPS-1** (structured PII-scrubbed logging/trace). |
| **B2G gate** | **Yes** — municipal/JGZ/insurer (NL) and public-health (IL) security reviews require audit trails; pairs with **App Check (SEC-6)** and **CMEK (SEC-9)** for the B2G bar. |
| **Differs by market** | Low: same control; IL audit/erasure surfaces must additionally render **RTL**. |

### 8. Retention

| | Detail |
|---|---|
| **NL** | GDPR **Art. 5(1)(e)** storage limitation — enforce documented retention server-side (TTL/expiry on memory `retention` field). |
| **IL** | PPL purpose-limitation / no-longer-than-necessary principle; Amendment 13 reinforces minimization + accountability. |
| **Missions** | **CMP-7** (enforce retention TTL), supported by **CMP-3** (erasure). |
| **B2G gate** | **Yes** — institutional contracts specify retention/deletion schedules. |
| **Differs by market** | Low: same principle; document a single retention schedule covering both. |

### 9. AI governance (NIST AI RMF + EU AI Act posture)

| | Detail |
|---|---|
| **NL** | EU. A **child-facing AI** system: posture under **EU AI Act** — not banned, but high-scrutiny; avoid manipulative/exploitative-of-minors practices (prohibited-practice risk), strong transparency, human oversight. Govern with **NIST AI RMF** (Govern/Map/Measure/Manage). |
| **IL** | No binding AI Act yet; adopt **NIST AI RMF** + EU AI Act as **voluntary north-star**. The **safety classifier must cover Hebrew + code-switching** (mixed HE/EN input) since RTL UI is live. |
| **Missions** | **AI-1** (semantic safety classifier — multilingual incl. **Hebrew + code-switching**), **AI-2** (output/groundedness check), **AI-3** (prompt-injection containment), **AI-5/6** (model-change eval + HITL SLA). |
| **B2G gate** | **Partial → trending Yes** — public buyers increasingly require AI risk documentation + human-oversight evidence; treat as **emerging hard gate**, especially NL/EU. |
| **Differs by market** | Yes: NL carries **binding EU AI Act** posture; IL is voluntary **but** carries the hard **Hebrew/RTL classifier** requirement. |

### 10. Clinical content standards

| | Detail |
|---|---|
| **NL** | Align developmental/parenting guidance with **Dutch JGZ** (jeugdgezondheidszorg) frameworks and **consultatiebureau** norms — the reference frame B2G health buyers trust. Avoid US-only framing in NL clinical copy. |
| **IL** | Map guidance to **Tipat Chalav / Ministry of Health** well-baby norms; content must be clinically coherent in **Hebrew**. Underlying evidence base (AAP-2022 / ASHA-2023) is acceptable but must be localized. |
| **Missions** | **AI-2** (groundedness to source cards), **AI-5** (age-fit / clinical eval suite), **OPS-6** (knowledge `framework.json` change control). |
| **B2G gate** | **Yes** — JGZ (NL) and MoH/Tipat-Chalav (IL) alignment is what makes the product credible to health-system buyers. |
| **Differs by market** | **Yes — high divergence**: clinical reference frameworks are jurisdiction-specific (JGZ vs Tipat Chalav vs US AAP/ASHA). Requires **per-market clinical content review**, not one global library. |

---

## B2G-readiness gate stack (both markets)

To sell to **NL municipalities / JGZ-consultatiebureau / schools / insurers** and **IL public-health / municipal / Kupot buyers**, the following must be green together:

1. **DPIA / risk assessment** complete (CMP-2)
2. **Consent + age-gate** ledger (CMP-1)
3. **DPA + Art.30 / EU model region** (CMP-4) + **CMEK** where contract demands (SEC-9)
4. **App Check** client attestation (SEC-6)
5. **Immutable audit log** (CMP-5) + structured logging (OPS-1)
6. **Breach-notification SLA** encoding 72h/AP **and** PPA (CMP-6 + OPS-5)
7. **Self-serve rights** access/export/erasure (CMP-3)
8. **AI risk documentation** + human oversight (AI-1/2/3/5/6)
9. **Clinical alignment** to JGZ (NL) / Tipat-Chalav-MoH (IL) (AI-2/5, OPS-6)
10. **Localization**: Dutch UI (NL future need) + Hebrew/RTL across consent/audit/erasure/classifier (IL, now)

---

## Net market-divergence callouts (where "one global build" fails)

- **Clinical content** (Area 10) — genuinely different reference frameworks per market; needs per-market review.
- **Breach clock/authority** (Area 4) — NL 72h/AP vs IL PPA; one runbook, two encoded paths.
- **Child-consent age** (Area 1) — NL hard Art.8 age-16 gate vs IL guardian-consent (no statutory age).
- **Language/RTL** (Areas 1/5/6/7/9) — IL forces Hebrew + RTL + code-switching *now*; NL forces Dutch UI for B2G *soon*.
- **AI Act posture** (Area 9) — binding in NL/EU, voluntary in IL.

Everything else (residency, DPA, audit, retention, rights mechanics) is a **shared baseline** delivered by the same missions, with jurisdiction-specific evidence framing.
