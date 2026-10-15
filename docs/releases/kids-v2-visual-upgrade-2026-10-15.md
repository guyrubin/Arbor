# Kids Studio V2 — visual upgrade and backlog reconciliation

PR: https://github.com/guyrubin/Arbor/pull/146

The release restores fidelity to the original V2 handoff and makes the approved avatar participate in Canal Quest, Story Theater and Sound Orbit. Home/world corrections retain the authored sky, large central hero, four world doors, gold controls and connected quest dock. Mobile shows all four doors. Gameplay uses distinct original canal, theater and cosmic environments with cream stages and state-driven feedback.

## Backlog scope

The authoritative separate adoption backlog is ROS PR 16, `PAI/projects/arbor/proposals/kids-studio-v2/BACKLOG.md`. All 37 source dispositions are preserved in `kids-studio-v2-2026-10-13.md`. The three-adventure expansion and eight-game menu are recorded in `kids-three-adventures-2026-10-15.md`; original-world requirements are in `../design/kids-original-worlds-2026-10-15.md`.

| Requirement area | Current implementation |
| --- | --- |
| A1–A5 home | Name/current approved hero, four eligible world doors, finite saved cozy-corner quest, authored sky and reduced motion. This release repairs source geometry and phone composition. Numeric levels/currency and daily debt remain deliberately revised. |
| B1–B2 guide | Authored bilingual contextual hints, real suggested actions and bounded reactions. |
| B3 generated Sprout | Explicitly deferred in the adopted backlog; not implemented or claimed shipped. |
| B4 voice/input | Contextual authored EN/HE Sprout narration now uses the existing child voice bus. New voice identity and microphone input remain deferred; no new capture permission. |
| C1–C3 worlds | Real destinations, recognizable scenes, neutral authored environments with a separate current-character layer, earned keepsakes. No fake progress. |
| D1–D4 games | Actual intro/play/result/replay; eight distinct menu games with three complete adventures. Older overlapping games remain reachable from historical/parent routes. The same character resolver as Sneak & Freeze, actual support responses, contextual narration and tap-driven music lighting are used here. |
| E1–E3 books | Existing eligible shelf, branching reader, approved narration, edition-bound resume and genuine completion. No historical art is regenerated. |
| F1–F3 collection | Existing owner/child ledger, award-once keepsakes and saved creations/revisit routes. |
| G1–G3 layouts | Desktop and 390px Hebrew phone inspected; layout changes preserve component state. Physical iOS/Android rotation/audio/performance remain separate unverified criteria. |
| H1–H5 boundaries | Existing ownership/erase, parent hold-plus-challenge, accessibility, EN/HE and stale-work retirement retained. No new gameplay telemetry or public child-sharing flow. |

All adopted functional areas have implementation evidence; this does not mean every source proposal was adopted or every real-device acceptance criterion has been verified. Do not mark B3/B4 or physical-device checks complete merely because deployment passes.

## New artwork and identity

Four original transparent raster atlases ship: story-props (768×512, 75,032 bytes), canal-pieces, feeling-tokens and orbit-instruments (each 1152×768, approximately 260–290 KB). They contain neutral props, boat/water/dock/rocks/cargo, weather-like feeling tokens and musical instruments. No franchise references or child identity is included. Original PNGs remain private; optimized WebP atlases ship.

Portrait frames and generated child scenes were rejected by the user and are excluded. Private image experiments using the original kit illustration produced identity drift and were not shipped. The full player now uses `useHeroSheetState` and `HeroFigure`, exactly as Sneak & Freeze. Existing owner/child/avatar guards and pose source order are unchanged. No runtime child image generation is added. Where a matching character sheet is missing, the exact current profile image remains the honest fallback.

Sprout uses the existing drawing with opt-in dimensional lighting and reactions to actual gameplay. Contextual narration uses the existing voice engine, respects mute and silence, and cancels on navigation/hush. Difficult feelings receive comfort; support does not imply a feeling disappears.

## Evidence

See `../../app/design-qa.md` for the comparison, operated checks and limits. Focused tests include avatar identity/snapshot retirement, complete EN/HE game flows and voice scheduling/cancellation. Final TypeScript/build/CI results and deployed SHA are recorded in PR 146. The earlier 120-test and portrait-frame acceptance is superseded by this revision.

Deployment is pending exact-head CI and release verification. The adopted backlog dispositions above remain explicit; generated Sprout art, a new voice identity/microphone flow and real-device criteria are not claimed complete.
