# Kids experience gauntlet — run brief (22 Sep 2026)

Orchestrator/validator: Claude Fable. Builders and critics: Claude Opus subagents. Guy's instruction: "get everything PERFECT in production."

## 1. Task

Surface: the child experience shipped to production today as `8cbc365` (Codex kids-world branch + hero-first G1 + story-as-comic G2 + EU image fallback G3). Register: **kid** for every child surface; the one parent-side step is "Create {name}'s hero".

Modules (one builder + one critic each; ≤ 2 in flight because this machine has 8 GB RAM and other sessions hold most of it):

| Module | Route(s) / files | What "done" changes for the user |
|---|---|---|
| **M1 — Home + games continuity** | Kid Mode `home`, `arcade`, all nine worlds. `components/kidmode/KidDashboard.tsx`, `components/practice/HeroArcade.tsx`, `components/practice/HeroPoseWorld.tsx`, `components/practice/PatternPowerWorld.tsx`, `components/ui/playkit.tsx` (PlayHeader) | The same hero is recognisably present in every world (Hero Pose lost its in-world avatar; the PlayHeader cameo is decorative-only). Home shows ONE featured hero, not six stickers (Astra U1). Pattern glyph run stays contiguous at 320/390 (Astra U2). A child without a hero sees Sprout, never a photo. |
| **M2 — Story reader as a comic** | Hero Stories in Kid Mode and parent view. `components/tabs/HeroJourneyTab.tsx`, `components/stories/HeroScenePlayer.tsx` | The generated cover (page 0, already generated) is SHOWN as the opening page; each beat is one framed page with narration; smudged page = frame + narration + Redraw (exists); reader nav has no English literals in Hebrew (Astra secondary finding); kid ending says the comic is on the shelf (exists) — verify it renders in Kid Mode. No net-new components. |
| **M3 — Comics shelf, both registers** | `#/comics` (parent `components/tabs/ComicsTab.tsx`), Kid Mode `comics` (`components/kidmode/KidComicsShelf.tsx`, `components/stories/SavedComicReader.tsx`), `lib/heroComics.ts` | A story saved as a comic (journey book, `comic4|journey|…` keys, possibly for a story with no authored copy) appears on the parent shelf as a book with "Read again" (today only the count moves: "1 of 13 books") and opens on the child shelf with all pages from the device store. Child shelf never shows a book that cannot open. |
| **M4 — Hero creation step** | `components/profile/AvatarCreator.tsx`, Kid Mode entry (`components/kidmode/KidModeOverlay.tsx` and the Kid Mode button in the parent shell) | Character picker: a clear-selection control and Hebrew strings (Astra secondary). Entering Kid Mode for a child with no hero offers the parent one step "Create {name}'s hero" (or continue with Sprout); never blocks the child. Generated hero persists (`avatar.{style,source,createdAt}`) at ≤ 200 KB or the write fails loudly. |

Benchmark (named): `C:\Users\dguyr\ROS\output\playwright\arbor-kids-2026-09-22\references\reference-contact-sheet.jpg`, plus `kid mode ui.jpg`, `dl hero.jpg`, `arbor kid story image exememple (1).jpg` in the same folder, and Astra's accepted candidate captures `10-candidate-home-390.jpg`, `11-candidate-pattern-390x700.jpg`, `23-lantern-opening-390.jpg`.

## 2. Build method

- One Opus builder per module in its own Arbor worktree (`C:\Users\dguyr\ROS\.arbor-gauntlet-m1`, `…-m2`; M3/M4 reuse a freed worktree), branch `claude/gauntlet-<m>-2026-09-22` off main `8cbc365`. `app/node_modules` is a junction to the main checkout — never delete it.
- Builder contract: search for an existing implementation first (built-but-unmounted is Arbor's dominant defect); cite what was reused; net-new component needs a stated reason; never widen scope past the module; read `Arbor/app/DESIGN.md` before writing.
- Memory discipline (hard): run only targeted vitest files with `--maxWorkers=1`; `tsc` once at the end with `node --max-old-space-size=2048 node_modules/typescript/bin/tsc --noEmit`; never `npm test`, never `npm run build`, never start a dev server. The orchestrator runs the full gate chain and the sandbox captures between rounds.
- Critics never edit code. Default verdict `failed`; no rendered evidence → `blocked`, never `passed`.
- Verification cost rule (Guy, 22 Sep): zero model calls in the sandbox — providers off, fixtures only. One real synthetic run in production at the very end, by the orchestrator.

## 3. Bar (cited verbatim in every prompt)

G0 — hard gates: `npm run lint` · `npm test` · `check:floors` zero new FAIL · `check:framework` · `eval:safety` · clinical firewall (counts only) · register (kid = avatar/comic; never parent chrome) · tokens (DESIGN.md names only) · containment `scrollWidth === clientWidth` at 390 · a11y (44 px floor, htmlFor/id, focus order) · console zero errors · RTL `lang="he"` mirrors.
G1 — fidelity against the named benchmark: composition/hierarchy · typography/wrapping · spacing rhythm · colour/token consistency · image crop/sharpness · copy. Findings P0/P1/P2 with file:line and fix.
G2 — the wow gate: the ONE moment that makes a kid want to come back; named, not "looks polished".

Round cap: 3 per module. Stop conditions per the gauntlet skill.
