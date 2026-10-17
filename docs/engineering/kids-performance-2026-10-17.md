# Kids performance and continuity release — 17 October 2026

Base: `672c2eea7a53e836fb2366098a607b9803212b76` (approved Kids V2 / Parent V3).

## Selected scope

1. Home warms two navigation shells, sequentially during idle, rather than 18 unrelated surfaces. Cleanup cancels unissued work. Offline, hidden, save-data and 2G sessions do not speculate. Each eligible game's introduction warms the same cached loader used by React.lazy. Failed speculative loads can retry when explicitly opened.
2. Hero-sheet subscriptions share one transport and parsed snapshot per owner/child. The last listener releases the cache and transport. Auth epochs and subscription lifetimes reject late callbacks, including A–B–A switches. Avatar hashing and fallback-sheet construction are memoized by their real inputs. Approved identity resolution, pose anchors, historical proof exception, and neutral-world art are unchanged.
3. Rhythm Garden and saved-melody playback schedule bounded phrases on one AudioContext timeline. Single taps still use the same local synthesis and Kids mute bus. Stop, navigation, hidden-page hush and disposal cancel current and future sources. Visual feedback remains best-effort JavaScript timing; this is not a claim of measured acoustic or audiovisual latency on physical devices.
4. Service-worker updates wait for prior clients to close; neither forced takeover nor forced page reload is used. Cached public artwork paints immediately and revalidates once per worker lifetime, coalescing concurrent refreshes. The artwork cache and validation set are bounded to 256 entries. Offline art is retained and unrelated caches are not deleted. This is an entry-count budget, not a byte-size budget.

No new family-data schema, model, voice setting, subscription tier, generated avatar or design system. No edits to unrelated open feature drafts. Broader parent-state decomposition, binary pose storage migration, creation history and new persisted resume records are separate projects, not silently included in this release.

## Verification

The first full local regression run passed 15,481 tests across 1,030 passing files; 10 tests were skipped, one file skipped and one test remained TODO. TypeScript passed. These existing skips are not claimed as coverage.

CI retains the full existing quality/safety gates and adds two real Chromium checks:
- Two active browser clients retain synthetic unfinished drafts while a new copy of the actual service worker waits; activation after the last old client closes; stable-art revalidation and offline reuse.
- Actual production Studio components with existing synthetic data adapters, EN/HE at 375 and 1280 pixels, three adventure flows, selected-game loading before Play, no unrelated adventure loading on Home, no camera/microphone calls, and audio scheduling/cancellation. Synthetic screenshots and JSON are retained as CI artifacts.

The local managed browser disallowed loopback navigation; browser pass/fail is therefore determined by the CI Chromium job, not represented as a completed local browser test. Device speakers, iOS-specific timing, and a signed-in family's personal avatar likeness require separate physical/authenticated verification. No universal speedup percentage is asserted.

## Deployment and rollback

Merge only after checks for the exact PR head pass. Use the existing candidate → health/safety → production promotion pipeline; do not disable approval gates. Verify the deployed build stamp and backend revision, not just HTTP 200.

Existing open PWA/browser clients intentionally retain their coherent build. Close all Arbor tabs/app windows and reopen to receive a waiting update without interrupting work. Rollback uses the prior Cloud Run revision and matching Hosting version, or a reviewed revert through the same pipeline.
