# Bounded Parent confirmed-action capture

This is a source-only extension for the next Parent batch. It does not claim a
rendered pass, a Firestore acknowledgement, full-backlog completion or release approval.

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
- Routines: partial versus completed checklist, truthful local-device receipt, trusted
  repeated toggles, reload without replaying an action receipt, selection/reset/sibling
  retirement, local storage failure and retry through a new completion.
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
- The browser clock fixes 10 October 2026, 09:00 Asia/Jerusalem. Consult expiry/recovery uses
  clock changes and ordinary same-target hash-query rerenders. It proves mounted editor
  identity and blocking under that eligibility transition only. It does not simulate a
  Firestore snapshot, listener failure, reconnect, durable draft save or remote metadata.
- A local failure is armed only after hydration for one known synthetic child's exact
  `actionLoops` or `routines.done` key. The actual Storage setter throws before writing.
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

## Author verification

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
publication, CI trigger or deployment ran. Independent harness review and exact-final-SHA
CI/rendered EN/HE mobile/desktop evidence remain open. The release owner chooses the final
sweep after all runtime corrections are integrated.
