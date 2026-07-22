---
type: product-journey-spec
project: Arbor
date: 2026-07-22
status: wave-1-release-candidate; visual-qa-passed
canonical-backlog: docs/arbor-enhancement-backlog-v6.md
---

# Arbor continuity journey

## Product decision

The new capabilities do not become new hubs. They deepen one parent journey across the existing Today, Behaviors, Growth, Care, and content surfaces:

> Notice or ask → confirm the signal → choose one small action → record the outcome → understand what changed → adapt the next step → optionally align or share.

Today is the conductor. Other hubs remain specialist workspaces.

## Primary journey

| Step | Parent sees | Parent action | System responsibility |
|---|---|---|---|
| Capture | One text/voice/photo entry point | Describe a real moment | Keep draft separate from confirmed memory; show source and allow correction |
| Guidance | One recommendation | Open guidance or make it today's step | Link guidance to confirmed evidence; preserve non-diagnostic framing |
| Size | 2, 5, or 10 minute effort | Choose what fits today | Adapt effort without diagnosing parent capacity |
| Act | One calm action card | Try, remove, or defer | Persist one duplicate-safe child-scoped action |
| Outcome | Helped / A little / Not today | Record one tap | Preserve parent-reported fact; never create a child score |
| Progress | What changed · evidence · next | Inspect or correct | Cite the action/outcome and adapt the next recommendation |
| Align/share | Optional handoff | Share deliberately | Enforce identity, scope, expiry, redaction, audit, and parent approval |

## Information architecture

- **Today:** capture, one recommendation, current action, outcome, compact progress narrative.
- **Behaviors:** detailed confirmed moment capture and pattern review.
- **Growth:** longer progress narrative, milestone evidence, bounded curriculum maps.
- **Care:** warm referral, visit preparation, approved professional reverse channel.
- **Existing content surfaces:** contextual cards/pathways selected by the current job; no generic content-library expansion.

## Interaction rules

1. One primary action per screen and at most one Today step per child/day.
2. Optional detail follows the quick path.
3. AI drafts are not facts until the parent confirms them.
4. Outcome language describes the attempt, never the child.
5. Inferences expose evidence; parent-created facts can be edited or removed.
6. English and Hebrew share hierarchy and touch targets.
7. No streaks, percent scores, deficit labels, penalties, or autonomous sharing.

## Production waves

### Wave 1 — loop foundation

- Existing unified capture entry and progressive disclosure.
- Today recommendation → effort sizing → accepted action → one-tap outcome.
- Compact outcome receipt explaining adaptation.
- Child-scoped persistence, export/erase coverage, duplicate safety, analytics, tests.

### Wave 2 — progress and governed content

- Full what-changed/evidence/next view.
- Governed schema and publishing gate.
- AR-CONT-01 first; one shared visual pipeline for AR-CONT-02/07.
- One reviewed pathway at a time from measured demand.

### Wave 3 — family and professional continuity

- Separate caregiver identity and alignment.
- Parent-approved assignment/response/outcome/closure.
- Visit preparation packs and a current local referral registry.

## Gates

- Clinical/content review before AR-CONT publication.
- DPIA/auth migration approval before caregiver identity.
- Guy Tier-C and workflow approval before professional writes.
- Rights/source approval before milestone or activity media.
- Consent and analysis plan before effectiveness claims.

A gated capability must not appear as available production functionality.

## Execution status — 2026-07-22

Wave 1 is implemented locally: child-scoped Today actions, 2/5/10-minute effort sizing, duplicate-safe daily identity, one-tap parent-reported outcomes, export/erase coverage, and outcome input into the next generated focus. Automated release gates are green. Production promotion is blocked until browser-rendered desktop/mobile interaction evidence passes `design-qa.md`.
