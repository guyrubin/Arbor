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
| B4 voice/input | Existing narration retained. New Sprout speech/microphone input remains deferred; no new capture permission. |
| C1–C3 worlds | Real destinations, recognizable scenes, approved-source compositing with neutral fallback, earned keepsakes. No fake progress. |
| D1–D4 games | Actual intro/play/result/replay; eight distinct menu games with three complete adventures. Older overlapping games remain reachable from historical/parent routes. Current pose authority, actual support responses and tap-driven music lighting are strengthened here. |
| E1–E3 books | Existing eligible shelf, branching reader, approved narration, edition-bound resume and genuine completion. No historical art is regenerated. |
| F1–F3 collection | Existing owner/child ledger, award-once keepsakes and saved creations/revisit routes. |
| G1–G3 layouts | Desktop and 390px Hebrew phone inspected; layout changes preserve component state. Physical iOS/Android rotation/audio/performance remain separate unverified criteria. |
| H1–H5 boundaries | Existing ownership/erase, parent hold-plus-challenge, accessibility, EN/HE and stale-work retirement retained. No new gameplay telemetry or public child-sharing flow. |

All adopted functional areas have implementation evidence; this does not mean every source proposal was adopted or every real-device acceptance criterion has been verified. Do not mark B3/B4 or physical-device checks complete merely because deployment passes.

## New artwork

`app/public/visuals/studio-v2/adventures/story-props.webp` is an original generated transparent 3×2 raster atlas, optimized to 768×512 and 75,032 bytes. Six neutral props: fallen blocks, stacked blocks, paper map, picnic basket, seedling and bench. No child identity, text, logo or franchise reference is present. Built-in Imagegen prompt: premium stylized 3D handmade story-theater toys, gold/teal/lilac wood, cream paper, wicker/coral gingham, terracotta/green leaves, rounded bevels, warm soft studio lighting, six equal isolated cells, true transparency, no characters/scenery/text. Original PNG is retained privately; only the optimized atlas ships.

## Evidence

See `../../app/design-qa.md` for rendered comparison and operated flows. Local TypeScript, 120 focused checks and production frontend build pass. An earlier CI correctly failed two old component assertions; those now target the active approved-player component, while identity rejection and completion semantics remain tested. Final CI, merged SHA and production deployment receipt are recorded in the PR/release follow-up.
