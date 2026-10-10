# Single current goal: bounded synthetic capture

## Scope and source

This additive group is `single-goal`; its dedicated CI scope is `single-goal-only`.
It contains 49 named states at 375×812 and 1280×800 in English and Hebrew:
196 distinct state-named PNGs and 196 corresponding exact-font receipts.
The authoritative state/required-fact manifest is `single-goal-contract.mjs`.
The prior release scopes and all app runtime files are unchanged.

Prepared against corrected source b5806a2e4b76e6646bef23c4c45d4bb09fa63c69
(app/src tree 6347329332f59714ab3f320b7353c99dd09b8796), after independent
review of the goal-only provider/session lifetime correction. The exact checkout
commit and app/src tree travel through the existing capture, inventory and cell
receipts. This document is preparation, not a claim that rendering has run.

The workflow's candidate branch is `codex/parent-single-goal-capture`. The parent
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

## Fail-closed keyboard gate

The collector traverses the native visible sequence including Earlier's `<summary>`
using real Tab/Shift+Tab. Directly focusing the final summary cannot make the test
pass. At the source baseline, `dialogStack` omits `summary` from its tabbable selector,
while GoalBuilderModal supplies a native summary without an explicit tabindex.
The source-level probe preserves this omission as an unresolved gate. It is not
browser reproduction. Do not patch runtime or weaken the harness to pass it.
A separately reviewed source correction would require new exact-source parity.

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
