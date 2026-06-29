# Arbor — Well-Architected Framework Deep-Dive Assessment

**Date:** 2026-06-04
**Reviewer:** EA (Rubin OS architecture practice)
**Subject:** Arbor production `main` (v3 Wave 7), `app/` + infra + CI/CD
**Method:** Code-grounded review against Google Cloud / AWS Well-Architected pillars,
cross-mapped to **DORA**, **NIST CSF 2.0**, **NIST AI RMF (GenAI profile)**, **GDPR**
(primary regime), and **HIPAA Security Rule** (used as an analogous safeguard yardstick —
Arbor is *not* a US HIPAA covered entity, but children's health-adjacent data warrants
equivalent rigor).

> Companion: [Architecture Document](./arbor-architecture.md) ·
> [Enhancement Backlog](./enhancement-backlog-waf-2026-06-04.md)

---

## 1. Executive Summary

Arbor is **architecturally serious for a private beta** — far above typical prototype
maturity. The AI pipeline is disciplined (model routing, structured contracts, Zod
validation, knowledge grounding, parent-approved memory, pre-model safety screening, and a
safety eval gating every deploy). Identity and data isolation are real (Firebase Auth +
Firestore/Storage rules), prod is misconfiguration-resistant (`env.ts` invariants), and
data residency is correctly EU (`europe-west4`).

The gaps are concentrated in **operational excellence (observability)**, **reliability
(single-region, in-memory state, no DR)**, **a handful of security hardening items (CSP off,
PII-to-LLM, long-lived deploy key, non-global rate/cost caps)**, and a **compliance program
that is documented but not yet built (no DPIA, no data export/delete, partial audit).**

None are surprising for the stage; all are addressable. The highest-leverage move is
**observability + a global rate/cost store + a DPIA**, because they unblock safe scaling
from 1 family to a real beta cohort.

### Maturity scorecard (1 = ad hoc, 5 = optimized)

| Pillar | Score | One-line |
|---|:--:|---|
| Operational Excellence | **2.5** | Strong CI + safety eval; near-zero observability, single-env deploy |
| Security | **3.0** | Auth + rules + invariants solid; CSP off, in-mem caps, PII-to-LLM |
| Reliability | **2.5** | Managed services help; single-region, in-mem state, no DR/SLO/retries |
| Performance Efficiency | **3.0** | SSE streaming, lazy load; cold starts, no perf budget |
| Cost Optimization | **2.5** | Claude-per-turn, soft non-global caps, no cost telemetry |
| AI/ML Architecture (NIST AI RMF) | **3.5** | Best-developed area; regex safety + no output classifier are the ceiling |
| Privacy & Compliance (GDPR) | **2.5** | EU residency + approved-memory good; no DPIA/export/delete |
| **Overall** | **2.8** | Credible beta architecture; harden ops, reliability, compliance before cohort scale |

---

## 2. Pillar: Operational Excellence  · Score 2.5

### Strengths
- CI runs lint (`tsc`), tests, **framework structure check**, **`eval:safety`**, build on
  every PR and on `main` — quality + AI-safety gating is a standout.
- Prod boot invariants in `config/env.ts` fail-closed on misconfiguration.
- Immutable, reproducible image; knowledge baked per release.

### Gaps
| ID | Finding | Severity |
|---|---|:--:|
| OPS-1 | **No observability stack.** Only `console.*` to Cloud Logging — no structured logs, tracing, metrics, SLOs, error tracker, or alerting (`grep` finds logging only in 3 files). | High |
| OPS-2 | **Single-environment deploy.** `main` pushes straight to production; no staging gate, no post-deploy smoke test, no automated rollback. `cancel-in-progress` can abort a mid-flight deploy. | High |
| OPS-3 | **DORA metrics not instrumented** (deploy freq, lead time, MTTR, change-fail rate). | Medium |
| OPS-4 | Test depth is thin (10 test files); coverage unknown/unenforced. | Medium |
| OPS-5 | No runbooks/on-call; incident-response doc is a 451-byte stub. | Medium |

### DORA mapping
| DORA metric | State |
|---|---|
| Deployment frequency | Auto-deploy on merge (good cadence) — but not measured |
| Lead time for change | CI fast; not measured |
| Change failure rate | No staging/smoke/rollback → failures reach prod undetected |
| MTTR | **Unbounded** — no alerting/tracing to detect or localize incidents |

---

## 3. Pillar: Security  · Score 3.0

### Strengths
- Firebase Auth + server-side ID-token verification (`authMiddleware.ts`), enforced in prod.
- Real data isolation: `users/**` owner-only; `children/**` family-gated; `aiRuns` create+
  owner-read only; `safetyReviews` write-only; `organizations/**` locked.
- Helmet, CORS allowlist, body-size cap (250 kb), Storage 5 MB cap, prod runtime uses ADC
  (no private key shipped).

### Gaps (NIST CSF 2.0 lens: PR = Protect, DE = Detect)
| ID | Finding | CSF | Severity |
|---|---|---|:--:|
| SEC-1 | **CSP disabled** (`helmet({ contentSecurityPolicy: false })`) on an app rendering AI-generated markdown — XSS/exfiltration surface. | PR.PS | High |
| SEC-2 | **Rate-limit & AI quota are in-memory per instance** (`aiQuota.ts`, express-rate-limit default store). Cloud Run scales horizontally → caps are bypassable; also no `trust proxy`, so `req.ip` may be the Google FE. | PR.AC / DE | High |
| SEC-3 | **Child PII sent to LLM** unredacted (`JSON.stringify(childProfile)` incl. name) — no tokenization/DLP layer before Vertex. | PR.DS | High |
| SEC-4 | **Long-lived `GCP_SA_KEY` JSON** in GitHub secrets for deploy — should be **Workload Identity Federation** (keyless). | PR.AA | High |
| SEC-5 | **Firestore rules allow any signed-in user to `create` a `child`/`family`** with arbitrary `familyId`; no field/schema validation or ownership check at create. Low blast radius today, real before multi-tenant GA. | PR.AC | Medium |
| SEC-6 | No **Firebase App Check** — API/Firestore callable from any client with a token. | PR.AC | Medium |
| SEC-7 | Five of six generative endpoints **forward model output without Zod re-validation**. | PR.DS | Medium |
| SEC-8 | No secret scanning, dependency/image vuln scanning, or SBOM in CI. | DE.CM | Medium |
| SEC-9 | No CMEK; default encryption only (acceptable for beta, flag for B2G). | PR.DS | Low |

---

## 4. Pillar: Reliability  · Score 2.5

### Strengths
- Managed Firestore/Cloud Run/Hosting remove most single-machine failure modes.
- Client `AbortController` cancels in-flight model streams; escalation path returns even on
  model failure.

### Gaps
| ID | Finding | Severity |
|---|---|:--:|
| REL-1 | **Single region** (`europe-west4`), single Cloud Run service; no DR plan/runbook, no documented RTO/RPO. | High |
| REL-2 | **No retry/backoff/timeout/circuit-breaker around Vertex calls** — only client abort. A slow/down model hangs requests; no graceful degradation. | High |
| REL-3 | **In-memory state lost on instance recycle** (quota, rate counters) → inconsistent enforcement. | Medium |
| REL-4 | **No health/readiness probe** distinct from the SPA catch-all; Cloud Run can route to a not-ready instance (Vertex import is lazy). | Medium |
| REL-5 | **No SLOs/SLIs or error budget** defined. | Medium |
| REL-6 | Firestore composite indexes minimal (one) — queries that grow with data may fail at runtime. | Low |

---

## 5. Pillar: Performance Efficiency  · Score 3.0

### Strengths
- SSE token streaming on the highest-latency path (`/api/chat`).
- Client code-splitting / lazy tabs; CDN-cached immutable assets with correct cache headers.
- Lazy Vertex SDK import keeps cold-start import cost off non-AI paths.

### Gaps
| ID | Finding | Severity |
|---|---|:--:|
| PERF-1 | **No min instances / warmup** → cold-start latency on first AI call (Vertex client init). | Medium |
| PERF-2 | No Cloud Run `concurrency`/CPU tuning documented; defaults may under-utilize. | Low |
| PERF-3 | No client perf budget / Lighthouse gate in CI; PWA present but unmeasured. | Low |
| PERF-4 | AI response caching limited to the (planned) 24h "Today's Focus"; repeat analyses re-call the model. | Low |

---

## 6. Pillar: Cost Optimization  · Score 2.5

| ID | Finding | Severity |
|---|---|:--:|
| COST-1 | **Claude 3.5 Sonnet on every coach turn** is the dominant cost; no per-user/global spend ceiling (caps are in-memory and request-count, not token/cost based). | High |
| COST-2 | **No token/cost telemetry per `aiRun`** — spend is unobservable, so it can't be attributed or forecast. | High |
| COST-3 | No GCP **budget alerts / billing export**. | Medium |
| COST-4 | No prompt-size discipline (full profile + memory + cards every call); caching/truncation could cut tokens materially. | Medium |

---

## 7. AI/ML Architecture — NIST AI RMF (GenAI Profile)  · Score 3.5

The best-developed dimension. Mapped to AI RMF functions:

| RMF function | Evidence (present) | Gap |
|---|---|---|
| **GOVERN** | Non-diagnostic contract; Six-Frame discipline; ADRs; safety eval in CI | No model card/eval report per release; no documented HITL SLA for `safetyReviews` |
| **MAP** | Model routing by risk (`coach_high_stakes` → Claude); intended-use boundaries explicit | No formal hazard log beyond 5 escalation categories |
| **MEASURE** | `eval:safety` gate; structured contract; `sourceCardsUsed` grounding; `aiRuns` log | **No output safety/groundedness classifier; no hallucination/regression eval; no escalation false-negative monitoring; regex-only input screen** |
| **MANAGE** | Pre-model escalation block; high-risk review queue; parent-approved memory; abort handling | Five endpoints skip Zod; **prompt-injection** via memory/notes/cards unmitigated; no PII redaction; model IDs pinned but aging (`claude-3-5-sonnet-v2`) |

### Key AI findings
| ID | Finding | Severity |
|---|---|:--:|
| AI-1 | **Regex-only safety screen** (`escalation.ts`) — misses paraphrase, code-switching, and languages beyond EN/HE; high false-negative risk on a child-safety-critical path. Add a semantic/LLM safety classifier as a second layer. | High |
| AI-2 | **No output-side safety/groundedness check** — only schema shape is validated; a fluent-but-unsafe or hallucinated answer passes. | High |
| AI-3 | **Prompt-injection surface** — approved memory + wiki cards + free-text message concatenated; untrusted text can steer the model. Add delimiting, instruction-hierarchy, and injection eval cases. | High |
| AI-4 | **5/6 generative endpoints skip Zod re-validation** (only `/api/chat` validates). | Medium |
| AI-5 | **No groundedness/hallucination or regression eval suite** beyond `eval:safety`; prompt/model changes lack guardrails on quality/age-fit. | Medium |
| AI-6 | **HITL review SLA undefined** — `safetyReviews` is write-only with no documented who/when-reviews workflow. | Medium |
| AI-7 | **Model version freshness** — coach pinned to Claude 3.5 Sonnet v2 (2024-10); evaluate newer models for safety/quality/cost. | Low |

---

## 8. Privacy & Compliance — GDPR (primary) + HIPAA-analog  · Score 2.5

EU markets + **children's special-category-adjacent data + profiling** ⇒ GDPR is strict and
a **DPIA is effectively mandatory (Art. 35)**.

| Requirement | State | Gap → backlog |
|---|---|:--:|
| Lawful basis / parental consent (Art. 6/8) | Invite-only; no consent capture/age-gate | CMP-1 |
| **DPIA (Art. 35)** | **Absent** despite children + profiling | CMP-2 (High) |
| Data minimization (Art. 5) | Approved-memory gate is excellent; but full profile incl. name → LLM | SEC-3 |
| Right to access / portability (Art. 15/20) | **Not built** (backlog L1) | CMP-3 |
| Right to erasure (Art. 17) | **Not built** | CMP-3 |
| Records of processing / subprocessors (Art. 30/28) | DPA *outline* only; Vertex/Anthropic processing terms not documented | CMP-4 |
| Audit logging | `aiRuns` + `safetyReviews` partial; data access/export/delete not audited | CMP-5 |
| Encryption at rest/in transit | Default GCP encryption ✅ (HIPAA §164.312 analog ✅) | — |
| Access control / least privilege | Rules good; App Check + create-validation gaps | SEC-5/6 |
| Breach notification (Art. 33) | Incident-response stub only | OPS-5/CMP-6 |
| Residency | `europe-west4` ✅ | confirm Vertex model region = EU |

**HIPAA-analog yardstick:** access controls, transmission security, and integrity controls
are broadly met in spirit; **audit controls (§164.312(b))** and a formal **risk analysis
(§164.308(a)(1))** — i.e., the DPIA — are the principal shortfalls.

---

## 9. Top 10 prioritized actions (cross-pillar)

| # | Action | Pillars | Sev |
|---|---|---|:--:|
| 1 | Stand up observability: structured logging, tracing, metrics, error tracker, alerts, SLOs | OpsEx, Rel | High |
| 2 | Move rate-limit + AI quota to a shared store (Firestore/Redis) + token/cost telemetry + hard cost cap | Sec, Cost, Rel | High |
| 3 | Conduct a **DPIA** and build data **export + erasure** | Compliance | High |
| 4 | Add a **semantic/LLM safety classifier** (input + output) behind the regex screen | AI | High |
| 5 | Enable a tuned **CSP** (and re-enable Helmet CSP) | Sec | High |
| 6 | Add staging environment + post-deploy smoke test + rollback | OpsEx, Rel | High |
| 7 | Switch deploy to **Workload Identity Federation** (drop SA key); add dep/image scanning + SBOM | Sec | High |
| 8 | Wrap Vertex calls with timeout + retry/backoff + circuit-breaker + graceful degradation | Rel | High |
| 9 | **PII redaction/tokenization** before prompts; Zod-validate all generative outputs; injection eval | Sec, AI | High |
| 10 | Define HITL review SLA for `safetyReviews`; add groundedness/regression eval suite | AI | Med |

---

## 10. Standards traceability index

- **Google/AWS WAF pillars** → §2–§6 (Ops, Sec, Rel, Perf, Cost).
- **NIST CSF 2.0** → §3 (PR/DE function tags per finding).
- **NIST AI RMF (GenAI)** → §7 (Govern/Map/Measure/Manage).
- **GDPR** → §8 (article-by-article).
- **HIPAA Security Rule (analog)** → §8 closing note.
- **DORA** → §2 (four key metrics).

All findings carry IDs (OPS-/SEC-/REL-/PERF-/COST-/AI-/CMP-) that resolve to the
[enhancement backlog](./enhancement-backlog-waf-2026-06-04.md).
