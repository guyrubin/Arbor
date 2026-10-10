# Bounded Parent confirmed-action capture

This is the bounded diagnostic extension for the next Parent batch. The first actual
run at `8802cea` retained all 196 frames but passed only 130 cells. It is not a rendered
pass, a Firestore acknowledgement, full-backlog completion or release approval. See
`CONFIRMED-ACTIONS-8802CEA-REVIEW.md` for the retained failures and corrections.
The next run at `73ad139` passed 40/196; its pre-shot traces exposed the synthetic
clock/native animation timing mismatch described in `CONFIRMED-ACTIONS-73AD139-REVIEW.md`.

## Scope and isolation

The existing release image, network-none guard, exact-font cache, synthetic family,
source SHA/tree identity, screenshots, partial-evidence retention and aggregate verdict
are reused without weakening them. No font binary, runtime app source, provider setting,
network guard or upload allowlist changes here.

The `confirmed-actions-only` scope adds four shards: EN/HE at 375×812 and 1280×800,
49 interactions each, 196 required exact-font screenshots. Publishing the dedicated
`codex/parent-confirmed-action-loops` branch selects this bounded scope. Publication and
CI execution remain the release owner's decision; neither was performed while authoring.

The existing `record-release` contract remains 172 base + 490 interaction cells = 662
cells, including all 49 record states per viewport and actual print receipts. Cell totals
are not PNG totals: mobile base captures also emit folded/full frames. The completed
PR122 pass had 748 app PNGs plus four separate print previews.
Its sole compatibility change replaces an ambiguous saved-note button click with the
specific existing `ms-keepsake-edit` button. Every provenance-negative fixture remains.
The optional pure `confirmed-actions-release` matrix is strictly additive: the 196 new
cells plus the existing 662 cells, 16 shards, 858 cells and four print previews. It is
not the dedicated branch's default, and does not decide which final sweep is required.

## Actual browser actions encoded

- Now: one source-owned parent-note/tried-step lead with correct attribution; real
  answer failure/retry and local reload persistence; explicit Tonight clicks overriding
  both a chosen step and a visit; a confirmed near-visit's actual profession and one-entry
  targeted Consult navigation; real browser Back and Forward.
- Consult: actual text entry; same DOM editor retained hidden/inert during synthetic
  appointment expiry, recovered with the draft intact; missing targets cannot fall back
  to another valid appointment; real sibling switching retires the previous draft.
  The teacher PDF approval portal is opened through its actual control, retired on clock
  expiry, and its previous element must reject clicks. An actual unsaved teacher edit
  retains its DOM node and words through that transition. Recovery requires a fresh review.
  That new review is cancelled; unexpected downloads/popups fail capture and are cancelled/closed.
- Yes / Not today: real say-back controls stay in More for today, throw a local write
  error without a saved receipt, then save one exact parent-act row on retry. Chosen
  Helped / Not this time controls similarly retain their original row after failure.
- Milestones: the same parent-kept row and attribution, with the AI negative still stored
  but absent from its quote projection; real editable text review, cancel/focus return,
  reviewed text-only sink delivery, editor cancel/save/reload, stale opening and final-send
  guards for both row and retained editor, and actual closed-editor child round trips.
- Routines: the actual Plans disclosure and two invented registered routine records;
  partial/completed checklist, truthful local-device receipt, acknowledged undo/recomplete,
  reload without replaying a receipt, two-card isolation, reset/child retirement, local
  storage failure with no falsely completed step, and the explicit retry control. The
  retired `#/routines` alias remains redirected to Plans; no hidden component is forced.
- Family: actual turn-card and library starts, local failure and Retry, saved first-step
  receipt and its Open link arriving at Now, disabled repeat controls, reload without
  replaying a receipt, and settled failed/saved feedback retirement across child switches.

Action checks include real visibility, centre hit testing, the main scrollport, 44×44
minimum action geometry, document containment and EN/HE direction. These checks can expose
layout defects; their presence in the script does not mean those measurements have passed.
The existing collectors retain actual failure screenshots, and reached flags without
passing assertions, exact source identity and screenshot evidence cannot pass aggregation.

## Fixture boundaries

- All records are invented. Storage setup uses the existing hydrator and registered child
  collection keys. The original incident/AI/practice/unknown/co-parent negatives and genuine
  catalogue citation are preserved in every relevant variant.
- A synthetic Date-only fixture fixes 10 October 2026, 09:00 Asia/Jerusalem; native
  performance, timers, rAF and WAAPI time remain unchanged. Consult expiry/recovery uses
  business-date changes and ordinary same-target hash-query rerenders. It proves mounted editor
  identity and blocking under that eligibility transition only. It does not simulate a
  Firestore snapshot, listener failure, reconnect, durable draft save or remote metadata.
- A local failure is armed only after hydration for one known synthetic child's exact
  `actionLoops` or registered `routines` key. The actual Storage setter throws before writing.
  Other keys/storage instances remain untouched. A `finally` restores its original
  descriptor before the real UI retry; capture records the rejection and unchanged value.
  No hook, React internals, DOM content, confirmation flag or SDK metadata is substituted.
- Reviewed Send uses the pre-existing browser share sink. There is no native OS handoff,
  external recipient, clipboard write, photo selection/upload, PDF send or live user data.
- Local synchronous writes cannot establish a sustained pending/server-acknowledgement
  state or interrupt a real remote promise. Firestore cache/pending/error transitions,
  account changes, cross-device races, Family cross-caller ordering and topic/language ABA
  require their separate source/reviewer evidence and any explicitly authorized remote QA.
- Switching a child behind an open modal is not forced. The Milestones flow first closes
  the real editor, then switches and returns; it does not claim pending-modal lifecycle proof.

## Initial author verification

The final 49-state revision was checked on integrated runtime/harness base
`160bd8cd1341fa2a243383923b9a762be0444d20`, including the reviewed targeted-Consult
egress correction and the prior record-readiness correction. Five files ran in separate
serial Vitest processes with installed dependencies, `--maxWorkers=1`,
`MODEL_PROVIDER=mock` and `NODE_OPTIONS=--require=/tmp/arbor-offline-network.cjs`:

- `captureConfirmedActions.test.ts`: 14 passed
- `captureRelease.test.ts`: 10 passed
- `captureRecord.test.ts`: 13 passed
- `release-interactions.test.ts`: 16 passed
- `captureHarness.test.ts`: 7 passed

Final revision: 60/60. These cover fixture selection through the actual pure selectors,
source attribution and target selection, preserved provenance negatives, matrix/aggregate
completeness and negative controls, the exact storage-fault/restoration seam, source-level
portal lifecycle expectations, passive editor readiness and geometry failure predicates.
They are contract/source checks, not an execution of the browser flows. JavaScript syntax
checks and `git diff --check` also passed. The earlier 48-state run was 57/57 and is not
substituted for this final revision's result.

No host browser, local typecheck/build, full suite, provider/model invocation, remote data,
publication, CI trigger or deployment ran in this author lane. Independent harness review and exact-final-SHA
CI/rendered EN/HE mobile/desktop evidence remain open. The release owner chooses the final
sweep after all runtime corrections are integrated.

## Readiness correction after the first actual run

The collector now observes actual route ownership, a nonempty rendered body, ancestor
opacity/transforms and pending/running animations before reading strict geometry or
capturing settled states. Actual child and visit transitions retain before/after/last
observations and action-stage markers if they fail. Observations never finish/cancel an
animation, mutate a style, synthesize an event or change application metadata. The 8s
readiness budget is unchanged. A blank route remains a failure; readiness does not prove
its unobserved cause. Receipt Open is selected in the actual shared row around its text.

Corrected source/contract verification ran against integrated base
`a1cc586fa17912d3adbb1c827436b6b5b7bf39f1` in five separate serial installed Vitest
processes, with the same offline preload, mock provider and one worker:

- Confirmed actions: 16 passed
- Release aggregation: 10 passed
- Existing record: 13 passed
- Existing interactions: 16 passed
- Existing harness: 7 passed

Total: 62/62. All edited JavaScript passed syntax checks; `git diff --check` passed.
No browser, local typecheck/build or provider call ran in this correction lane. These
checks do not establish that blank transitions are fixed. Exact corrected-source pixels
remain required, and the earlier 130/196 run stays a failed diagnostic.

## Interrupted-flow acceptance control

Settled geometry does not replace rapid navigation coverage. Within the same 196 cells:

- `visit-target-arrival` preserves the original fresh Now load → visible visit → actual
  Prepare click, with no added route-animation settlement before that click.
- `milestone-child-return` preserves closing the edited sheet → actual sibling selection
  without the new pre-switch settlement wait. Its replacement body must still appear.
- `ritual-saved-child-return` starts with a fresh real saved receipt, then uses actual
  child controls for A→B→A. It observes B's selected profile but does not wait for B's
  body or animation before switching back. A must return nonblank and settled, with
  that feedback retired and exactly one local action row. A retained original A DOM
  node is recorded, not artificially required to be replaced.

The rapid amendment passed the affected confirmed-action file (17 tests) and release
aggregation file (10 tests), each serially with the same offline/mock guard. The existing
62-test five-file result above remains the preceding correction's result. Syntax and
diff checks passed. Blank outcomes are still hard failures pending real rendered proof.

## Date-only correction verification

On integrated base `691c489`, final affected contracts passed 44/44: confirmed actions
18, release aggregation 10, and interactions 16, in three separate serial installed
Vitest processes with one worker, the offline network preload and mock provider.
A test-only observer stub initially lacked its cleanup method; that failed run is
retained separately, the stub was corrected, and the final rerun passed. JavaScript
syntax and diff checks passed. No local browser, typecheck, build or provider ran.
Exact-source CI and native-timeline/rendered confirmation remain required.
