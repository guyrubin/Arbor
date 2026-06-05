# Arbor — Well-Architected Enhancement Backlog

**Date:** 2026-06-04
**Source:** [Well-Architected Assessment](./well-architected-assessment-2026-06-04.md) ·
[Architecture Document](./arbor-architecture.md)
**Format:** Per-domain. Each item: ID · outcome · acceptance criteria · Severity (Sev) ·
Effort (S/M/L) · Standard. Severity drives sequencing.

> This backlog is **engineering hardening for production-readiness at cohort scale**. It is
> orthogonal to the product Capability Backlog (`docs/arbor-enhancement-backlog-v*.md`),
> which tracks parent-facing features. Where they overlap (e.g. GDPR export = product L1),
> the ID is cross-referenced.

## Wave plan (recommended sequencing)

| Wave | Theme | Items | Why first |
|---|---|---|---|
| **W1 — See & Cap** | Observability + global rate/cost + DPIA kickoff | OPS-1, COST-1/2, SEC-2, CMP-2 | Can't safely scale past 1 family blind & uncapped |
| **W2 — Harden** | CSP, WIF, scanning, Vertex resilience, Zod-all, PII redaction | SEC-1/4/7/8, REL-2, SEC-3 | Close the high-severity security/reliability set |
| **W3 — Safe AI** | Semantic classifier, output checks, injection eval, HITL SLA | AI-1/2/3/6 | Child-safety-critical depth |
| **W4 — Operate** | Staging+smoke+rollback, SLOs, DR, compliance build-out | OPS-2, REL-1/4/5, CMP-3/4/5 | Sustainable operations & GDPR completeness |

---

## Domain A — Operational Excellence & DevOps (DORA)

| ID | Outcome | Acceptance criteria | Sev | Eff | Std |
|---|---|---|:--:|:--:|---|
| **OPS-1** | The team can see what prod is doing | Structured JSON logging (with request/trace IDs, PII-scrubbed); Cloud Trace on `/api/*`; key metrics (latency, error rate, AI calls, tokens); error tracker (e.g. Sentry/Error Reporting); alert policies on error-rate & latency | High | M | WAF-OpsEx, DORA-MTTR |
| **OPS-2** | Bad deploys don't reach parents | Staging env deploys first; automated post-deploy smoke test (health + one safe AI call) gates prod promotion; one-command/auto rollback to prior Cloud Run revision | High | M | DORA-CFR |
| **OPS-3** | Delivery is measured | DORA four-key dashboard (deploy freq, lead time, MTTR, change-fail rate) from CI + deploy events | Med | S | DORA |
| **OPS-4** | Regressions are caught | Coverage reporting enforced in CI (`test:coverage` exists); minimum threshold on `safety/`, `contracts/`, `routes/`, `memory/` | Med | M | WAF-OpsEx |
| **OPS-5** | Incidents are handled, not improvised | Real incident-response runbook (roles, sev levels, comms, breach-notification trigger) replacing the stub; on-call/escalation path | Med | S | NIST CSF RS, GDPR-33 |
| **OPS-6** | Knowledge releases are controlled | Knowledge/`framework.json` change requires PR review + re-run of `eval:safety` (already baked into image — formalize the gate) | Low | S | AI RMF Govern |

## Domain B — Security

| ID | Outcome | Acceptance criteria | Sev | Eff | Std |
|---|---|---|:--:|:--:|---|
| **SEC-1** | AI-rendered markdown can't run hostile script | Re-enable Helmet CSP with a tuned policy (script/style/connect/img/frame-ancestors); report-only first, then enforce; sanitize AI markdown before render | High | M | CSF PR.PS, OWASP |
| **SEC-2** | Rate/cost limits actually hold across instances | Move IP rate-limit + `aiQuota` to Firestore/Redis (shared, atomic); set Express `trust proxy`; per-user **and** global ceilings | High | M | CSF PR.AC |
| **SEC-3** | Child PII isn't shipped raw to the model | Redaction/tokenization layer maps child name → stable pseudonym before prompt assembly; document residual PII in DPIA; minimize profile fields sent | High | M | GDPR-5, CSF PR.DS |
| **SEC-4** | No long-lived cloud keys in CI | Replace `GCP_SA_KEY` with **Workload Identity Federation**; scope deploy SA to least privilege | High | S | CSF PR.AA |
| **SEC-5** | Tenants can't forge cross-family data | Firestore rules validate `familyId` ownership on `child`/`family` create + field/type validation (`request.resource.data` constraints); rules unit tests (`@firebase/rules-unit-testing` already a dep) | Med | M | CSF PR.AC |
| **SEC-6** | Only the real app can call the backend | Enable **Firebase App Check** (client attestation) on API + Firestore | Med | S | CSF PR.AC |
| **SEC-7** | All AI output is shape-validated | Apply Zod re-validation to plan/story/hero/analyze/handoff (parity with `/api/chat`); reject/repair on failure | Med | S | CSF PR.DS |
| **SEC-8** | Supply chain is watched | Dependabot/Snyk + container image scan (Artifact Registry/Trivy) + SBOM in CI; secret scanning on the repo | Med | S | CSF DE.CM, SLSA |
| **SEC-9** | Sensitive data uses managed keys (B2G readiness) | Evaluate CMEK for Firestore/Storage when institutional contracts require it | Low | M | CSF PR.DS |

## Domain C — Reliability

| ID | Outcome | Acceptance criteria | Sev | Eff | Std |
|---|---|---|:--:|:--:|---|
| **REL-1** | Survive a regional/service incident | Documented RTO/RPO; Firestore backup/PITR enabled & tested restore; multi-region plan (or accepted single-region risk with sign-off) | High | M | WAF-Rel |
| **REL-2** | A slow/down model doesn't hang the app | Timeout + bounded retry/backoff + circuit-breaker around Vertex; graceful degradation message; surface as metric | High | M | WAF-Rel |
| **REL-3** | Limits/counters survive instance churn | (Delivered with SEC-2 shared store) verify quota persists across revisions | Med | S | WAF-Rel |
| **REL-4** | Traffic only hits ready instances | Dedicated `/api/healthz` + `/readyz` (readiness includes Vertex/Firestore reachability) wired to Cloud Run startup/liveness probes | Med | S | WAF-Rel |
| **REL-5** | Reliability is a target, not a hope | Define SLIs/SLOs (availability, p95 latency, AI success rate) + error budget; alert on burn | Med | S | WAF-Rel/SRE |
| **REL-6** | Queries don't fail as data grows | Audit query patterns; add required Firestore composite indexes ahead of need | Low | S | WAF-Rel |

## Domain D — Performance Efficiency

| ID | Outcome | Acceptance criteria | Sev | Eff | Std |
|---|---|---|:--:|:--:|---|
| **PERF-1** | First AI call isn't slow | Cloud Run min-instances ≥1 (or warmup) + eager Vertex client init on startup | Med | S | WAF-Perf |
| **PERF-2** | Right-sized compute | Set Cloud Run concurrency/CPU/memory from load test; document | Low | S | WAF-Perf |
| **PERF-3** | Client stays fast | Lighthouse/perf budget gate in CI; track bundle size | Low | S | WAF-Perf |
| **PERF-4** | Don't pay to recompute | Cache analysis/Today's-Focus outputs in Firestore with TTL (extends N3) | Low | M | WAF-Perf/Cost |

## Domain E — Cost Optimization

| ID | Outcome | Acceptance criteria | Sev | Eff | Std |
|---|---|---|:--:|:--:|---|
| **COST-1** | Spend can't run away | Hard token/cost ceiling per user + global (atomic, shared store); 429 with clear message past cap | High | M | WAF-Cost |
| **COST-2** | Spend is visible | Per-`aiRun` token + cost captured; cost dashboard by route/user/day | High | S | WAF-Cost/FinOps |
| **COST-3** | Surprises are flagged | GCP budget + alerts; BigQuery billing export | Med | S | FinOps |
| **COST-4** | Each call is lean | Prompt-size discipline: truncate/summarize memory & cards; route low-stakes work to Flash (already done) and revisit Claude-per-turn vs. cheaper tier for routine questions | Med | M | WAF-Cost |

## Domain F — AI / ML Architecture (NIST AI RMF)

| ID | Outcome | Acceptance criteria | Sev | Eff | Std |
|---|---|---|:--:|:--:|---|
| **AI-1** | Safety screen catches what regex misses | Add a semantic/LLM safety classifier as a 2nd layer (input) covering paraphrase + more languages; measure recall against a labeled red-team set; keep regex as fast-path | High | M | AI RMF Manage |
| **AI-2** | Unsafe/hallucinated output is caught | Output-side safety + groundedness check before return (claims tie to `sourceCardsUsed`/memory; flag ungrounded) | High | M | AI RMF Measure |
| **AI-3** | Prompt injection is contained | Delimit untrusted memory/cards/message; instruction hierarchy; injection test cases in eval; strip control phrases from memory before injection | High | M | AI RMF Manage, OWASP-LLM01 |
| **AI-4** | All generative output validated | (Same as SEC-7) Zod on every endpoint | Med | S | AI RMF Measure |
| **AI-5** | Prompt/model changes are guarded | Regression + groundedness + age-fit eval suite (extends `eval:safety`); gate on score delta; per-release model card | Med | M | AI RMF Govern/Measure |
| **AI-6** | High-risk cases get human eyes | Documented HITL SLA for `safetyReviews` (who, target time); reviewer surface; metric on queue depth/age | Med | M | AI RMF Govern |
| **AI-7** | Models stay current & justified | Quarterly model-fitness review (safety/quality/cost) vs. newer Claude/Gemini; decision recorded as ADR | Low | S | AI RMF Map |
| **AI-8** | Escalation quality is monitored | Track escalation false-negative/positive via review-queue outcomes; alert on drift | Med | M | AI RMF Measure |

## Domain G — Privacy & Compliance (GDPR + HIPAA-analog)

| ID | Outcome | Acceptance criteria | Sev | Eff | Std |
|---|---|---|:--:|:--:|---|
| **CMP-1** | Lawful, consented processing | Parental consent capture + age-gate (Art. 8); consent record per family; surfaced in onboarding | High | M | GDPR-6/8 |
| **CMP-2** | Risk is formally assessed | **DPIA** completed (data flows incl. PII-to-LLM, risks, mitigations, residual-risk sign-off); becomes the §164.308 risk-analysis analog | High | M | GDPR-35, HIPAA |
| **CMP-3** | Parents own their data | Self-serve **export** (machine-readable full child record) + **erasure** across Firestore/Storage/ledger; tombstone audit (= product L1) | High | L | GDPR-15/17/20 |
| **CMP-4** | Subprocessors documented & contracted | Records of processing (Art. 30); DPA with subprocessors (Google/Vertex, Anthropic via Vertex); confirm model-region = EU; complete the DPA outline | High | M | GDPR-28/30 |
| **CMP-5** | Sensitive actions are audited | Immutable audit log for data access, export, delete, sharing, handoff (extend `aiRuns`/`safetyReviews` pattern); PII-scrubbed | Med | M | GDPR-5(2), HIPAA-164.312(b) |
| **CMP-6** | Breaches are reportable in time | Breach detection → 72h notification workflow tied to OPS-5 runbook | Med | S | GDPR-33 |
| **CMP-7** | Retention is enforced, not just stated | Implement the documented retention policy (TTL/expiry on memory `retention` field already modeled; enforce server-side) | Med | M | GDPR-5(1e) |

---

## Quick-win shortlist (high value / low effort — do alongside W1)

- **SEC-4** Workload Identity Federation (S) · **SEC-7/AI-4** Zod everywhere (S) ·
  **SEC-8** dep/image scanning (S) · **COST-2** token telemetry (S) ·
  **REL-4** health/readiness probes (S) · **OPS-3** DORA dashboard (S) ·
  **SEC-6** App Check (S).

## Out of scope (explicit non-goals for this hardening pass)
- New parent-facing capabilities (tracked in the product Capability Backlog).
- Multi-region active-active (revisit at institutional/B2G stage — REL-1 decides).
- Full B2B/B2G org platform (`organizations/**` stays locked until that phase).
