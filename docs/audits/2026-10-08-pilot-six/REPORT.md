# Six pilot experiences — release review

Date: 2026-10-08. Register: parent. User mandate: implement priorities 1–5 and 10, update the existing backlog, and deploy production. This is a bounded pilot release, not a claim of clinical approval or whole-product GA readiness.

## Scope and verdict

1. Original 25 hard-moment guides, anonymous bilingual browsing and generic sharing.
2. Four authored adaptations for 10 practices, with exact chosen content retained only on explicit completion.
3. Twenty original bilingual activity cards informed by Ministry of Health guidance, age-filtered and explicitly editorial pilot content.
4. Photo, PDF and pasted recommendations: inspect the original, choose/edit quotations, then explicitly save into the existing home program.
5. Free verified co-parent invitations, one selected activity and original child record, contribution provenance and revocation.
10. Three parent-led illustrated preparation kits: goodbye, waiting for a turn, joining play.

**Final result: passed.** Independent critics accepted G0 → G1 → G2 for all six experiences. Three review passes covered source boundaries, rendered journeys and the final release. No selected feature was dropped. No open P0/P1/P2 finding remains in this bounded review.

## G0 evidence

Code commit: `9ab9916ff4107000f0684fd8346a3ce2743b9604`.

[Cloud run 37804465698](https://github.com/guyrubin/Arbor/actions/runs/37804465698) passed types, full tests, framework, capability floors, safety evaluation, acceptance and production build. Tests: **11,568 passed**, 10 skipped, one todo; 751 test files passed and one skipped. Floors: 27 pass, zero fail, one documented pre-existing warning. Types and the full suite ran in cloud, respecting the workstation limit; targeted local files ran sequentially with one worker.

Document extraction also passed eight live synthetic Vertex scenarios against the pinned evaluator: PDF, Hebrew image, clipped source, assessment language, embedded instructions, medication, negation and unrelated material. Medication correctly failed closed. See `evals/home-program-import.eval.json`, `evals/home-program-import.results.jsonl` and `app/src/eval/programImportEval.test.ts`. No real family document was used.

Rendered checks used invented demo children and explicit synthetic co-parent/API fixtures. They are not represented as production authentication evidence. Built public pages and app routes had zero application console errors. Recipient development preview had only Vite websocket transport errors. Clean owner fixture reload had no errors. Production verification follows the deployment's exact-SHA health and hosting checks.

## G1 evidence and benchmark comparison

Benchmarks: existing `PracticeCard`, `DailyPlayTab`, `HardMomentNowSheet`, `HomeProgramEntry` and `TrustedSharing`. All surfaces reuse the parent register and `app/DESIGN.md` tokens. No child score or diagnosis was introduced.

Evidence paths below are local-only under `app/output/playwright/`; screenshots contain invented QA data and are intentionally excluded from Git.

| Surface | Evidence | Result |
| --- | --- | --- |
| Public guides | `public-guides-he.png`, `guide-detail-he.png` | Same do/say/escalation hierarchy as the existing sheet; generic sharing, 390/390 containment. Nested built routes load actual assets. |
| Adaptations | `adapt-two-minutes-he.png` | Existing card and completion placement preserved. Preview made no write; completing no-materials retained the exact bilingual variant in actionLoops. |
| Source activities | `source-cards-he.png`, `source-he-375-final.png`, `source-he-desktop.png`, `source-en-375.png` | Clear selected pills, do/say/materials and source. 375/375, 390/390 and 1280/1280 containment; interactive targets at least 44px. |
| Intake | `intake-review-he.png`, `intake-saved-he.png`, `intake-pdf-desktop-settled.png` | Original PDF readable beside unchecked choices. Parent edit retains original quotation; second same-day program preserves the first as history. |
| Co-parent | `coparent-owner-clean-he.png`, `benchmark-sharing-he.png`, `coparent-recipient-he.png`, `coparent-recipient-saved-he.png` | Matches existing sharing card geometry, hierarchy and RTL. 390/390 containment and 44px controls. |
| Preparation | `tomorrow-goodbye-he.png`, `tomorrow-turns-he.png`, `tomorrow-joining-he-375-settled.png`, `tomorrow-joining-en-375-settled.png` | Three scene journeys, readable mirrored controls and original token-based illustrations. Final captures wait for full opacity. Escape restores focus to the opener. |

Source/preparation modules remain closed disclosures within existing DailyPlay sections. Switching to the younger 22-month synthetic sibling hides both age-inappropriate catalogues. Browsing kits writes no records. Source completion persisted `moh-play-08.2026-10-08` through the existing playLogs path.

## Findings resolved

- Same-day intake collision: unique per-flow ID and stable retry timestamp retain older provenance and completion history.
- Co-parent stale responses: authorization epochs prevent revoked/deleted-child responses being restored by older reads; owner mutation refresh survives locale switches.
- Invitation concurrency: child-scoped Firestore transaction serializes duplicate invitations; one active grant per child/email. Child-erasure barrier closes new invitations before the sweep.
- Shared choice was initially implicit: explicit owner selection now points both adults to one authored activity in the original child tree.
- Nested public assets: public HTML receives a root base while the native app keeps its existing relative Vite base.
- Clipboard denial: copy confirmation waits for success; a selected-text fallback handles failure.
- Preview-only screenshot defects were re-captured after PDF paint/modal opacity settled; no transparent-dialog or blank-PDF evidence is used for final acceptance.

## G2: specific parent value

- Guides: immediate usable words and a safe next action without onboarding.
- Adaptation: a smaller action that fits today without losing the parent's chosen version.
- Source cards: one sentence and an optional five-minute activity, followed by a factual saved-today receipt.
- Intake: verify even a negative instruction against the original, edit deliberately, retain the original quotation.
- Co-parent: arrive at the same activity, say the same useful words and contribute to one record.
- Preparation: after a possible refusal, the parent has another idea and permission to watch or stop; no promise of compliance.

## Boundaries and follow-through

The existing pilot manifest/withdrawal/expiry policy remains in force. Ministry of Health cards disclose editorial adaptation and no official partnership; a clinician's approval was not invented. Files are transient; only confirmed transcription/quotations enter existing exportable and erasable program records. Original guide copy is unchanged. No expansion to 60 guides or remaining unselected recommendations was included.

Release PR: [#111](https://github.com/guyrubin/Arbor/pull/111). Deployment receipt and final backlog status are recorded in the existing ROS Parent backlog after production verification. Account-wide pre-existing legacy sharing/erasure concurrency is outside this bounded pilot acceptance; this release specifically closes the new family-invitation child-erasure race.
