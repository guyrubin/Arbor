# Kid Mode — Hebrew transcreation worklist (GD-6, from KID-1)

**Status:** OPEN — blocked on Guy commissioning the native HE transcreation (decision GD-6).
**Owner gate:** native-human reviewer only. Child-facing Hebrew is NEVER machine-translated — kid register, comic voice, age ~4-9.
**Where the keys live:** `app/src/lib/i18n.ts`, `kid.*` namespace. All keys exist in BOTH language maps today; the `he` values are deliberate reviewer-pending placeholders carrying the EN copy, so `uiLang=he` renders vetted copy through the i18n seam (zero hardcoded strings in components).
**How to close:** replace each `he` value below with the reviewer's transcreated Hebrew, keep `{var}` tokens intact, then delete this file's OPEN status. Register separation: these keys are kid-register only — never reference them from parent surfaces (enforced by `app/src/components/kidmode/kidMode.test.ts`).

## Voice notes for the reviewer

- Kid register, warm and playful — never clinical, never parent-facing tone.
- Second person to the child; celebrate without pressure (stars, never streaks; no loss framing).
- `{name}` = the child's hero name; `{count}` / `{n}` are numbers. Keep tokens verbatim.
- RTL is handled by the app (logical CSS + bidi isolation of interpolated values); write natural Hebrew, no manual directional marks.
- The three `kid.exit.*` hold/back strings and `kid.safety.*` chips are read by parents too (gate chrome) — keep them plain and calm.

## Strings to transcreate (48)

| Key | Current EN (placeholder in `he`) |
|---|---|
| `kid.greeting` | Hi {name}! |
| `kid.greetingSub` | You're doing amazing today |
| `kid.stars.aria` | {count} stars earned |
| `kid.exit.backToParent` | Back to parent |
| `kid.exit.backToParentAria` | Hold to go back to parent |
| `kid.exit.holdIdle` | Hold to exit |
| `kid.exit.holdAria` | Hold to exit Kid Mode |
| `kid.exit.holding` | Hold… {n}s |
| `kid.safety.aria` | Parent safety |
| `kid.safety.locked` | Parent locked |
| `kid.safety.private` | Private by default |
| `kid.safety.stars` | Stars, never streaks |
| `kid.quest.eyebrow` | Today's adventure |
| `kid.quest.title` | Start a hero story |
| `kid.quest.sub` | Pick a world and you're the star |
| `kid.quest.cta` | Let's go |
| `kid.adventures.title` | My growth adventures |
| `kid.games.title` | Games |
| `kid.games.seeAll` | See all games |
| `kid.back.home` | Home |
| `kid.back.homeAria` | Back to home |
| `kid.surface.journeys` | Hero Stories |
| `kid.surface.arcade` | Playbank |
| `kid.surface.feelings` | Feelings |
| `kid.adv.playbank.title` | Playbank |
| `kid.adv.playbank.sub` | Play, learn & grow |
| `kid.adv.hero.title` | Hero Stories |
| `kid.adv.hero.sub` | You're the star |
| `kid.adv.feelings.title` | Feelings |
| `kid.adv.feelings.sub` | Explore & understand |
| `kid.adv.studio.title` | Studio |
| `kid.adv.studio.sub` | Create & express |
| `kid.game.memory-match.title` | Memory Match |
| `kid.game.memory-match.sub` | Find the pairs |
| `kid.game.feelings-detective.title` | Feelings Detective |
| `kid.game.feelings-detective.sub` | Spot the feeling |
| `kid.game.mimic-studio.title` | Mimic Studio |
| `kid.game.mimic-studio.sub` | Copy the moves |
| `kid.game.sound-explorer.title` | Sound Explorer |
| `kid.game.sound-explorer.sub` | Listen & match |
| `kid.game.sequence-quest.title` | Sequence Quest |
| `kid.game.sequence-quest.sub` | What comes next? |
| `kid.game.calm-builder.title` | Calm Builder |
| `kid.game.calm-builder.sub` | Design your space |
| `kid.game.rhythm-hero.title` | Rhythm Hero |
| `kid.game.rhythm-hero.sub` | Tap the beat |
| `kid.game.puzzle-planet.title` | Puzzle Planet |
| `kid.game.puzzle-planet.sub` | Piece it together |

Related (separate finding, same reviewer session): the self-declared first-draft Hebrew playbank + kid SFX copy (KID-8 / group finding "Hebrew playbank + kid SFX copy is self-declared first-draft, unreviewed") should be bundled into the same native review.
