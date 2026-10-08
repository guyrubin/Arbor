# Arbor companion experience — release review

Date: 8–9 October 2026. Register: parent. PR: [113](https://github.com/guyrubin/Arbor/pull/113).

## Scope and benchmark

Replace the ten-hub primary navigation with Now, My child and Together. Keep all 43 existing routes, text/voice conversation, care, learning, child switching and safety reachable. The benchmark was the 8 October live-app audit and the three-chapter whole-child mockup discussed with Guy. The improvement must make a family's own question, original evidence and a useful shared experience legible; extra decoration or a progress tree does not satisfy it.

The shipped slice includes an eight-domain child portrait with time, environment and domain views; source details; a persistent parent-chosen question; topic-bound conversations and chosen steps; editorial activity previews; and explicit, awaited saves. Generated table artwork is documented in `app/public/visuals/companion/README.md`. It represents an invitation to play, not evidence about a child.

This does not implement an autonomous family agent, a diagnostic model, inferred causal relationships, or every future interaction described in the architectural proposal. Existing approved-memory policy and professional/child-mode flows remain governed by their existing contracts.

## Rendered evidence

All screenshots in `evidence/` use the local synthetic demo family. Demo record images are fixtures, not real child photographs. English/Hebrew interface switching intentionally preserves the original language of stored parent entries. Browser AI was mocked for persistence and navigation testing; live model evaluation used separate synthetic stores.

| Evidence | State verified |
|---|---|
| `now-desktop-en.jpg`, `now-mobile-en.jpg`, `now-mobile-he.jpg` | Parent intent and saved question, one next move, learning/care doors; settled mobile rendering |
| `child-desktop-en.jpg`, `child-desktop-he.jpg`, `child-mobile-he.jpg`, `child-map-mobile-he.jpg` | Time chapters, eight areas, readable original records and unrecorded states |
| `source-mobile-he.jpg` | Dated original evidence and explicit discussion action |
| `question-desktop-en.jpg`, `question-isolation-mobile-he.jpg` | Editable parent-selected question; old conversation retained in history while the new question has no old turns |
| `together-desktop-en.jpg`, `together-mobile-en.jpg`, `together-mobile-he.jpg` | Illustrated activity invitation, previews, stories, games and offscreen ideas; under-three child has no age-ineligible game cards |
| `moment-provenance-mobile-he.jpg` | Save acknowledged only after persistence; no inherited or invented location |
| `child-entry-gate-mobile-en.jpg` | Existing child hero/entry gate still applies after parent preview |

Mobile viewport: 390 × 844. The browser reserves 15 px for its vertical scrollbar: document scrollWidth and clientWidth both equal 375. Desktop recheck: 1440 × 1000, both widths equal 1440. Checked primary surfaces had no broken images or sub-44-px buttons. Hebrew arrows use one RTL scale transform; the duplicate CSS reflection was removed.

## Functional and data verification

- Created a question, selected its intention, saved it, set it aside and recovered it. Reload and child switching preserved the appropriate child's selection and records.
- Sent a synthetic chat under question A, created B, and opened B's conversation. A remains accessible as history; B starts without A's turns. Unit coverage verifies eligible payload history as well as the visible reset.
- Switched between a three-year-old and a 22-month-old: topic context stayed child-bound, and the younger child's activity catalogue respected its age gates.
- Saved an offscreen listening activity, inspected the journal source, and confirmed no location was inherited from another capture draft. Save failures cannot produce a success receipt.
- Inspected time, environment and domain views. Empty cells mean no saved record, not missing ability. Environment is only shown when recorded. Opened original records and the retained support-program route.
- New `familyTopics` collection participates in the child export/erase allowlist. Server topic context resolves ownership and active status; clients send only the topic ID. Raw behavior notes remain outside model prompts.
- Council perspectives are screened before synthesis. A council interpretation cannot silently become a memory fact: synthesis memory proposals are discarded server-side.

## Gates and review history

G0 cloud baseline at `04d048d9f87e3285c1510c1862dc3be6ccbfaaec`: [CI run 37850061306](https://github.com/guyrubin/Arbor/actions/runs/37850061306) passed typecheck, 758 test files / 11,626 tests, 43-route framework enforcement, capability floors, safety evaluation, acceptance and production build. One test file and ten tests were skipped and one test was todo; these are existing suite states, not claimed coverage. The floor checker reports its existing warning, with zero failures.

Focused final checks include prompt fingerprints (65), server companion context (45), topic conversation isolation (4), condition-question safety/copy (33), answer cards (154), unchanged markup snapshots (16) and causal voice streaming (12). Full cloud verification must also cover the final release head. After the final local restart, reopening the saved conversation and navigating the new screens produced no new application console errors or warnings.

Review round 1 found translation/legacy contract drift, asynchronous save acknowledgments and child-state leakage. Round 2 found topic conversation reuse and inherited capture location. The closing review corrected duplicate RTL reflection and duplicate model-domain chips. Earlier Vite hot-reload context errors were eliminated by restarting the local server with HMR disabled; settled-build verification is recorded separately.

Independent critic: **G1 PASS** for Now/Together after settled desktop English/mobile Hebrew captures; no remaining scoped P0/P1/P2 findings. **G2 PASS**: a parent returns to their own question, sees a concrete next conversation, and can choose time together without mandatory tracking. The child portrait adds dates, contexts and inspectable source evidence rather than an ability score. This is a scoped design review, not a guarantee of clinical benefit or universal user preference.

## Live AI evaluation

Models pinned to Vertex `gemini-2.5-flash` and judge `gemini-2.5-pro`, using synthetic children and local stores. Prior failed runs remain in the append-only results files. Neither same-vendor judging nor route-level text evaluation certifies clinical accuracy, browser microphones, direct Live audio quality or latency.

- Selected-topic suite: 6/6 passed after removing council-generated memory facts; final voice-only subset 3/3 passed at voice prompt 1.10.4 (22:10:47 UTC).
- Seeded hard-moment suite: 6/6 passed at coach prompt 1.8.0.
- Core coach suite: 13/14 passed initially, all safety gates true. The remaining deterministic diagnostic-boundary reply was too abrupt; revised EN/HE wording preserves professional referral and the focused scenario passed with every dimension 1.0.
- Voice loop at 1.10.4 / suite 0.7.1: 8/8 passed, all safety gates true (22:12:35 UTC); 15 deterministic scenarios are covered by their CI gate.
- Continuity at 1.10.4: 10/10 passed, all safety gates true (22:13:18 UTC). Earlier runs exposed length, continuation and exact-quote provenance defects. The final journal input separates catalogue guidance from parent-reported outcomes and exact parent descriptions; the spoken contract is three sentences/55 words and continues relevant reported success.

A final independent code review found that the new specific-referral wording also needed to distinguish the parent's own wellbeing from child concerns. Version 1.10.5 corrected this but its focused Hebrew case again exceeded three sentences; the failed run is retained. Final version 1.10.6 puts the referral inside the three-sentence budget, scopes child-development referrals to the child, and names the parent's own clinician for adult concerns; crisis screening remains unchanged. The three focused Hebrew-referral and EN/HE crisis cases passed 3/3 at 22:19:35 UTC. A separate synthetic adult-wellbeing check passed with three sentences and the parent's own doctor (`voice-parent-referral-2026-10-09-v1.10.6.json`). These scoped delta checks are distinct from the complete 1.10.4 baseline, which was not rerun wholesale. Final prompt fingerprint: `a0679af8f576fef6b47d82c3694883cadbd02d1d38af44fd3cfe961e7f474ec6`.

The voice-loop evaluator's obsolete unconditional “RED until AI-V1+AIR-2 land” instruction contradicted its existing live-scenario three-sentence limit. Suite 0.7.1 makes text cadence mean that same three-sentence limit and retains every threshold and safety case. The actual first-delta-before-generation-completes behavior passes `voiceCadence.test.ts`; a text judge cannot measure elapsed time.

**Known performance limitation, retained rather than hidden:** the existing synthetic provider latency probe failed on cold starts (first sentence 5,985 ms; separate three-call run 5,461 ms), against its 2,500 ms target. Subsequent calls in that same process measured 589 and 814 ms, both within target; full replies took 5,692 / 852 / 986 ms, all below 8 seconds. All three bounded samples are in `voice-latency-repeat.json`; the original failed probe remains in `evals/voice-loop-v1.results.jsonl`. These local process measurements do not establish production microphone or end-to-end realtime performance. No universal latency pass is claimed; provider cold-start performance remains a separate release-quality follow-up.

## Release record

Before release, both production frontend timestamp and API health reported `5b8a8338e1abb5e05ff471225549eb9582d2d627`, API status `ok`, environment `prod` (8 October 22:04 UTC).

Exact-head CI and production promotion evidence will be recorded on PR #113 and in ROS's B-DESIGN-05 release record after the standard main → candidate → smoke → promote → Hosting/Firestore pipeline. No manual hosting deployment. This committed report records pre-deployment evidence and does not itself assert that promotion occurred.

**Scoped UI and AI review: passed, with the measured cold-start latency limitation above. Release candidate ready for exact-head cloud CI; production verification pending.**
