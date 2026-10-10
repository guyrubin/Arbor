# Authored first-run: bounded DEV preview evidence

This is an additive **development-preview capture scope**, not production onboarding
acceptance. No rendered result is claimed by this source document. The release owner
must authorize and run the existing CI workflow, then review its real PNGs and JSON.
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
unchanged original-family proof and zero attempted model/remote writes. Exact
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

A last-registered, first-executed same-origin request guard aborts all HTTP
mutations, including non-API webhook paths, before any fixture or generic API
handler. Catchall/demo handlers also reject preview mutations directly. The demo
fixture matches only the exact BASE origin and /sandbox/demo-family.json path,
and only fulfills GET; foreign origins and private API suffixes never receive
its synthetic success. Model/media endpoints remain denied. Read-only capability queries retain the existing local
handling. A denied attempt fails the receipt; the harness never substitutes a
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
