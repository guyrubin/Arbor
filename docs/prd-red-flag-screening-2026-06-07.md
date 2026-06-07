# PRD — Arbor Developmental Red-Flag Screening

**Date:** 2026-06-07
**Author:** Guy Rubin
**Status:** Draft
**Venture:** Arbor (parenting / child-development platform)
**Relates to:** [arbor-ia-enhancement-plan-2026-06-07.md](arbor-ia-enhancement-plan-2026-06-07.md) — Wave 3, feature #1

> **Scope challenge (read first).** The brief asks for "validated-style screeners for autism / ADHD / speech-language / sleep." Building four condition screeners at once is the wrong first move on two axes: (1) **regulatory** — software that screens for a medical condition can be an EU MDR Class I/IIa medical device, and most validated instruments (ASQ-3, M-CHAT-R/F, Vanderbilt, CSHQ) carry licensing terms that forbid or charge for commercial redistribution; (2) **product** — we have not yet proven parents will *complete* a structured screener and *act* on the result. This PRD scopes a **single-domain MVP that reuses the existing milestone data and CDC public-domain content** to test the core hypothesis at near-zero regulatory and licensing exposure, then sequences the condition-specific screeners behind an explicit legal gate.

---

## Problem

Parents of young children carry a low-grade, recurring anxiety — *"is this normal, or should I get it checked?"* Today they oscillate between Dr. Google (alarming, ungrounded) and waiting it out (delays early intervention, where months matter for outcomes). Arbor already tracks milestones, but it only shows *what's observed*; it never tells a parent **"this pattern is worth a professional conversation"** or hands them a clean way to start that conversation.

This is the single highest-intent, highest-willingness-to-pay moment in the whole parenting-app category — and Arbor's existing Milestones + Reports + Care Network already sit one step on either side of it.

## User persona

**Primary — "Worried-but-capable parent" (Maya, 34, Tel Aviv / Amsterdam).** Has a 2-year-old. Noticed her son isn't pointing or saying as many words as his cousin did. Wants a *grounded, non-alarmist* read and, if warranted, a frictionless path to a real professional — without being told her child "has autism" by an app. Bilingual household, mild guilt about screen time, will pay for reassurance and for a shortcut to the right specialist.

**Secondary — the receiving professional (B2B2C).** A speech therapist / pediatrician who would rather receive a structured, dated, non-diagnostic summary than a panicked parent with no history.

## Goals (measurable)

- A parent can complete an age-appropriate developmental check in **< 4 minutes**.
- The check produces a **non-diagnostic "areas worth discussing" output** with a one-tap route into Reports & Handoffs and Find a Professional.
- **≥ 40%** of parents who *start* a check *complete* it (engagement hypothesis).
- **≥ 15%** of completed checks with an elevated signal take a downstream action (generate a handoff, contact/Find a pro, or set a reminder to re-check) within 7 days (the *value* hypothesis — this is the one that matters).

## Non-goals (explicitly NOT building in this version)

- ❌ **Any diagnosis, risk score, or probability of a condition.** Output is "discuss with a professional," never "likely ADHD."
- ❌ **Licensed instruments verbatim** (ASQ-3, M-CHAT-R/F, Vanderbilt, CSHQ) — not until licensing + medical-device classification are cleared with counsel (see Risks).
- ❌ **Four domains at launch.** One domain ships first.
- ❌ **Clinician-facing scoring/triage tooling** (that's the Wave-3 B2B portal, separate PRD).
- ❌ **Storing screening results as medical records** or making any retention/erasure promise beyond Arbor's existing parent-controlled memory model.

## The hypotheses we're actually testing (labelled — these are not "requirements")

- **H1 (engagement):** Parents will complete a structured developmental check inside a parenting app. *Riskiest cheap-to-test assumption.*
- **H2 (value):** An elevated, well-framed result drives a downstream care action (handoff / find-a-pro). *This is the business case; if H2 fails, the feature is a vanity metric.*
- **H3 (trust):** Non-diagnostic framing reassures rather than alarms (measured by completion + qualitative + low "this scared me" feedback).
- **H4 (regulatory, must be resolved before condition screeners):** A non-diagnostic, education-framed milestone check on CDC public-domain content is *not* an EU medical device. **Owner: legal, not product.**

## MVP — the simplest thing that tests H1–H3

**One domain: a general "Development Check" built on CDC "Learn the Signs. Act Early." public-domain milestones (already partially in the app via the Milestones tracker).**

Why this domain first: zero licensing cost, lowest regulatory exposure (general developmental awareness, not a named condition), and it reuses `framework.json` + the milestone data already shipped. It proves the *flow* (check → framed output → action) before we touch condition-specific, licensed, device-classifiable instruments.

### Must have (MVP)
- **Age-banded check** that pulls the relevant CDC-aligned items for the child's age and asks the parent a short, plain-language yes/"not yet"/"sometimes" per item (~8–12 items).
- **Non-diagnostic result screen:** "On track" areas vs **"Worth keeping an eye on / worth a professional conversation"** areas. No score, no condition names. Warm copy, reviewed against the existing safety framing.
- **Escalation routing:** elevated result surfaces the existing Trust & Safety bar + one-tap → **Reports & Handoffs** (auto-seed a developmental snapshot) and → **Find a Professional**.
- **Re-check reminder:** "development changes fast — check again in N weeks" (ties to the existing Reminders card).
- **Persisted to the child's timeline** as a `screening` signal (the Story timeline already aggregates signals).
- **Strong, unavoidable disclaimer** on entry and on results ("Arbor is not a medical device and does not diagnose…").

### Should have
- AI-assisted plain-language explanation of each flagged area (reuse the `/api/chat` non-diagnostic pipeline already used by Milestones "Explain").
- Bilingual (EN/HE) check content.
- Result export inside the existing Reports PDF.

### Won't have (this version)
- Autism / ADHD / speech / sleep *named* screeners, scoring, longitudinal risk trends, clinician triage, insurer routing.

## Success metrics (30 / 90 / 180 days)

| Horizon | Metric | Target |
|---|---|---|
| 30d | Check start→complete rate | ≥ 40% |
| 30d | "This was reassuring/helpful" (in-app thumbs) | ≥ 70% positive |
| 90d | Completed-check → downstream care action (7d) | ≥ 15% |
| 90d | Re-check return rate | ≥ 25% |
| 180d | Screening → professional connection (once intro flow exists) | baseline for B2B2C model |

## Risks and open questions

- [ ] **EU MDR classification (BLOCKING for condition screeners).** Does the general check stay clear of "medical device"? Does any *named-condition* screener cross the line? **Needs counsel before H4-dependent work.** Owner: legal.
- [ ] **Instrument licensing.** ASQ-3 (paid, Brookes), M-CHAT-R/F (free w/ terms, no modification), Vanderbilt (generally free), CSHQ/BISQ (academic). We likely build Arbor's own CDC-derived content for MVP and license selectively later. Owner: product + legal.
- [ ] **Clinical credibility / liability.** Who signs off on the item set and the "worth discussing" thresholds? Recommend a paediatric/developmental advisor on retainer before public launch.
- [ ] **Harm framing.** A false "all on track" could *delay* care; a false flag could *alarm*. Copy + thresholds must be advisor-reviewed; always bias toward "a conversation never hurts."
- [ ] **Israel vs EU divergence** in medical-device and health-claim rules across launch markets.
- [ ] **H2 dependency:** the downstream "Find a Professional" intro/booking is still deferred (Wave 2) — without a real care endpoint, the value metric tops out at "generate a handoff."

## Timeline (milestones, not Gantt)

1. **M0 — Legal gate (parallel, ~2 wks):** counsel opinion on MDR + claims for the general check; advisor for item set. *Blocks public launch, not the build.*
2. **M1 — Build MVP (general Development Check)** on existing Milestones/framework data; ship behind a flag to a small cohort.
3. **M2 — Validate H1–H3** (completion, reassurance, downstream action) for 30 days.
4. **M3 — Decision gate:** if H2 clears AND legal greenlights, build **one** condition screener next — recommend **sleep (BISQ-style)** as the lowest-regulatory, highest-recurring-engagement domain, *or* autism social-communication (highest pull, highest scrutiny) if counsel is comfortable.
5. **M4+** — remaining domains + feed the Wave-3 B2B clinician portal.

## Recommendation

Build the **single general Development Check MVP now** (it's mostly reuse of shipped infra), run the **legal gate in parallel**, and let the H2 result + counsel decide whether autism/ADHD/speech/sleep screeners are worth the regulatory weight. Do **not** build four named-condition screeners on spec.
