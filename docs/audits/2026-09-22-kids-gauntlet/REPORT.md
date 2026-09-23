# Kids experience gauntlet — report

**22–23 Sep 2026 · orchestrator/validator: Claude Fable · builders and critics: Claude Opus subagents.** Base `8cbc365` (live 22 Sep 14:51 UTC). Integration branch `claude/kids-gauntlet-2026-09-22`. Run brief: [RUN-BRIEF.md](RUN-BRIEF.md).

## Benchmark and evidence

Benchmark: `output/playwright/arbor-kids-2026-09-22/references/` (contact sheet, `kid mode ui.jpg`, `dl hero.jpg`, story example, `avatar (2).jpg`, `avatat(3).jpg`) and Astra's accepted candidates `10-candidate-home-390.jpg`, `11-candidate-pattern-390x700.jpg`, `23-lantern-opening-390.jpg`. Evidence: critic reports in this folder (each names its captures, JS measurements and file:line). Sandboxes were per-module dev servers of the builder branch with providers OFF (zero model calls). Viewports: 390×844 (primary), 320×700 (Pattern Power, Hero Pose, header), RTL under `he`.

## Rounds

| Module | R1 | R2 | R3 | Final builder commit | Critic evidence |
|---|---|---|---|---|---|
| M1 home + nine-world continuity | failed — 4×P1 (Mood Mountain initials not Sprout; Hero Pose double hero; compact header collapse at 320; Hebrew Kid Mode rendered English) | failed — 1×P1 (second kid dictionary `kidRegister.ts` still English, 93/118 keys) | closed by source (118 keys translated; destination labels too; only arcade world names stay EN by test lock) | `a2ee99e` | [CRITIC-M1-round1](CRITIC-M1-round1.md), [round2](CRITIC-M1-round2.md); round 3 verified by tests only |
| M2 story reader is a comic | failed — Immersive 32 px; ending toggle 40 px; re-read never shelved; cover did not read as a cover; smudged page re-billed on remount | closed by source: shelve at the last beat, session failed-key guard (one call per failure), cover with hero cameo + real flip, 44 px controls | journey page keys carry the story id (`storyId` prop) | `e75a442` | [CRITIC-M2-round1](CRITIC-M2-round1.md); rounds 2–3 verified by tests only |
| M3 comics shelf, both registers | failed — P0: validator rejected every journey book (`parts[6]` = per-beat seed) so no journey book opened on either shelf | closed by source: strict validator + rejection test; cover-led child cards; child shelf lists only books that open; off-device copy says what to do; Hebrew titles; "your comics" | — | `31b0dc4` | [CRITIC-M3-round1](CRITIC-M3-round1.md); round 2 verified by tests only |
| M4 hero creation step | built (picker clear control, radio semantics, bilingual `elev.hero.*`, HeroFirstStep at the Kid Mode door, ≤ 200 KB hero, loud write failure) | — | — | `d785d51` + `7aa37d8` (test type fix) | critic never ran — the machine had no memory for a sandbox (≈200 MB free all evening); verified by 49 unit/contract tests and by the production pass below |

Round cap of 3 respected. Rendered critic evidence exists for M1 (two rounds), M2 and M3 (one round each). The final rounds of M1–M3 and all of M4 were verified by targeted tests plus the pipeline gate, then by a fixture pass on production (below), not by a sandbox critic — a deviation from the gauntlet contract forced by the RAM ceiling on this machine.

## Gate results (G0)

- Local gate chain could not run on the integration commit (8 GB machine, other sessions held RAM; tsc died out-of-memory).
- The deploy pipeline's own gate (lint = tsc, full vitest, framework, floors, safety eval) ran on `98835b8` and **failed at lint**: 5 × TS2345 in `heroPersistence.test.ts` (fixture `style: string` vs `AvatarStyle`). No candidate was built; production stayed at `8cbc365`. Fixed in `7aa37d8`.
- Pipeline result on `7aa37d8`: see "Deployment" below.

## Findings still open (P2/P3, for the backlog)

- Hero Pose shows the hero twice (header cameo silenced for AT + in-world demonstrator) — a composition call.
- "Playbank", all-caps `LOGIC/MIMIC/RHYTHM` tags, `NEW` ribbons, doubled back controls in EN kid mode; cameo wraps to its own row at 320.
- 16 overlapping keys across the two kid dictionaries with differing HE values (shrink-only ratchet).
- Kid home fires `POST /api/generate-scene` for every world tile although static art already renders — a WorldScene cost issue (7 calls per home visit when providers are up).
- Kid reader wears parent chrome (title row, Immersive) inside Kid Mode; register decision belongs with KidModeOverlay.
- G2 (the "wow" gate) for the games: a hero that demonstrates the pose via WorldScene, cached per child (12 image calls once) — designed, not built; product decision for Guy.
- Native Hebrew editorial review (GD-6/GD-7) of the AI first pass across three kid dictionaries — Guy's gate.
- `PracticeStudioTab` opens Kid Mode directly and bypasses the hero step.

## Deployment (23 Sep 2026)

Local gates could not run (RAM), so the deploy pipeline's own full gate chain was the gate, three times on main:

| Commit | Gate result | Production |
|---|---|---|
| `98835b8` integration (M1–M4 merged) | **lint failed** — 5 × TS2345, `heroPersistence.test.ts` fixture `style: string` | untouched, `8cbc365` |
| `7aa37d8` fixture typed | **test failed** — `whiteLabelContrast` (reflection checkbox fingerprint changed by M2's `min-h-[44px]`), `clinicalFirewall.dictionary` (`kid.game.beat-keeper.sub` he "מתופפים בקצב" matched the on-track pattern) | untouched |
| `9252c9c` checkbox split into a provable checked/unchecked pair (debt key retired), subtitle "מתופפים יחד" | **green**: lint · full vitest · framework · floors · safety · candidate build · smoke · promote | **LIVE 09:27:25 UTC** — [run 35842145366](https://github.com/guyrubin/Arbor/actions/runs/35842145366); Hosting stamp `9252c9c…-35842145366-1`; API `version` = SHA |

## Production validation (23 Sep, Guy's signed-in session, zero model calls)

- Child דילן is photo-only (`avatar: null`) in Firestore. Hero Stories (parent) shows "First, create דילן's hero … never around a real photo"; Hero Comics shows its gate; the Kid Mode door shows the HeroFirstStep dialog alone (no overlay behind it); "Continue with Sprout" enters Kid Mode; kid home renders Sprout (3 mascot instances), **zero `data:` images** inside the overlay, static world art on every tile.
- Release-day artefact: the first load after promote served two **stale lazy chunks** from the service worker (`BeatKeeperWorld-*.js`, `newGames-*.js` not referenced by the new index bundle) and the old Hero Stories layout; the next navigation was clean. Expect one stale load per device after each deploy.
- Guy's device had Kid Mode persisted open (`arbor.kidmode.active` = arcade/beat); while it is open the parent tabs render kid-register and hide the create-hero banners by design. Reset to closed for this validation.
- Not validated in production: hero generation itself (a paid image call and the parent's character choice — Guy's act), story-as-comic pages and shelf save (need a hero), Hebrew UI (Guy's UI is EN). These were verified by tests and, for M2/M3, by the sandbox critics.

final result: **passed with residuals** — all four modules live; the P2/P3 list above and the four unvalidated-in-production items go to `PAI/projects/arbor/ARBOR-OPEN-ITEMS-2026-09-15.md`.
