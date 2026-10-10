# Private export: bounded sandbox rendering

Source-reviewed application candidate: `659a14b7eb689b99b21e8feb1c0b5ebd17f66258`.
Exact `app/src` tree: `ba50e79dafacbb4b27b481ceac78486359366e6c`.
This additive harness changes capture/test/workflow text only. No application,
authorization, erase, package, font, image or other asset source is changed.

## Supported acceptance and exact boundary

The current path is the real mobile More → Settings or desktop account menu →
Settings → Your data → Export. `YourDataSheet` performs an explicit parent-action
export, with no second confirmation dialog. The typed-name confirmation belongs
to erase; this harness never clicks any erase or account-deletion control.

`AuthContext` exposes `local-sandbox` only when Firebase is unconfigured.
`withChildExportSession` explicitly supports that local record-export mode.
`exportPrivateBookAssets` rejects it as `unauthorized` before reading inventory
or private files. There is no supported synthetic Firebase User/token/emulator
seam in this source. The harness preserves that gate and consequently can prove
only the partial JSON download, not a complete authenticated private-file export.
No auth replacement, credential, token, grant or runtime patch is introduced.

Fixture changes enter only the existing `/sandbox/demo-family.json` hydration
seam. The two invented child IDs are `capture-private-export-a` and
`capture-private-export-b`; localized names are Noa/נועה and Mira/מירה. Private
book metadata and hero-sheet markers are invented text, with no asset bytes.
The existing synthetic-online browser flag, public exact-font preparation,
mock/local environment and network-none disposable Docker runtime are unchanged.

## Bounded manifest

Scope: `private-export-only`; four existing viewports (375×812 and 1280×800,
English and Hebrew). Exactly ten required states each, forty screenshots total:

1. Settings entry through actual visible controls, with no export on opening
2. Your data open: correct child, explicit action, limits and no account-delete door
3. Close and reopen: real return focus, clean sheet, no automatic export
4. Repeated activation with a held local response: one GET, disabled export, no file
5. Partial download: actual JSON delivery, exact child and filename, visible receipt
6. A second explicit export: one further GET and one further validated download
7. Close/reopen clears the previous receipt without starting another export
8. New pending export: disabled control, no file while the response is held
9. Actual close before release: response settles, no late file/receipt, return focus
10. Reopen after cancellation and successfully export a fresh partial JSON file

The response gate calls the existing local privacy GET and holds its unchanged
HTTP-200 APIResponse. Request arrival is distinct from successful response
readiness. Close waits for the latter; a fetch failure or non-200 response can
never count as held-response interruption proof. Readiness, close-before-release,
release ordering/reason and settlement outcome are retained and checked by the
aggregate. A failed delivery counts as browser cancellation only when the actual
Chromium request reports `net::ERR_ABORTED` after the close/release. Arbitrary
delivery errors fail. The gate does not synthesize success, authorization,
inventory or files.
Interruption observation ends after release/settlement, two native animation
frames and the successful fresh export. Account-switch, sibling-switch, private
byte/digest interruption and Kid Mode lifetime cases remain the reviewed source
and offline callback tests' evidence; they are not claimed as browser coverage.

The app's native blob download must match `arbor-noa-data.partial.json` or
`arbor-נועה-data.partial.json`. Its real stream is bounded to 256 KiB, parsed,
checked for the invented current child, 43 registered collection receipts,
fixture markers, absence of sibling identifiers/marker, empty actual local server
ledger/shares, and an explicit unauthorized private-file receipt with zero files.
Each payload is deleted inside the container. Only byte count, SHA-256, fixed
identity/status fields and deletion confirmation enter the evidence JSON. Raw
exports never enter workflow artifacts. Per-child local collection snapshots
are compared after every state and are not retained in artifacts.

## Safety and verdict

Only the exact current child's privacy GET enters the response gate. The existing shell's automatic current-child book-narration POST is explicitly refused locally with HTTP409 and counted separately; it never reaches the server or succeeds. Other children, suffixes and all other mutations remain denied. Bounded synthetic download-name observations retain only the expected/suggested filename and two booleans, never a blob URL or payload. All other
privacy routes, private-book reads, mutation/generation requests and unexpected
downloads fail the capture. Existing exact-font/network/denied-action guards and
source-SHA/tree checks still apply. Final network evidence is re-sampled after
screenshots and diagnostic awaits. Missing or nonzero mutation, private-file,
unexpected-download, auth-header or denied-action counters fail even if earlier
assertions passed. There are no real accounts or child records,
external recipients, provider calls, uploads, hosting changes or new permissions.

The aggregate requires all named assertions, settled real dialog frames, exact
source identity, safe request counts, validated/deleted download receipts and
exact-font screenshots. A green bounded capture means only these forty sandbox
states passed. Complete authenticated files, signed-in/out production behavior,
native-device delivery, native Hebrew review and general release acceptance
remain pending. Pixel review is separate from collection success.

## Execution

The existing `arbor-parent-release-capture.yml` gains only the dedicated
`codex/private-export-release` branch mapping to this scope. Publication remains
with the parent/owner after independent review. No workflow was run locally.
No browser, TypeScript check, build, network or provider call is needed for the
pure capture-contract test. Use installed dependencies and the offline guard,
one Vitest file/process with `--maxWorkers=1`, from `app`:

    MODEL_PROVIDER=mock NODE_OPTIONS=--require=/tmp/arbor-offline-network.cjs \
      ./node_modules/.bin/vitest run --config scripts/vitest.config.mjs \
      scripts/capturePrivateExport.test.ts --maxWorkers=1

Also run the existing `captureRelease.test.ts`, `captureKidEntry.test.ts` and
`captureHarness.test.ts` serially after changes to the shared capture wiring.
