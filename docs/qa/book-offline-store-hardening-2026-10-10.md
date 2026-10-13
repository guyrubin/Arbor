# Existing private-book cache: narrow owner/erase release candidate

Base: `bbbbbc0e5834ad1f539d3c8d6778c7e65a58e6f6` (PR126 integration tree `d78fe7f6`). Reconciled from safety donor `600d408620342221833e8a6bd5cca2fd0cf98002` only. This is source work for existing private reads; no book, asset, parent door, reading-mode flag or offline planner is activated.

## Source finding and reachable lifetimes

- KidDashboard mounts LibraryBookCover, which calls libraryBookCoverUrl → fetchBookAsset. KidBookReaderView calls resolveBookAssets → fetchBookAssetResult (initial batches and background retry batches). Parent HeroSheetPanel mounts BookSheetStrip, which calls fetchBookAsset in its pose loop. These existing paths are outside the held parent-reading flag, but require existing book metadata/poses. No claim about real-family availability or observed disclosure follows from source reachability.
- Previously, the cache key contained child/book/createdAt/path without owner identity, a hit returned before the bearer/owner proxy check, and an already-running put could finish after an erase. The current source pins the actual Firebase user before device reads, namespaces rows by owner/child/book/version/private/path, and never reuses unowned legacy rows. Cache hits require matching recorded owner and child. Cache misses require the existing tokenized, same-origin ownership-checked GET, with no-store, error-on-redirect and a revocable signal. Cached, already-authenticated owner bytes do not require an online token refresh.
- The only device write is the private-store put. One runtime mutation queue orders puts and purges; queued stale puts are skipped and already-committing stale puts are removed before a queued purge resolves. Erase tombstones remain keyed to the owner UID for this runtime so a fresh SDK object with the same UID cannot revive failed-deletion rows.
- Both public child erasure entry points (`deleteChildData` and `eraseEverything`) synchronously retire private scopes and start the cache purge before awaiting the server erasure. The server request/receipt and registered collection wipe semantics otherwise remain unchanged. Explicit AuthProvider sign-out retires/purges before other asynchronous device purges. Its real passive auth observer retires current scopes before setting the next React user, including A → signed out → B → A; provider teardown also retires them.
- Existing reader, cover and parent pose-loop callers share one non-revivable scope across each read lifetime. They abort on cleanup, owner transition or erase, suppress late bytes, revoke allocated blob URLs, and gate rendered results by child/document/language identity before effect cleanup. Background reader retries cannot establish a fresh scope under a later owner. Result boundaries recheck currentness after awaited helpers. Existing name-free shared narration still uses the established static path; this release introduces no public-byte device caching.
- Full account deletion still uses its existing complete-receipt-only device cleanup/sign-out path. Once the complete receipt and existing owner guard admit cleanup, it starts the book purge before awaiting comic/hero purges and awaits that book purge before local-key cleanup/sign-out; partial/unknown receipts preserve retry behavior. Ordinary account transitions do not change server permissions or export authority. Passive transitions revoke readers; unlike explicit sign-out, they do not claim physical deletion of all stored owner rows.

## Donor reconciliation and preserved boundaries

The donor's held `fetchPublicBookAsset` seam and its seven public-cache tests were removed. No `bookOffline.ts`, planner commit `cc47f44e`/`3de9f2fb`, revision partition, byte-budget machinery, read history, new data collection/scope, reader activation, manuscript, plate, audio, font or binary is included. The private-only single-dispatch guard remains strict.

The donor's private owner namespace and mutation queue are retained, with these additional corrections: final result recheck; UID-keyed runtime erase tombstones; immediate public erase-entry retirement; and integration of the existing production read lifetimes. PR126's export service, whole-child export/session boundaries, all 43 CHILD_SUBCOLLECTIONS entries, server routes, registered file semantics, service worker and release flags remain unchanged.

## Verification

All runs use installed Vitest, one file/process, maxWorkers=1, MODEL_PROVIDER=mock, and the offline socket guard. SDK/transport/device data are synthetic. No local typecheck, build, browser, external network, provider/generation call, real child data or publication was used.

Negative controls restore donor store behavior plus the pre-integration resolver and donor childData reconciliation, then rerun the new tests: seven of nine resolver/erase integration cases fail; the final cache-result boundary and same-UID failed-deletion re-entry cases both fail. The remaining baseline cases are not mislabeled failures. The unchanged production callers also fail all ten caller-lifetime tests. Green source is restored before further runs. Receipt logs are retained separately.

Final targeted batch: 115 passed across twelve separate files (earlier overlapping runs are not added):

- bookAssetStore.lifetime: 20; bookAssets.lifetime: 9; AuthContext.bookCache: 3; bookCacheCallers.lifetime: 10
- bookAssets: 12; childData.subcollections: 13; childData.strayKeys: 6; childData.authLifetime: 9
- bookAssetExport: 15; childData.portableExport: 4; bookRelease.guard: 10; noModelCalls: 4

Independent review and exact-final CI are still required.

## Explicit remaining limits

- The deterministic memory backend proves callback/result ordering, not actual IndexedDB transactions, quota/blocked-open handling, crash/reload recovery, native filesystem behavior or airplane-mode reading. Failed physical deletion is still best effort and is not a successful cache-erasure receipt.
- The mutation queue and erase tombstones are runtime-local. No cross-tab lock, persistent tombstone, device-wide auth observer, cross-tab late-write barrier or reload-level failed-deletion protection is established here. A separate tab may still write while another erases; these limits require explicit acceptance or a separately scoped correction before any device-wide erasure guarantee.
- Firebase observer transitions and caller effects are exercised with synthetic SDK/hook slots. Real Firebase offline-token/revocation timing, multi-tab sessions, mounted browser rendering, decoded image/audio cleanup, navigation and native lifecycle behavior remain unverified. A valid existing owner cache is deliberately offline-readable without a fresh server ownership request.
- No live-family exposure is inferred, no actual book/likeness/manuscript/language acceptance is supplied, and focused tests are not an aggregate/type/build or deployment pass. Publication remains owner-gated after independent review, exact CI and permitted synthetic evidence.

## Independent review correction: complete-account cleanup

Review of `2f27a6ce` found one additional source window: after a complete account-deletion receipt, DeleteAccountModal awaited comic and hero-store cleanup before reaching AuthProvider sign-out. During that wait the original auth object could still admit a private cache read/new scope or finish a pending write. This is source-level lifetime evidence, not an observed disclosure.

The bounded correction starts `purgeBookAssets()` directly after wipeDeviceData's initial `ownsAccount()` guard, before its first await, and awaits that promise before the existing post-purge owner checks. Retirement alone would not block new scopes. Complete-receipt gating, partial/unknown receipt retry behavior and stale-owner/unmounted guards remain unchanged.

New deterministic integration executes the actual modal confirmation callback and real private store against synthetic SDK/transport/memory boundaries. It proves a pending private response is cancelled, new same-owner scopes/cache reads are rejected without a new GET, and no late blob/put survives while the comic purge remains held. It also covers waiting for the book purge, no purge for partial/unknown/replaced-owner/unmounted results, and preserving a later account's local keys/sign-in after an admitted purge.

Negative control restores the pre-correction modal: three of seven new cases fail and the four no-purge cases pass. Corrected source: seven new cases, 21 existing account-flow cases, 20 private-store cases and three AuthProvider cases pass, one installed Vitest file/process at a time (51 tests; this batch overlaps the earlier 115 and is not added to it). Exact-final independent re-review/CI remain required. No cross-tab, native, physical-erasure or rendered-browser guarantee is added.

## Re-review correction: authoritative owner through dispatch and cleanup

Re-review of `51a44309` found that the modal's previous `ownsAccount()` predicate relied only on React's last rendered UID. A complete receipt arriving after the SDK changed owners but before React rerendered could therefore call the new early purge against the next owner. The former replaced-owner test rerendered first and did not cover this window.

The modal now captures the actual initiating Firebase user object, requires its UID to match the rendered requester before lease acquisition, and requires that exact object through every cleanup check. A scoped auth observer permanently retires the request on any observed owner transition, including A → B → the original A object. The observer is removed and the request retired in finally. Existing active-view, complete-receipt and post-purge checks remain intact.

The same request lifetime now reaches `api.accountDelete` through its optional `beforeDispatch` callback, reusing the unchanged request helper's existing pre/post-token checks. A token await, unmount or timeout cannot later send a stale destructive POST. The payload, endpoint, backend authorization and credentials are unchanged. Once POST was sent, this guard does not undo or claim to cancel server deletion; a later receipt simply cannot clean or sign out an unrelated owner.

The strengthened deterministic file separates rendered user from actual SDK user and exercises the actual modal callback, real private store and real API request wrapper. It holds React unchanged for SDK B, a fresh same-UID owner object and observed ABA; it also holds token resolution through SDK changes, unmount and timeout. Positive controls retain the exact existing POST body and complete-receipt cleanup. Another case confirms that an already-dispatched POST is not undone while its late receipt cannot affect a new owner.

Negative control restores `51a44309` modal/API runtime: ten of eighteen cases fail, eight controls pass. Final bounded correction batch: 18 modal/store/API, 21 existing account-flow, 20 private-store, three AuthProvider and nine PR126 whole-child-export auth cases pass (71 tests across five serial files; overlapping earlier batches are not added). This is synthetic callback/transport evidence, not mounted browser or real-Firebase timing proof. Exact-final independent review and CI remain required; all previously stated cross-tab, native and physical-erasure limits remain.
