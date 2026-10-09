# Augmented Arbor — release validation

Parent register. Benchmark: production `286295344c4c98aec3d809da5e701d0ed8dd0723`, where capture and conversation were separate destinations and structured answers repeated their content. Scope: persistent companion, multimodal input, daily recommendation, and complete structured answers. PR: https://github.com/guyrubin/Arbor/pull/115.

## Evidence and state

All screenshots use invented demo-family data and the mock provider. Live model evidence is separately recorded in `evals/companion-multimodal-v1.results.jsonl`; screenshots do not prove model quality.

| Evidence | Actual viewport | State |
|---|---|---|
| `desktop-report-en.png` | 1280 × 720 | Now and a complete report beside it; persistent composer |
| `mobile-now-en.png` | 390 × 844 | Chosen daily step and compact global companion launcher |
| `mobile-report-en.png` | 390 × 844 | Full-width explanation, reasoning and actions; all input controls reachable |
| `mobile-now-he.png` | 390 × 844 | RTL interface; an existing English chosen step remains in its saved language |
| `mobile-report-he.png` | 390 × 844 | Fresh Hebrew report; existing English demo memory quoted rather than altered |
| `mobile-photo-keep-he.png` | 390 × 844 | Photo and editable text carried together into capture |

IAB viewport emulation required making the preview visible; hidden-tab size overrides were ignored. Reported dimensions above come from the rendered DOM. Chrome's screenshot API timed out under emulation; no Chrome capture is counted as evidence.

## Exercised flows

- Daily recommendation → choose today's step → confirmation and persisted chosen-step card.
- Text plus a synthetic PDF → change from Now to My child → same draft and attachment → send → one structured report, file receipt, cleared sent attachments.
- Expand conversation → return beside page → editable draft retained, pane no longer inert. Opening a side pane moves keyboard focus into it.
- Read a full report without a second prose copy or duplicate bottom save tray. All explanation, hypotheses, action steps, script, observation and avoidance content stays in the report; sources remain optional detail.
- Mobile English and Hebrew layouts; close returns to the launcher. Modal conversation covers navigation rather than leaving it over the input.
- Text plus a public Arbor icon → Keep a moment → editable photo/caption preview → save → explicit saved-in-Dylan's-journal confirmation. No real child data used.
- Pending photo/text draft for Dylan → close → switch to Leni → reopen → empty input, no attachment and no Dylan conversation history.
- Hebrew mobile DOM: `innerWidth=390`, `clientWidth=scrollWidth=375` (15px desktop scrollbar); modal height 844. Send is 46px; Photo, File, Dictate, Talk and Keep actions are all at least 44px high. Zero captured application console errors.

## Regression rounds

1. Unified persistent input and report; initial cloud run identified stale source assertions and a test typing defect. Migrated only assertions whose expected product behavior changed.
2. Rendered desktop inspection caught intrinsic-width collapse of the report. Added flex growth and simplified nested report chrome. Independent critic caught retained-modal retirement, missing side-pane keyboard focus, and stale thumbnail error ownership; fixed with targeted regressions.
3. Actual mobile rendering caught the page-shell stacking context trapping the conversation below MobileNav, and broad span selectors affecting icon glyphs. Removed the ancestor stacking context and scoped launcher labels; final captures show corrected layering and controls.

No open visual defect was accepted for release. No new palette or decorative imagery was introduced: this change reuses the existing parent tokens, fonts, mark and icons.

## Automated and live-model evidence

- Last pre-final cloud run: lint passed; 762 test files passed, three failed, one skipped. The three failures were the attachment prompt registry entry, Hebrew brand spelling and an outdated route-scroll assertion; corrected and targeted checks passed. Final exact-head cloud run remains the release gate.
- Targeted regressions include attachment route (9), attachments (5), source policy (4), composer lifecycle (14), report layout (17), dialog controller (20), mobile chrome (10), prompt registry (67), eval acceptance (21), Hebrew narrative copy (17), scroll behavior (6), Now model/view and scoped fetch. Full suite runs in CI because local memory is constrained.
- Capability floors: 27 pass, one pre-existing co-regulation warning; no new failure.
- Attachment policy is registered as `companion_attachments` v1.1.0. Original file bytes are transient; future typed/voice turns explicitly know that originals are unavailable and cannot quote unseen lines.
- Live eval uses Gemini 2.5 Flash with Gemini 2.5 Pro judge. The 07:34 UTC run passed prompt-injection handling, unavailable-original voice follow-up and crisis priority; English document got a provider 429 and Hebrew document timed out. Targeted retry at 07:38 UTC passed both document cases (2/2). Thus each of five live scenarios passed on the final policy, across those two runs. Earlier failures remain in the append-only results, including the v1.0 hallucinated original-line case that motivated v1.1.
- Microphone hardware/OS permission and actual spoken audio were not exercised. Dictation lifecycle, continuity and voice-route behavior have automated/live-route coverage; this is not a hardware certification.

## Release status

At this commit: final exact-head CI and production deployment verification pending. Do not interpret the rendered evidence or targeted tests as production certification. Final gate evidence is recorded in the PR and ROS deployment reference after the pipeline completes.

Final result: pending exact-head release gates.
