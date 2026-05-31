# Arbor Backlog

> Capability backlog v1.1 (2026-05-31). Full definitions + acceptance criteria in
> `docs/arbor-prd.md` → "Capability Backlog v1.1". Status tracked here.

## NOW — committed

| ID | Capability | Value | Effort | Status |
|---|---|---|---|---|
| N1 | Real Firestore persistence (logs/milestones/plans/stories/safety) | H | M | In progress |
| N2 | Per-child data isolation | H | S | Not started |
| N3 | AI "Today's Focus" cached 24h | M | S | Not started |
| N4 | Auto-generated Weekly Report + history | H | M | Not started |
| N5 | Quick-win polish (real AI actions, empty states) | M | S | Not started |

## NEXT — planned

| ID | Capability | Value | Effort | Status |
|---|---|---|---|---|
| X1 | Voice-to-log capture | H | M | Not started |
| X2 | Reminders & nudges (web push) | H | M | Not started |
| X3 | Bilingual (Hebrew/English) + RTL | H | M | Not started |
| X4 | Photo attachments on logs | M | S | Not started |
| X5 | Pattern intelligence v2 (correlations) | H | M | Not started |
| X6 | Saved & versioned briefs + PDF | M | S | Not started |
| X7 | PWA + offline capture | M | M | Not started |

## LATER — directional

| ID | Capability | Value | Effort | Status |
|---|---|---|---|---|
| L1 | GDPR data export / delete | M | M | Not started |
| L2 | Milestone research depth | M | M | Not started |
| L3 | Action-plan templates | M | M | Not started |
| L4 | Accessibility (WCAG AA) | M | M | Not started |
| L5 | Analytics instrumentation | M | S | Not started |

---

## M0/M1 Architecture Follow-ups (historical)

| ID | Title | Status | Upstream |
|---|---|---|---|
| T300 | Wire Claude on Vertex as `coach_high_stakes` default | In progress on `codex/arbor-v2-architecture-foundation` | Issue #6, ADR 0004, FU-1 |
| T301 | Ship the `knowledge/` folder to production | In progress on `codex/arbor-v2-architecture-foundation` | Issue #6, ADR 0003, FU-2 |
| T302 | Add Vitest tests for modularized Arbor code | In progress on `codex/arbor-v2-architecture-foundation` | Issue #6, FU-3 |
| T303 | Create Firestore parent docs before auth/client reads | In progress on `codex/arbor-v2-architecture-foundation` | Issue #6, ADR 0002, FU-4 |

These tasks came from `arbor-followup-prs.md` in the local Claude project folder and close the gaps after the ADR/foundation branch review.
