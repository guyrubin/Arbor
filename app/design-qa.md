# Kids Studio V2 — visual and interaction review, 16 October 2026

Source: original Arbor Kids Studio v2 handoff, Kids Studio Sky, and final home/world captures. Scope: PR 146, home/world fidelity and Canal Quest, Story Theater, Sound Orbit.

## Design and identity

The authored sky, glass doors, central hero, quest dock, typography and gold actions remain the V2 authority. Prior source comparison used 1180×820 desktop and 390×844 Hebrew phone. Source currency/levels/locks retain the adopted revisions.

The user rejected portrait frames and character redraws. Frames and runtime generated child scenes are excluded. Studio now reads the exact same `useHeroSheetState` chain and renders the same `HeroFigure` sprites as Sneak & Freeze. Owner/child/current-avatar hash guards remain unchanged. A full character already available to that game is available here; where no matching character exists, the exact profile image remains the fallback. No new face, hair or outfit is synthesized by entering these games.

The initial strict reviewed-only filter was removed: it incorrectly hid character sheets used by Sneak & Freeze. No existing review or source boundary was weakened in the shared resolver.

Private QA uses both the original kit portrait and the existing Sneak & Freeze full-body fixture, bound to a synthetic local child. The approved live family profile was not fetched for this review. Earlier private experiments used the kit illustration as a model reference; the resulting child scenes drifted in identity and were rejected. They are not production assets and are not referenced by shipped code.

## Game and guide behavior

- Canal: original raster boat, dock, rocks, cargo, water and foliage. A large full character plans with Sprout, boards the moving boat for sailing and celebrates arrival. Connected route segments follow actual adjacent cells. Planned supplies and supplies physically collected during sailing have separate states. Invalid routes cannot sail.
- Theater: six tactile feeling tokens and six original props. The full character moves closer or gives space according to the selected support. Sprout responds to the actual story and choice. Difficult feelings retain a comforting response; a support choice does not cause an automatic victory pose or erase the feeling.
- Music: three distinct illustrated instruments with lit states. The character performs existing poses on actual notes. Sprout demonstrates, waits for the child, and celebrates a match. Free play has no fabricated completed progress. Ready-state instruments can be explored immediately; compositions remain bounded to eight notes and explicitly saved.
- Contextual EN/HE narration uses the existing child audio/voice bus. Stories, current prompts, hints and outcomes are spoken once per relevant change. Music demonstration cancels narration. Mute, navigation, hidden-tab hush and unmount cancel pending lines and owned playback; unmuting alone does not replay old speech. Replay controls retain readable text when sound is off.
- Sprout retains the existing silhouette/face. Opt-in dimensional lighting and state-driven greeting/listening/comfort/show/celebration are limited to these stages. Reduced motion disables stage transitions and animations.

## Operated browser checks

- Desktop Canal: valid route through supplies, sail enabled, cells disabled during travel, arrival and cargo collection confirmed.
- Desktop Music: demonstration, revealed ordered pattern, actual matching taps, completion cue and next action confirmed. Free composition/save was checked in the preceding iteration; handler tests retain completion/replay/undo/stop coverage.
- Hebrew phone Theater: story, named feeling, support choices and authored company outcome operated. Full-body sprite visible with feet anchored on stage. Measured content and scroll width both 375px within a 390px viewport; no horizontal overflow.
- Desktop game content and scroll width both 1348px. App-origin errors were not observed in inspected console output; browser extension metadata errors were excluded.
- Source home/world comparison, all four phone doors and quest dock were inspected earlier and retained. No new generated personal scene is used in those doors.

Evidence images are private QA files, not shipped child assets. Full-character canal and theater captures are retained under `/workspace/scratch/arbor-*-full-character-20261016.jpg`.

## Release verification

Focused V2/avatar/scene and narration lifecycle tests, TypeScript and frontend production build are required. Exact final counts and CI/deployment SHAs are recorded in the PR. Synthetic browser checks do not establish real iOS/Android speaker quality, rotation/performance or authenticated family persistence. Those hardware criteria remain unverified. No claim of perfection or measured virality.

final result: visual/interaction checks passed for the stated synthetic scope; final CI and production verification pending
