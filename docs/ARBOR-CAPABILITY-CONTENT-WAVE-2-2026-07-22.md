---
type: implementation-record
project: Arbor
date: 2026-07-22
status: release-candidate; content-review-gated
source-backlog: docs/arbor-enhancement-backlog-v6.md
---

# Capability and content wave 2

## Product outcome

This wave deepens the existing continuity journey without adding a hub:

> Capture a real moment → review what will be remembered → see the evidence-backed child narrative → take one small action → report the outcome → receive an adapted next step.

## Implemented capability increments

### AR-CAP-01 — confirmed capture seam

- Today text capture now creates a local draft first.
- Review shows source, confidence, proposed fields, and an explicit statement that nothing has entered child memory yet.
- Parent can edit, discard, or confirm.
- Only confirmation invokes the existing behavior-log write path.
- Voice, photo, document, Coach, milestone, and detailed Behavior capture still require convergence on the same contract; this wave does not falsely mark the universal composer complete.

### AR-CAP-03 — progress narrative

- Today now includes one child-level `What changed / Your evidence / What comes next` view.
- It combines recent confirmed moments, completed play, noticed milestones, and action outcomes.
- It shows counts and parent-authored source rows, never a score, percentile, developmental-age estimate, or diagnosis.
- The latest action outcome changes the next-step explanation.
- Evidence opens the existing Journal surface.

### AR-CAP-07 — governed content contract

- Every governed item carries version, age bands, domain, locales, safety class, review status, reviewer role, review timestamps, and evidence references.
- The publishing predicate fails closed for drafts, missing Hebrew or English, missing provenance, missing reviewer role, and expired review.

### AR-CAP-08 — milestone uncertainty state

- Milestones now use explicit `Yes / Not sure / Not yet` parent observations instead of a binary checkbox.
- `Not sure` offers calm observation guidance rather than turning the milestone into a test.
- Existing checked milestones migrate safely as `Yes`; the original boolean remains compatible with existing counts and reports.
- Each new response records its provenance timestamp. Corrected-age and screening disclaimers remain unchanged.
- Licensed illustration/video examples remain gated; this wave does not fabricate or repurpose unlicensed media.

## Implemented content increment

### AR-CONT-01 — Top 25 hard-moment cards

The complete bilingual draft set covers tantrums, refusal, hitting, sibling conflict, separation, bedtime, stopping play, morning rush, homework, ending screen time, public meltdowns, whining, non-response, new-situation fear, losing, sharing, teasing, clinging, school drop-off, dressing, toothbrushing, mealtime, bathing, waiting, and unexpected change.

Every card includes:

- do now;
- exact parent words;
- what to avoid;
- what to observe;
- a safety/escalation boundary;
- EN/HE content and governance metadata.

All 25 remain `draft`. They are structurally complete but cannot appear as approved product guidance until a named clinical-content reviewer approves the wording and sets the review date. This is a deliberate release gate, not unfinished UI.

## Verification

- TypeScript: passed.
- Content/governance/action model tests: 5 passed.
- Production build: passed, 3,038 modules.
- Full suite: 112 test files passed, 1 skipped; 1,321 tests passed, 3 skipped.
- Safety evaluation, framework consistency, and all 27 asserted capability floors: passed.
- Browser-level visual and interaction QA: passed across desktop, 390px mobile, capture review/edit/discard, milestone uncertainty, and Hebrew RTL. Evidence: `docs/audits/2026-07-22-capability-content-wave-2/`.

## Next implementation wave

Converge voice/photo/document capture on the confirmed-signal contract, then add caregiver alignment and the professional reverse channel. Do not start referral marketplace work until a first-market registry owner and freshness SLA exist.
