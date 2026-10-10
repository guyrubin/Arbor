# Single current goal: bounded synthetic capture

## Scope and source

This additive group is `single-goal`; its dedicated CI scope is `single-goal-only`.
It contains 49 named states at 375×812 and 1280×800 in English and Hebrew:
196 distinct state-named PNGs and 196 corresponding exact-font receipts.
The authoritative state/required-fact manifest is `single-goal-contract.mjs`.
The prior release scopes are unchanged. Capture corrections do not edit app runtime files; the separately reviewed keyboard correction is documented below.

Initially prepared against corrected source b5806a2e4b76e6646bef23c4c45d4bb09fa63c69
(app/src tree 6347329332f59714ab3f320b7353c99dd09b8796), after independent
review of the goal-only provider/session lifetime correction. The exact checkout
commit and app/src tree travel through the existing capture, inventory and cell
receipts. This document is preparation, not a claim that rendering has run.

The workflow's candidate branch is `codex/single-goal-capture`. The parent
must separately authorize publication and execution. No push, hosting, deployment,
merge, dependency change or font binary is part of this work.

## Request and terminal-evidence correction

The first package's independent review found fixture-glob admission and terminal
counter gaps. The corrected group installs its authority guard last, so Playwright
executes it before every fixture/API/cache/static/font handler. Only the exact
local GET demo-family path is a fixture; suffix, foreign-origin, method, query,
encoded and normalized-path variants are refused. Credential-bearing requests,
auth/account paths, unknown APIs, foreign children and non-API writes are denied.

Safe GET APIs are explicitly enumerated: local TTS capability, entitlement,
live availability, memory/consent for the three invented IDs, and owner share-list
reads with exactly one approved childId. Existing mock today's-focus/digest POST
reads require a demo childProfile with an approved ID. No new auth response,
provider success or remote persistence is invented. API fetch redirects are not
followed. Static requests must name an actual built file; the only external URL
identities admitted are exact entries in the verified disposable font cache.

Every cell resamples all denial counters after its screenshot and diagnostic
awaits. A separate final receipt is sampled after context and browser shutdown;
missing/nonzero counters or incomplete shutdown fail both collection and aggregate
acceptance. Earlier zero assertions cannot override a late denial. Offline tests
run the actual routing registrations and installed Playwright glob matcher against
stubs, including real LIFO/fallback order, without launching a browser or socket.

## Actual fixture and interaction method

- Only the existing guarded CI runner: fresh Docker runtime with `--network none`,
  `MODEL_PROVIDER=mock`, no inherited credentials, no Firebase configuration,
  no real account/family and no authenticated production access. Existing source
  font URLs are cached transiently in a disposable CI container before isolated
  runtime. No font binary/image leaves CI or enters source control.
- `singleGoalFixture` supplies three explicitly invented demo children through
  the existing `/sandbox/demo-family.json` response and actual `hydrateDemoFamily`.
  It does not replace application components, hooks, source, auth or transport.
- History has three records including a retired ID, original stored labels and
  nested extra data. Empty has no goal. Long has two unknown/retired IDs with full
  EN/HE labels. One invented observation is retained in every child's actual
  collection; every collection and unrelated profile field must remain exact.
- The real child picker switches these preloaded children. It is keyboard-opened
  and selects a visible option. No child switching behind a modal is manufactured.
- The watch choice is separately labeled as a one-time local fixture, installed
  before startup and never restored by the harness after clear or reload.
- Every subsequent goal/watch change uses actual visible controls. Browser Back
  and Forward follow the real Profile→My child door. Actual Enter, Tab,
  Shift+Tab, Escape, Cancel, Close, reload and reopening are exercised.
- Every state records settled concrete DOM/animation/child/route facts, current
  main/dialog text, direction, module/primary budget, horizontal overflow,
  relevant 44px geometry, unchanged collections/profile fields, exact goal-array
  history and denied-mutation counters. No generic `reached` flag can substitute
  for state-specific required assertions or an exact state-named PNG.

## State families

- Four current routes with history, empty and long-label fixtures: Profile,
  My child (`development`), Daily Play and Plans. The first three show one read
  line; Plans receives the current-route text/budget regression without a new goal UI.
- Actual Profile door arrival, current picker, sequential keyboard traversal,
  explicit replacement question, Cancel, Close, reopen, local save and reopen.
- Earlier listing, explicit reselection, preserved-record local save and reopen.
- Browser Back retirement, Forward without a stale picker, real reopen.
- The second current picker mount on Daily Play: question, Cancel, save,
  reopen and Escape returning focus.
- Empty picker/choice/Cancel/save/reopen; long current and Earlier labels,
  question/Cancel/reselection/save/reopen; child return and actual reload.
- Watch chosen, actual clear receipt and actual undo in both languages, including
  the corrected Hebrew receipt and forbidden `focus`/`מיקוד` text gate.

## Failed first render and bounded correction

Run 38037463715 at source 33ec607df6be50a427677b81b377f33bbc5435b3
produced 140 exact-font PNGs, with **0/196 accepted states**. All four
viewport/language variants attempted the same 35 of 49 states. Each final
receipt reported 14 denied actions/requests/mutations and zero external requests.
The old receipt did not retain endpoint categories; those 14 historical requests
cannot be conclusively identified after the fact.

Source tracing identifies an automatic request made by `KidModeButton` on each
full load: `ensureBookNarration` starts the default book's first name-bearing
file, `cover.mp3`. A network abort causes the source builder's 8s/16s retry path.
The corrected guard recognizes only the exact local POST for one of the three
invented demo child IDs, with exactly the source book/file and the fixture's
EN/HE voice folder. It returns a separately counted, labeled local 409 refusal
before fallback or fetch. Source-builder tests prove the refusal stops without
retry, a successful generation, or a saved narration document. This is not
retroactive proof of the old requests. Every other method, child, sibling path,
query, extra body field, book/file/language, credential-bearing request or
unavailable metadata remains fail-closed. Complete `allHeaders` admission stays
first, ahead of fixture/static/API/font handlers. New denied-reason/category
counters and at most 24 fixed-enum samples travel through cell and shutdown
receipts; no raw request URL, body, header value or arbitrary error text is kept.

The old collector also performed a full route load and final picker cleanup
outside named cells. An exception there aborted the remaining long-label/watch
coverage. Setup now occurs in the named picker cells, and the following named
route load owns retirement. A remaining modal makes reopen explicitly fail.
No forced close, changed DOM, wider timeout, altered app callback, restored
fixture, or invented successful save is used. The same 49 unique intended states
remain required per variant, totaling 196; a diagnostic screenshot never passes a
failed state.

Each failed real action now records its exact operation (click, detachment,
focus return, storage/readiness, navigation), a fixed error category, and passive
bounded control count/geometry, hit testing, inert/hidden state, focus and storage
shape. This separates a click that never dispatched from a picker that remained
after dispatch, duplicate selectors, and a detached-picker focus-return failure.
It does not change the settled-frame, 44px, history, vocabulary, font, or terminal
zero-denial gates.

### Offline proof and remaining rendered gates

Installed Vitest, one file at a time with `--maxWorkers=1`: request admission and
actual source-builder checks 13/13; passive diagnostics and all-state scheduling
13/13; existing 196-state capture contract 27/27. Replacing only the collector
with its actual pre-correction 235f0e3f source makes the new scheduling test fail
at its unrecorded route load; restoring this correction passes. No browser,
typecheck, build, network, model/provider or publication ran locally.

The four archived variants have identical unresolved interaction results:

- Keyboard reverse traversal: actual receipt `[0, 0]`. Separately corrected in
  runtime commit 98e8882a5b23dd00002209f7f3c0d53aacf7070f, with native summary and
  collapsed-details filtering. Capture still uses real Tab/Shift+Tab and must
  verify this corrected source in all four rendered variants.
- Timeouts: `picker-close`, `replacement-save`, `earlier-question`, `earlier-save`,
  `browser-back`, `daily-picker`, `daily-question`, `daily-cancel`, `daily-save`,
  `daily-escape`, and `empty-reopen`.
- `browser-forward` failed its no-stale-picker assertion. `empty-save` failed
  with the old generic interaction category.
- Never attempted: `long-profile`, `long-development`, `long-daily-play`,
  `long-plans`, `long-picker`, `long-earlier`, `long-question`, `long-cancel`,
  `long-save`, `long-reopen`, `history-child-return`, `watch-chosen`,
  `watch-cleared`, and `watch-undo`.

Pixels show the original picker retained after Close/replacement-save; the Back
font receipt has `#/profile` while still sampling the modal. Empty-save pixels
show a changed current choice but do not prove closure or preserved history.
Source tracing through GoalBuilderModal → useDialog → dialogStack and the
parent's close handler did not establish the cause. These observations do not
justify a selector substitution, timeout extension or runtime repair. The next
bounded exact-source diagnostic replay must identify that boundary and remains
an acceptance gate. All 196 states remain unaccepted until fresh evidence meets
the complete contract.

## Explicit non-claims

The sandbox goal writer resolves locally and does not offer a remote pending or
failure seam. Remote acknowledgement, failed-save/retry across close/reopen,
changed-source admission, owner A→B→identical-A and overlapping obsolete/new writes
remain offline corrected actual-source persistence/lifecycle test evidence.
There is no fake successful acknowledgement, fake browser pending spinner, forced
React callback, provider request or account transition in this capture.

Local storage receipts and reload do not establish quota/access-failure durability,
Firestore behavior or cross-device transactional protection. Browser history is
not native Android Back. Font/PNG/geometry coverage is not visual/native-Hebrew
approval. Typecheck/build/full CI and publication/release approval remain separate.

Canonical B-GROWTH-40 full-row HOLD/re-sort under P5 B-LOOP-09 remains. ActionPlan
linking/next-step coupling, P5 practice/program ownership, new Now offers, prompts,
historical hub reconstruction and full Parent acceptance are outside this slice.
