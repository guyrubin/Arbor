# B-ASKJB-23: one capture sheet and Journal record

## Scope and source

Canonical requirement: ROS `PAI/projects/arbor/execution/2026-10-01--one-backlog/lane-ASKJB.md`, lines 541–557; Parent manifest row B-ASKJB-23. Source baseline: `41d532c95501382cf306f442bc7f8c092fd3c4f8`.

This removes the duplicate Behaviors form and record grid. It preserves the current action-first capture heading and desktop guide rail, which supersede the older backlog's HubHero wording. There are exactly three modules: capture, guides, patterns.

Dependency inspection found B-TODAY-19/20 and B-ASKJB-30/14 already implemented: QuickLogModal owns photo/voice/typed capture, review, save reply and Undo; Journal owns in-place edit, hard-moment resolve/delete, search and PDF. The broad integration branch still contained the old Behaviors form/list, so no completed consolidation was duplicated.

## Preserved paths

- The three situation starters remain in the shared sheet. They change classification only, preserve parent-entered words and values, and require the normal validation/review/confirm path. Fabricated example events/ratings have been retired.
- Text/voice/photo continue through QuickCaptureBar to the existing shared sheet; AI drafts still require explicit review. No model, prompt, provider, photo-storage or guide-content change.
- The Behaviors record link requests Journal's Hard moments filter. The request bypasses shelves and clears old query/facets/selection. A newer row-focus request wins over an older filter request. Child changes remount the feed.
- The Journal record preserves every persisted parent-log ID, even when the story folds matching type/trigger/minute rows. Distinct records remain individually searchable, editable and exportable through the existing PDF fields. Child-activity and word-day folds stay unchanged.
- Journal retains type, observed intensity and open/resolved facets under More filters. Its PDF exports only the visible log rows, including plain moments when viewing All, matching the old list's capability.
- Full trigger, response, notes, context, duration and optional incident intensity are available in the Journal entry. Intensity is neutral text, never a colour, meter or derived assessment. Resolve/delete remain available on parent-owned plain moments as well as incidents.
- Per-log script generation, SayThis copy/read-aloud, next step and coach handoff use the unchanged handlers from the Journal entry.
- PatternInsights, Find the pattern, saved analysis actions and 30-day flat counts remain in Behaviors. Its echo listens to a newly committed same-child row identity; edit of that identity retires it and Undo removes it. Dismissal and the Plans CTA retire the provider-owned identity, so navigating away and back cannot resurrect it.
- A source capability-owner manifest is consumed by both floors and framework checks. Historical safety/accessibility guards now follow the actual shared-sheet or Journal owner rather than protecting a retired duplicate.

## Verification boundary

The new five-test consolidation contract failed on the baseline and passed after implementation. Actual production callback tests cover filter/focus replacement, Journal route handoff and clearing stale selection. Functional shared-sheet tests cover deferred saves, photo/voice/AI review, failure/escalation, close/unmount and child/draft changes. Journal detail controls are exercised in EN and HE.

Final affected regression batch after corrective review: 46 files / 887 tests passed, one Vitest file at a time with the offline network guard. One source-selector test needed a JSX AST parser repair after encountering an arrow function; its final 15-test file passed.

The corrective regression proved all three initial review gaps red, then green. Offline safety eval passes (11 risky/9 benign fixtures), and offline acceptance passes with the live tier disabled. The npm tsx CLI hit the offline guard’s IPC listen restriction; the same scripts ran via node --import tsx with the guard still active.

Source gates: framework passes; floors report 28 PASS, 0 FAIL, 1 unchanged pre-existing warning for the absent persisted coRegulationScript field. The existing script entry remains reachable; no persistence schema was invented to hide that warning.

The existing 737a3b5 mobile/desktop EN/HE screenshots were used as the design baseline. No new browser run, local typecheck, provider call or production data access was performed. Independent review of the initial candidate found the record-folding, echo-lifecycle and orphaned-starter gaps described above; corrective review is pending. Exact-commit cloud types, rendered 390px/RTL interaction evidence, independent review and release approval remain required before publication or release. Source tests do not certify geometry, focus, visual quality or provider responses.
