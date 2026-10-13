# Kids Studio V2 — 13 October 2026 release record

**Status: restoration candidate; verification and V2 production deployment pending.** The earlier local V2 work was lost before publication and was not shipped. Its test counts and implementation claims are not evidence for this candidate. The checked-out production baseline is `98d1780d8ee810369f5f9299a6d3b5278eb6491d`.

Guy requested a separate backlog, preservation of the current child-profile avatar, and then explicitly instructed **“Deploy all V2” on 12 October 2026 at 10:51 Europe/Brussels**. That instruction authorizes implementation and release of the revised full experience. The separate [ROS proposal, PR #16](https://github.com/guyrubin/ROS/pull/16), retains the source requirements; its recovered text still describes the earlier exploration state. This record captures the later instruction and the implementation disposition without duplicating assignments across the canonical GA, Parent and Kids backlogs.

Source: `Arbor Kids Studio v2.zip`, selected `Kids Studio Sky.dc.html` / portrait counterpart, `HANDOFF.md`, `BACKLOG.md` and `docs/final-home.png`. Original archive SHA-256: `276379bc46137dc3f0d836a9072f9c610ab40a5a6df777e746334e1d3f8b3643`. The uploaded source documents and fixed-child artwork are not copied into the app repository.

## All 37 source dispositions

**Adopt** retains the source intent; **Revise** records a deliberate implementation change; **Retain** preserves existing working capability; **Defer** identifies an unimplemented extension. These are scope decisions, not assertions that every acceptance criterion or device check has passed. The candidate must prove the complete entry → home → world → real activity/book → ending/replay/collection → Parent-return flow.

| Request | Disposition and candidate outcome |
|---|---|
| KSV2-A1 · Greeting/status | **Revise:** current child's name/avatar and collection entry; no simulated stars or session-derived ability/level. |
| KSV2-A2 · Four doors | **Adopt with revision:** Playbank, Hero Stories, Feelings and Studio open real eligible destinations, with distinct neutral illustrated environments; no fake rings, locks or unearned progress. |
| KSV2-A3 · Central hero | **Adopt with revision:** profile-approved avatar is authoritative. Use a matching current pose when available, otherwise the same portrait; separate honest no-avatar mascot. No fixed child, stretched face or old derivative presented as current. |
| KSV2-A4 · Quest dock | **Revise:** optional finite four-step cozy-corner activity with choices and saved checkpoints. No date-seeded daily debt, reset, absence loss, refill or countdown. |
| KSV2-A5 · Atmosphere | **Adopt with revision:** new neutral sky, scoped responsive layout and reduced-motion treatment. No gyro permission; 60fps and <1.5s first paint remain unmeasured targets. |
| KSV2-B1 · Tap for hint | **Adopt:** authored local EN/HE hints, responsive Sprout expression and a real suggested-world action. |
| KSV2-B2 · Reactions | **Revise:** user-triggered guide reactions and actual activity finish feedback; no invented “un-finish,” reward retraction or repeating attention cycle. |
| KSV2-B3 · Generated lines | **Defer:** generated Sprout is unimplemented. Authored guidance supplies the release behavior; no child-name/progress prompt, open chat or client `window.claude.complete` dependency. |
| KSV2-B4 · Voice/input | **Retain/defer:** approved existing book narration stays. New spoken Sprout and microphone/STT input are unimplemented; no new capture permission or child processor. |
| KSV2-C1 · World scene | **Adopt:** recognizable scene/title and world cue; existing child overlay owns Back/Home, focus and Parent return. |
| KSV2-C2 · Activity list | **Adopt with revision:** cards open actual eligible games/books. Existing age, language and feature limits remain; no simulated disabled levels or dead placeholders. |
| KSV2-C3 · World completion | **Revise:** real activity finishes create keepsakes; no all-activities quota, remaining-to-earn pressure or reward loss when the catalogue changes. |
| KSV2-D1 · Introduction | **Adopt with revision:** localized visual cue and short instruction before actual play; no child-facing skill grading or reward chips. Static cues are not claimed as animated demonstrations. |
| KSV2-D2 · Session shell | **Adopt with revision:** common intro/play/result ownership around distinct mechanics, with safe navigation/replay. V2 play-only adapters suppress practice-performance records. The generic four-answer prototype does not replace each game. |
| KSV2-D3 · Result/replay | **Adopt with revision:** genuine completion, warm finish, voluntary replay and return. No +3/+1 currency loop or repeat-award inflation. |
| KSV2-D4a · Memory Match | **Retain/adapt:** existing pair-flip mechanic and bounded finish, without V2 play efficiency feeding cognition/assessment records. |
| KSV2-D4b · Feelings Detective | **Retain/adapt:** existing authored Feelings Lab situations and choices in play-only mode; no facial inference, diagnosis or V2 assessment write. No new clinical-review claim. |
| KSV2-D4c · Mimic Studio | **Revise:** existing authored prompts, camera-free try/pass interaction; no capture or expression rating. An all-pass session earns no activity note or keepsake; an explicitly tried prompt permits a bounded finish. |
| KSV2-D4d · Sound Explorer | **Adopt:** bounded source matching with existing owned foley, explicit listening/next controls, visible mute/unavailable clues and audio cleanup. No promised new nature/language sound pack. |
| KSV2-D4e · Sequence Quest | **Retain/adapt:** actual Pattern Power interaction; difficulty stays a game setting, with no V2 developmental record or comparison. |
| KSV2-D4f · Calm Builder | **Adopt with revision:** meaningful object placement/rearrangement and child-chosen finish; tap/select/place alternative to drag. Creative activity, not a therapeutic outcome claim. |
| KSV2-D4g · Rhythm Hero | **Retain/adapt:** actual Beat Keeper rhythm interaction, mute and interruption cleanup; no performance assessment. ±120ms device accuracy is not claimed as validated. |
| KSV2-D4h · Puzzle Planet | **Adopt with revision:** real neutral illustration pieces, accessible selection/placement and preview. No Level-2 lock or star economy; final piece-count choices are implementation details to verify. |
| KSV2-E1 · Shelf | **Retain/integrate:** existing eligible library, private covers and actual books in Hero Stories; no mock books or another child's hero. |
| KSV2-E2 · Reader | **Retain/extend:** real branching reader and approved narration with edition-bound resume. Checkpoints store only version/book id/edition/page/branch. Invalid/stale/error-fallback reads start at cover; confirmed owned cached positions reopen offline. Historical artwork stays intact. |
| KSV2-E3 · Book completion | **Adopt with revision:** actual traversal to the ending may earn the existing story keepsake once; opening a saved END state is not a new completion. No all-books quota or currency. |
| KSV2-F1 · Keepsake rule | **Revise:** deterministic, permanent activity/book keepsakes using the existing child ledger; duplicate-safe identity. Offline/concurrent timestamp guarantees must match the final implementation. |
| KSV2-F2 · Reward moment | **Retain/adapt:** brief actual-finish feedback with immediate navigation/replay and existing audio/motion preferences; no forced five-second overlay. |
| KSV2-F3 · Collection | **Adopt with revision:** earned keepsakes, honest empty/loading states and eligible revisit routes; no unearned silhouettes or “complete them all” debt. |
| KSV2-G1 · Portrait | **Adopt:** one fluid composition for portrait/landscape, not the mock's fixed tablet coordinates; readable controls, avatar framing and actions need rendered proof. |
| KSV2-G2 · Devices | **Adopt; verification pending:** preserve active view/play during layout change and interruptions. Emulated viewport evidence is distinct from real iOS/Android rotation/audio proof. |
| KSV2-G3 · Phone | **Revise:** phone is part of this release, not deferred to P2; compact doors, guide, quest, games and reader must remain usable. |
| KSV2-H1 · Data | **Revise:** use existing child/account ownership and export/erase inventory for minimal quest/bookmark/keepsake persistence; no new correctness, timing or choice analytics. Hashing a child id is not anonymity. |
| KSV2-H2 · Parent gate | **Retain:** existing sustained hold plus PIN/math challenge, cancellation and focus ownership. No one-tap or hold-only bypass. |
| KSV2-H3 · Accessibility | **Adopt:** native buttons, labels, focus, readable contrast, reduced motion and non-drag controls. Actual art/text contrast and enlargement remain rendered checks. |
| KSV2-H4 · Language | **Adopt:** centralized EN/HE strings, RTL layout and eligible-language filtering; preserve artwork orientation. Independent editorial/voice review is not implied. |
| KSV2-H5 · State/resilience | **Adopt:** child/account changes retire stale work; persisted checkpoints, bookmarks and keepsakes recover coherently; unavailable storage does not invent success or leak another child's data. |

## Asset provenance

The sky and four neutral portal scenes were created with the built-in image tool and inspected after WebP encoding. The sky uses the supplied screenshot as a palette/atmosphere reference. Each portal edits its source illustration to preserve the polished cinematic style while removing every depicted child, person, costume and avatar. Feelings also removes the stuffed rabbit and facial marks from the decorative colored orbs. No family identity was generated or changed, and no original vendor binary was copied unchanged.

| Asset under `app/public/visuals/` | Size | Provenance |
|---|---|---|
| `studio-v2/sky-background.webp` | 1536×1024; 24,074 bytes | New generated sky; SHA-256 `2677e4ed9cacaa8b8f636865c286886936f23ad96d7a6327410941406d02c88e` |
| `studio-v2/sky-background-480.webp` | 480×320; 5,024 bytes | Downscaled from the same generated original; SHA-256 `d4fa117f7e1a373216383c6f0729b0bfe4490def41e53d4614643274ab59d7b0` |
| `studio-v2/portal-playbank.webp` / `portal-playbank-480.webp` | 1536×1024 / 480×320; 83,348 / 18,242 bytes | Edited `world-playbank.png`: green tabletop, illustrated game cards and warm room; no child |
| `studio-v2/portal-stories.webp` / `portal-stories-480.webp` | 1536×1024 / 480×320; 169,078 / 33,002 bytes | Edited `world-stories.png`: glowing open book and violet castle landscape; no child |
| `studio-v2/portal-feelings.webp` / `portal-feelings-480.webp` | 1536×1024 / 480×320; 293,116 / 45,394 bytes | Edited `game-feelings.png`, the selected mock's actual Feelings source: sunny/rainy mountain and faceless colored light; no child or rabbit |
| `studio-v2/portal-studio.webp` / `portal-studio-480.webp` | 1536×1024 / 480×320; 129,754 / 25,572 bytes | Edited `world-studio.png`: rocket painting, wooden easel and art supplies; no child |

The earlier inspected painted-environment alternatives were superseded by these four source-style edits. Together the four 480px portal derivatives total 122,210 bytes. Full images are 675,296 bytes. All share true 1536px/480px width descriptors; their theme-manifest registration and actual rendering remain part of integrated verification.

## Release receipts and limits

| Evidence | Current state |
|---|---|
| Baseline | `98d1780d8ee810369f5f9299a6d3b5278eb6491d`; current checkout matches the production baseline reported by the release owner. |
| V2 source/PR | Pending restored source publication. Earlier unshipped local work is not this candidate. |
| Current game checks | Implementing agent reports 13 October: 87 mechanic/lifecycle/default-regression tests across 10 files; 712 route/cosmetic/registry guards across six files; 22 GameShell assertions. Independent review underway. These are focused local receipts, not a full-suite/deployment claim. |
| Current reader/data checks | Implementing agent reports 13 October: seven focused suites / 74 tests passed for rebuilt bookmarks, true-ending progress, owner-scoped assets and recovery. No prior-day WIP counts reused. |
| Exact-source gates | Pending current lint, full tests, TypeScript/build, framework, capability, safety and acceptance receipts. No previous WIP counts carried forward. |
| Rendered flow | Pending exact-build EN/HE phone/tablet/desktop and all-world/activity/book/quest/collection/exit evidence. |
| V2 deployment | Pending production workflow and resulting immutable source revision. |
| Production smoke | Pending. Public liveness, synthetic journey and signed-in family verification are separate observations. |

Preserve the actual profile avatar and current source revision across present-tense surfaces, while historical books retain their approved original illustrations. No family reference image is published in evidence. Actual current-family likeness, the unprovided local Parent branch/preview, real-device audio latency, independent Hebrew editorial review and representative-network performance remain unverified without their own evidence. A green build or successful deployment cannot certify “perfect.”

Owner-scoped book caches deliberately ignore unowned legacy cache rows. The first reopen may need network to refill safely owned bytes from the same frozen historical assets; this is not a saved-book regeneration or rewrite. Bookmark writes wait for a current confirmed receipt and expose retry on failure; round choices do not become assessment data.

Next action: finish the restored integrated candidate, run the current source checks and rendered flow, deploy under Guy's explicit instruction, and replace the pending receipt rows with exact source, workflow and production evidence. Reconcile the separate ROS proposal's stale status without changing all three canonical backlogs in parallel.
