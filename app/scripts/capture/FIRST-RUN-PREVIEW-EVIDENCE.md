# Authored first-run: bounded DEV preview evidence

This is an additive **development-preview capture scope**, not production onboarding
acceptance. The recorded CI run below produced real PNGs but remains incomplete.
The release owner must authorize each new CI run and review its real PNGs and JSON.
No app runtime patch was added to enable this capture.

## Exact source integration

- Parent/Kept/Kids base: `737dc55cd686dd563dfaa6bc55f3b368d7e57356`.
- Reviewed authored first-run source: `485f616612d8fa4ba430a97c2b41c1dc6a5dde70`,
  based on `372debd4` via `f5b91b59dfc8ff837205d5abe3e3e65fa98bd155`.
- Clean cherry-picks: `239db1f8` and `0e86ebaaf8443e1383aea08d8d15fb584c3e3971`.
  Both cherry-picks have the exact original stable patch IDs, respectively
  `0b62f7f0332e356bfa46650f872e382c4cc78195` and
  `20ddc92e61d8c79102b62eac7af0cf045e27cbda`.
- Integrated `app/src` tree: `f67cc7e09a03e2e665da2d06ee30662cdca086de`.
  The capture-only follow-on must preserve this tree. Existing Parent report,
  Kept provenance/history, Kids and shared-modal work remain integrated.
- No donor font, generated-media or other public asset was brought in.
  `ONBOARDING_NOTICE_REVIEWS` stays empty.

## Supported entry and hard limits

`App.tsx` already provides `?onboarding=1`, guarded by `import.meta.env.DEV`.
The production build removes this affordance. `computeNeedsOnboarding` requires
Firestore, while `readLocalProfiles` replaces an empty local list with the default
child. Therefore, there is no supported empty-account production sandbox entry.

This scope uses the existing local server's Vite development handler inside the
same network-none container. It uses the existing `local-sandbox` user and the
existing seeded synthetic family, then creates **one additional synthetic child
through actual form controls**. It never inserts an auth user, changes hooks,
intercepts SDK writes, rewrites profiles, sets a success response or edits CSS.

Local profile writes and the accepted action can be observed in disposable
browser storage. They do not prove server acknowledgement. The first local create
uses `Promise.resolve`, so there is no honest delayed remote-create window to
capture. Source lifecycle tests cover the reviewed races separately.

The DEV force flag stays true after completion. The expected screenshot records
this. A later explicit full navigation removes the query and verifies the real
Now destination; it is never called an automatic ProfileGate exit. The current
flow has no Close control. The collector records that absence and verifies Escape
does not dismiss; it does not invent a Close button or claim Close recovery.

## Coverage contract

Scope: `first-run-preview-only`; group: `first-run-preview`; candidate branch:
`codex/first-run-capture`. Four shards: EN/HE at 375×812 and 1280×800. Fourteen
states each, **56 required cells/primary PNGs**; no 43-route sweep is implied.

1. Initial blank About form, real title, three-step progress, disabled Continue,
   and absent Close.
2. Real Tab into the form and Escape with no dismissal.
3. Name/month/language entered; consent remains unchecked and Continue disabled.
4. Real reload before create: unsaved fields reset; no child has been created.
5. Real Continue: exactly one local child, matching reviewed form fields, selected.
6. Real Back to About: fields/consent retained, no duplicate identity.
7. Continue again: same child, actual Worry screen.
8. Real keyboard selection of Moving, Continue, exact neutral journal notice,
   checkpoint and reachable primary action.
9. Real Back to Worry: selection retained, same child.
10. Continue and real reload: local step-three checkpoint resumes with the same
    identity and neutral notice. This is not pending-write crash recovery.
11. Real acceptance and a repeated real click: completed local profile, exactly
    one matching accepted action, forced preview still visible.
12. Explicit full navigation out of DEV preview: actual Now content, selected
    child and exact accepted recommendation.
13. Real browser Back: DEV preview returns blank, without reopening the completed
    child or creating another one.
14. Real browser Forward: actual Now destination and accepted recommendation.

Every cell carries a DEV-only boundary, observed ready/title/direction frame,
unchanged original-family proof and zero prohibited model/remote writes. The one
exact recorded-child narration request can receive only the separately counted
local 409 refusal described below. Exact
named assertion requirements are fail-closed. Missing cells, duplicate states,
wrong source/tree identity, aliased/unlabelled/cross-state primary PNGs, missing or nonexact-font PNGs and any claimed remote
acknowledgement or production gate fail aggregation.

The pure `first-run-preview-contract.mjs` is the machine-readable coverage and
blocked-gate manifest. Captured documents use `scope: first-run-dev-preview`;
per-cell receipts identify `fixture: existing-dev-onboarding-preview`; PNG names
include both `first-run-preview` and `dev-only`. No label is drawn into or used to
repair the app UI.

## Isolation and execution

The same existing Dockerfile, installed dependencies, exact-public-font cache,
network-none runtime guard, environment allowlist, no-permission browser context,
partial-evidence retention and aggregate are reused. Only this group chooses
`NODE_ENV=development`; every other capture retains the production build. No
second broad runner or package installation was added. Public exact font bytes
stay within the existing ephemeral CI image and never enter the repository.

A last-registered, first-executed same-origin request guard aborts HTTP
mutations, including non-API webhook paths, before any fixture or generic API
handler. Its only exception is the exact recorded-child narration POST receiving
a local 409 refusal, never a successful write or a request to the server. Catchall/demo handlers also reject preview mutations directly. The demo
fixture matches only the exact BASE origin and /sandbox/demo-family.json path,
and only fulfills GET; foreign origins and private API suffixes never receive
its synthetic success. Other model/media endpoints remain denied. Read-only
capability queries retain the existing local handling. A denied attempt fails the receipt; the harness never substitutes a
successful write. Browser storage is read only by this collector; application
handlers own its real local writes. The usual locale/connectivity bootstrap and
existing demo hydrator remain shared harness fixtures, not real authentication.

## Unverified production gates

- Real auth and a confirmed empty remote account.
- Remote profile create/update/action acknowledgement and failed-write retry.
- Pending-create close/reopen adoption and owner/selection A→B→A races.
- Automatic ProfileGate unmount/destination ordering after server acknowledgement.
- Whole-provider crash, cross-tab transactions and native browser zoom.
- Clinical area-specific notices, native Hebrew/product-copy approval.
- Aggregate type/build/CI/rendered/pixel acceptance on the eventual exact commit.

The original befb548 integration ran 13 source files / 233 passing offline tests. This is a fresh integration
run of the already-reviewed affected set, not 233 new tests to add to older
recovery totals. That integration also ran six capture-contract files / 74 tests (10 new preview
cases), for 19 files / 307 tests before the independent-review correction. Local typecheck, build,
browser, publication, deployment and real provider calls remain unrun.

## Independent-review correction

The held `befb548` harness accepted aliased or unlabelled primary files and left
non-API/demo HTTP mutations outside its counter. Those two independent negative
controls are retained unchanged in the original review receipts. The correction
binds each cell and collector to the same exact primary-shot function, requires
14 distinct primary files with one passing font proof each per shard and 56
across the scope, and keeps diagnostic images separate. New tests exercise
aliases, missing labels, cross-state/viewport/locale reuse, missing/duplicate
font proofs, direct route handlers and actual registration precedence.

The original six-test proof is replayed from a separate copy, with only its
output directory and extractor adapted for the new exact-URL predicate. No red
receipt is overwritten. This remains source-only evidence: no browser/CI PNG
claim, real-auth proof, application fix or clinical activation is introduced.

Correction validation: six installed offline capture-contract files pass 79
tests, and the separate adapted replay of the original independent proof passes
6/6. These synthetic contract tests create no rendered PNG evidence. The earlier
13-file / 233-test runtime result applies to the identical unchanged app/src tree.


## Actual capture hold and bounded narration refusal

The owner-run `c21011f7f579fbcb846584f320d39f97ae33c312` capture is tree-equivalent
to local `8825dfeef207a6de7dfaf3daf4dad36f195d25f8`: **56 actual PNGs, 44/56
accepted cells**. All first eleven states passed in all four variants. Explicit
Now exit, browser Back and browser Forward failed the network guards; cumulative
denied counts were 1, 1 and 2 respectively. These original images and receipts
remain unchanged. The old receipts did not retain denied endpoint categories,
so their counters alone cannot establish which exact request was blocked.

Actual source inspection and an offline test executing `ensureBookNarration`
confirm the automatic shell path: `Shell` mounts `KidModeButton`, whose effect
calls the real builder and issues `POST /api/children/{childId}/book-narration`.
The test routes that actual request to the actual capture boundary and verifies
one 409 stops generation before any media/completion storage. This is unit
request-path evidence, not retrospective attribution of the old browser run.

The native collector records only the one child observed after the real About
form creates it, its fields and active selection match, and the original family
remains unchanged. No browser state is written by this recording. The scope
cannot switch to another child. Only that exact same-origin path, POST method,
and query-free URL may receive `409 {code: synthetic_capture_media_disabled}`.
No fixture child, sibling, arbitrary endpoint or provider success is added.
Before every same-origin admission, the capture guard awaits `request.allHeaders()`
(the narrower `headers()` omits security/cookie headers), rejects credential
header presence or URL credentials, and fails closed if complete metadata cannot
be read. Neither header names/values nor error text is exported. This guard
changes only capture admission, never application authentication. Other requests
retain the existing guards.

Every cell must include `firstRunNarrationRefusals` and matching bounded
method/category/disposition counts, with at most eight recent entries. No raw
child ID, path, query, body or header is exported by these diagnostics. Missing
or inconsistent accounting fails the contract. The collector resamples counters
after the screenshot and all asynchronous readiness observations and requires
`FIRST_RUN_FINAL_NETWORK_GUARD`; earlier failures are never erased.

Seven one-file offline invocations pass 87 focused tests: narration 6, preview
17, release 17, harness 7, kid entry 21, evidence 9 and fonts 10. This includes the
owner's three type-safe readiness assertions correcting the prior CI TS2339
errors. An initial wrong-directory invocation failed before collecting tests;
it is retained separately. No local typecheck, build or browser was run. The
original independent red proof remains untouched; it was not replayed in this
follow-on. A fresh CI run and independent review are still required.

Pixel review also found a neutral-question/accepted-action semantic mismatch.
That runtime/UI correction belongs to a separate source lane. This harness-only
commit preserves the exact app/src tree and does not claim release readiness,
clinical approval, real auth, server acknowledgement or ProfileGate recovery.

Complete-header admission follow-on: the two affected files were rerun, passing
9 narration and 17 preview cases. The final focused set is 90 tests across seven
files. Negative controls cover Cookie visible only in `allHeaders()`, missing or
failed metadata, credential-header presence, and a deferred metadata read that
cannot fulfill/fall back before its result. Earlier logs remain preserved.
