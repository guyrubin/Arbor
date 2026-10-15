# Arbor Kids: three adventures

Built against main `fa3f994715e2dba1ef782480c13863dfab0597cf` (Kids Studio V2 + Parent V3). Adds three adventures and expands the existing game suite. The final integration includes the subsequently merged voice fix on main `86611d6e2b21f613d5329919452e431783bde2a8`; independent design-parity and identity candidates remain separate.

| Game | Play loop | Practice opportunity | Replay |
| --- | --- | --- | --- |
| River Rescue | Plan an adjacent route, collect supplies, sail the route, reach the dock | Planning, spatial reasoning, revising a plan | Three missions; 3×3–5×5 maps with eight rotations/reflections, two selectable challenge sizes, undo and route-aware hints |
| Feelings Forest | Hear Sprout's explicit self-report, identify the named feeling, choose support, see the response | Emotional vocabulary, listening, asking permission and perspective-taking | Three of six authored scenarios; three support responses each; two language editions |
| Rhythm Garden | Watch/hear a pattern, reproduce the order, grow a personal tune | Sequential memory, listening, creative play | Three patterns from 2–5 notes, optional visual pattern, then an eight-note composition with playback and undo |

## Product boundaries

- Ages 3–8 through the existing centralized content eligibility; unknown age and under-three profiles stay excluded. Initial challenge uses `stageFor` and can be changed. No ability verdict is inferred from a child's play.
- English/Hebrew copy and RTL interface. River coordinates retain physical direction. Musical sequence reads in the interface direction. Shape/icon labels accompany color; all inputs use native buttons and work without drag or response deadlines.
- No countdown, lives, leaderboard, streak, reward lock, failure buzzer, camera, microphone or model calls in game logic. Finite sessions return through Studio's existing result/replay flow.
- River hints search from the route the child actually made. An unsalvageable route suggests undo; every generated map has a tested solution.
- All feeling stories explicitly name the feeling. Expressions are not interpreted as diagnoses. All three support choices model consent and allow feelings to remain.
- Music uses the existing child audio bus, per-child mute, hush and visibility lifecycle. Playback timers/oscillators are cancelled on pause, mute, hidden document and unmount. Silent play remains available.
- Existing `GameShell`/`kidSay` narration retains Arbor's current voice routing and may incur its existing TTS charges. No new AI infrastructure, model, generation cost, paid media or dependency is introduced.
- Intro/result retain the existing canonical `HeroAvatar`. New scenery contains no child identity. No generated poses or profile writes. Existing identity fixes remain separate.
- Existing owner/child/activity session key and owner-scoped keepsake ledger handle completion. No gameplay telemetry, performance scores or observations are sent to the parent data model.
- An optional off-screen activity closes each third round. These are practice opportunities, not validated developmental interventions or assessment tools.

## Design rationale

Three complementary loops were chosen: plan/revise, listen/respond, and remember/create. Harvard's Center on the Developing Child describes age-sensitive play as an opportunity to practise attention, working memory and self-control. This supports the general design direction, not a claim that these particular digital games improve clinical or developmental outcomes.

Sources checked 15 October 2026:
- https://developingchild.harvard.edu/resources/handouts-tools/activities-guide-enhancing-and-practicing-executive-function-skills/
- https://developingchild.harvard.edu/resources/handouts-tools/brainbuildingthroughplay/

## Verification

- TypeScript check passed.
- Full existing suite plus initial adventure tests: 15,304 passed; 10 skipped and one todo already reported by the runner.
- Seven additional real-handler flow checks subsequently passed: full three-round EN/HE sessions for each game, early completion prevention, retries, replay, composition cap, pause and navigation cleanup. Total focused adventure coverage: 21 checks.
- All map/challenge/round/orientation combinations prove solvable. Audio contract tests verify muted/unavailable/disposed gates and oscillator cleanup.
- Framework and capability checks passed. The existing F18b coRegulationScript warning remains outside this feature.
- Safety evaluation and offline acceptance contracts passed.
- Production frontend, public-guide generation, service-worker stamp and server bundle built successfully. In this container the `tsx` CLI cannot open its IPC socket; equivalent `node --import tsx` invocations executed the same scripts successfully.
- **Not verified:** rendered desktop/mobile gameplay, physical sound output, authenticated family persistence or production deployment. Local browser installation failed; cloud browser could not access localhost and automatic approval review rejected ChatGPT sign-in to the owner-private preview. No authentication or access controls were bypassed.

Private playable preview: https://arbor-three-adventures.amberbetta64.chatgpt.site

The preview uses the actual game/Studio components with synthetic profiles, device-local collection storage and browser narration. It never reads a real Arbor family. Saved rooms and melodies can be reopened on the same device. It is a review build, not Arbor production. Complete a rendered EN/HE desktop/phone playthrough and signed-in keepsake/child-switch check before release.

## Expanded brief — existing games and the Sneak & Freeze design bar

The owner clarified that the three adventures must complete the existing game suite, remove irrelevant overlap, develop the useful games, use the same approved avatar as the rest of Arbor, and reach a much higher visual/engagement standard using Sneak & Freeze as the reference.

### Curated child experience

The child menu now offers eight distinct games: River Rescue, Memory Match, Sequence Quest, Puzzle Planet, Sneak & Freeze, Feelings Forest, Calm Builder and Rhythm Garden. The home provides direct doors to the three new adventures. Overlapping Feelings Detective, Mimic Studio, Rhythm Hero and Sound Explorer, plus the parent-oriented letter/story/pose/speech destinations, are removed from this menu. Existing parent practice routes and historical keepsakes remain resolvable. This is menu consolidation, not deletion of a child's history.

| Game | Expanded experience |
| --- | --- |
| River Rescue | Dedicated cinematic river, smooth boat travel with the current hero as captain, three bounded missions, route hints from the actual path, undo, two challenge choices, rotations/reflections on replay. |
| Feelings Forest | Dedicated woodland clearing, the current hero beside Sprout, authored feeling stories, different caring responses, ability to try another response before continuing. Narration retires when the story changes. |
| Rhythm Garden | Dedicated lantern garden, hero conductor, copy modes plus immediate free composition, three tempos, eight-note cap, playback/pause/undo, saving and reopening a tune to remix. |
| Calm Builder | Three environments, three lighting choices, movable objects with undo/removal, the canonical hero inhabiting the room, saving and reopening the actual layout. |
| Puzzle Planet | Three pictures, four/nine pieces, whole-picture peek, selected-piece hint, a complete-picture reveal and deliberate finish action. |
| Memory Match | Explicit age-bounded board choice, localized restart, fresh shuffle, tactile card treatment. Child-play default size no longer depends on historical practice scores. |
| Sequence Quest | Fresh session seed on replay and child-controlled Next after the answer, keeping the pattern on screen until the child is ready. Parent practice behavior is retained. |
| Sneak & Freeze | Retained as the established movement game and visual reference. Its existing bound-identity chain remains authoritative. |

### Avatar identity and creations

`StudioPlayHero` uses exactly the Studio-home authority: a current child pose sheet only when the profile has an approved avatar and the resolver identifies the sheet as current child art. Otherwise it renders the canonical `HeroAvatar`, with the existing honest Sprout fallback. It never generates an identity, imports the proof child's portrait into another profile, or replaces a profile with stock artwork. River uses one moving hero node. The shared result still has one portrait.

Private `studioCreations` records contain only a validated, bounded corner layout/light/scene or melody notes/tempo. They are filtered to the active owner and child, strip unrelated fields, reject stale/unloaded/error writes, and propagate storage failures for a retry. No portraits, feelings, recordings, performance scores, timestamps or interaction histories are saved. The latest creation of each kind is shown in the collection and can be reopened in its game. Actual authenticated synchronization is still a browser acceptance gate.

Replay and co-play are the engagement mechanisms: changing routes and patterns, alternate responses, creations to remix and show to someone nearby. There is no public child sharing flow, competitive ranking or promised virality.

### Visual production

Three original environment plates were generated with the built-in image tool, inspected, then encoded as 1536px WebP plus 480px derivatives under `app/public/visuals/studio-v2/adventures/`. Every large derivative is below the existing 400 KiB asset ceiling. The scene files are `river`, `woodland` and `garden`. No child/person is painted into any plate. All consumers use the central art manifest. Styling adds tactile toy surfaces, illustrated stages, smooth boat movement, reactive musical flowers and reduced-motion alternatives. Existing memory, pattern, puzzle and builder mechanics receive matching stage treatment.

Prompt set: cinematic family-adventure 3D environment plates, rich physical lighting, tactile materials, clear playable center, detailed peripheral foliage, no humans/characters/faces/UI/text. River: turquoise water, sandstone banks, waterfall and small dock, elevated camera and open central water. Woodland: warm forest clearing, old trees, low bench, moss and soft afternoon light, room for two character overlays. Garden: blue-hour lawn, lanterns, distant treehouse and pond, clear center for musical flower controls. Original generated PNGs are retained outside the repository; optimized shipped assets are committed.

### Latest validation and remaining release gate

- TypeScript and the full frontend/server production build passed; public guide and service-worker output built successfully.
- 462 focused gameplay, identity, art-manifest, localization and firewall checks passed after correcting source-copy and asset-size regressions. The boat sizing entry in the proportional-fill classification is geometry, not a child-record meter; the detector remains enabled.
- Framework consistency, capability floors, deterministic safety and offline acceptance passed. The pre-existing coRegulationScript floor warning remains unchanged. Live model evaluations were not run.
- The complete suite passed: 1,019 test files, 15,331 tests; 10 skipped and one todo. Integration with the newly merged voice fix is additionally verified in the PR.
- Browser sign-in to the owner-private preview was rejected by automatic approval review because sign-in was not explicitly authorized. No auth bypass was used. No claims are made about complete rendered/mobile playtesting, physical-device audio, native Hebrew editorial approval or authenticated family persistence.
- This is a reviewable branch and a private synthetic preview, not a merge or deployment to Arbor production. The visual quality target requires actual device playtesting before final acceptance.
