# Studio games gauntlet: 17 Nov 2026

B-GAME-46. Five critic rounds over the five live Studio games, each followed by fixes and a release. Result: all five pass.

## Benchmark, register and evidence

- **Surfaces:** Wobbly Delivery, Five-Friend Sun, Oops Button, Rover Delivery and Hero Band (`app/src/components/kidmode/studioV2/games/adventures/`).
- **Register:** kid.
- **Benchmark:** two things.
  - Five-Friend Sun's staging after B-GAME-43.
  - The kids game bar: 12 items scored 0–2 each, target at least 20/24 with no zero. The items are identity, first fun, responsive consequence, idle life, piece quality, phone/desktop composition, sound, soft failure, meaningful ending, replay variety, Hebrew/RTL and copy quality.
- **Gates:** G0 hard gates, then G1 fidelity and copy, then G2 the one moment a 4-year-old would come back for.
- **Critics:** four independent critics, read-only. They covered Wobbly, Oops, Rover, and Hero Band with Sun. Each worked from the source, the copy files and `app/DESIGN.md`.
  - The critic evidence was a static reading of the source.
  - The rendered evidence came from the fix round: the local preview at 390×1000, with sound off and English.

## Round 1: critic scores (before fixes)

| Game | Score | Verdict | Gate that failed first |
|---|---:|---|---|
| Wobbly Delivery | 15/24 | failed | G0: glow and gold on the tiles and flower, against DESIGN.md's rule for the signal colour |
| Oops Button | 15/24 | failed | G0: jam glow; the sound button was named after Sprout although no Sprout guides the game |
| Rover Delivery | 14/24 (replay variety scored 0) | failed | G0: the tile tint and rays were a yellow wash |
| Hero Band | 18/24 | failed | G0: the own-dance steps were 38px, under the 44px tap floor |
| Five-Friend Sun | 18/24 | failed | G1: copy accuracy (the spinner was called a dreidel; the arrival lines differed between the two languages) |

Every critic said the B-GAME-45 glows, rays and gold went against the kid register in DESIGN.md: the signal colour may mark a thing but never fill a surface, with no gold, yellow wash or glow. That staging was ours, and this round corrects it.

## Fixes (commit `24235dd6`)

- **Design (G0)**
  - Glows are gone from all five stages: the cheer ring, the hub halo, the tile lights, the flower and the lanterns.
  - Done and chosen states are now teal or teal-ink. Signal amber only marks a thing, as an outline ring.
  - The rover tiles are pearl and mist.
  - The replay colour is graphite.
  - Hero Band's own-dance steps meet the 44px floor (52px, four and four on a phone, no overflow at 390px).
  - Hero Band's move pads carry their names for screen readers.
- **Copy (G1), English and Hebrew in all five games**
  - **Oops Button:** the petals to put back are numbered, biggest first, with "Press number N" and "Good. Now number N". A chip on each open petal shows the number. When the toy jams by itself, the game says so and plays the try-again sound. "עלי הכותרת" became "העלים". Peach became pink, so no word contains "פרס" (prize).
  - **Rover Delivery:** the arrival is spoken aloud, and the arrival hold is now 3.2 s. The Hebrew replan line names the Start button. "parked" became "stopped".
  - **Hero Band:** the retry and jam lines describe what is on screen. The sound-off line was rewritten. The third move is now "Pose".
  - **Five-Friend Sun:** the spinner is a wheel (גלגל), not a dreidel. The arrival lines say the same thing in both languages.
  - **Wobbly Delivery:** the thanks and sound-off lines were rewritten (they are on-screen text only, with no voice file).
  - **Transfer lines:** every one starts "Away from the screen:" / "מחוץ למסך:".
  - **Replay button:** where no Sprout guides the game, it is named "Hear it again" / "לשמוע שוב".
- **Play (G2 pull)**
  - Hero Band's pads answer the first tap at once on the ready screen.
  - On Rover's first floor, the sign to turn pulses before the child touches anything.
- **Tests**
  - Oops flow: 30. Rover flow: 27. Rover rules: 42. Hero Band flow: 6. Sun flow: 28. Wobbly flow: 34. Wobbly voice: 14.
  - Guards: kidDesign 101 (adventures.css baseline 151), childSignalsLanguage 9, tokens 75, tokens.contrast 63, layoutTokens 32, chromeHygiene 14.

## Rendered checks (fix round)

| Check | Result |
|---|---|
| Hero Band own-dance steps at 390px | grid of 4 × 52px, two rows (tops 379 and 436); `scrollWidth` 390 = `clientWidth` 390 |
| Move pad names | Jump, Zoom, Pose, Wobble |
| Replay button name | "Hear it again" |
| Sound-off line | "Sound is off. Watch the rings and your hero." |

## Open list (not fixed in this round)

| Item | Why it is open |
|---|---|
| Wobbly's voiced lines: separate "not yet" for wrong and early, journal becoming "drawing book", Hebrew asks wording, speaking the thanks and bloom lines | Each needs a voice re-render, which needs the Google speech API. Guy's rule for now: no more Google API. |
| Replay variety: Rover floor mirroring, Sun far-seat rotation, Wobbly friend-order shuffle, Oops order variety | Rover scored 0 here. This is design work beyond one round. |
| Pep's size on Rover's 4×4 floor; a parcel sprite; Wobbly friend size (46px → 72px); the shelf zoom tap size at scale .72; the carry wobble | Art and layout passes |
| Hero Band success line that names the moves (HB-7); Sun count digit (FS-5) | Copy and staging follow-ups |
| The Sun's amber rays and confetti | Kept on purpose: the sun is the subject, and amber is its own colour. A critic may still call this out. |

Release of round 1: Arbor CI green on `24235dd6`, then main fast-forwarded to it. Arbor Deploy run 44113686375 passed deploy-candidate and promote. Live `timestamp.txt` read `24235dd6…-44113686375-1`, and `/api/health` returned 200 (17 Nov).

## Rounds 2–4: critic scores and fixes

New critics each round, read-only, working from the source at the fixed commit. Their scores come from reading the code; the rendered checks are listed below.

| Game | Round 1 | Round 2 | Round 3 | Round 4 |
|---|---:|---:|---:|---:|
| Hero Band | 18 | 17 | 21 (G0 fail) | **22, passed** |
| Wobbly Delivery | 15 | 17 | 19 | **22, passed** |
| Oops Button | 15 | 16 | 18 | **21, passed** |
| Rover Delivery | 14 | 17 | 19 | **21, passed** |
| Five-Friend Sun | 18 | 18 | 18 | 22 (G0 fail: two "next" cues in teal) |

- **Round 2 fixes (`c6ee3bab`, `7679be35`)**
  - **Rover replay variety, which scored 0 in round 1:** each Play again turns every floor a quarter turn clockwise. Each turned floor keeps exactly one answer, the same presses per sign and the same hint. The rules tests prove this for every floor.
  - **Colour:** the last yellow fills, glows and rays are gone: Hero Band's first move and spot light, Sun's floor wash, wheel wedge and rays, Rover's rug rays, Wobbly's card centres and puff, and Oops' bloom rays.
  - **Endings:** the sun holds 4.2 s, and Wobbly's flower doubles in size as it opens.
  - **Hero Band play:**
    - A wrong copy tap keeps the moves already danced.
    - Empty own-dance steps are disabled.
    - "Open my dance" shows only for a full dance.
    - The show ends with the finish sound.
  - **Copy:**
    - Hero Band's Hebrew has no gendered forms.
    - Sun counts rays of the sun.
    - Rover's pot is a flower pot.
    - Oops' undo line says the last petal goes first.
- **Round 3 fixes (`071d5a5c`)**
  - **Shared stage:** the success ring is teal (done) and the hint ring is signal amber (next), so all Bop games say done and next the same way.
  - **Sun:**
    - The wheel taps as it starts and names the hop only once it stops (1.05 s; the pads wait too).
    - No white halo behind the sun.
    - The rays are flat, with opacity capped.
    - The wheel is pearl and mist with teal-ink dots.
    - The hint chip is an amber ring, not a fill.
  - **Wobbly:**
    - The open flower stands in front, with the lanterns cleared.
    - A toy already on the rug only wobbles, with no "not yet".
    - The smallest zoom keeps the 44px floor.
  - **Oops:** only the newest petal is ringed in undo.
  - **Rover:** Pep is 44px on every floor, and the finish line says the rover made it to Pep, since no parcel shows on screen.
  - **Hero Band:** the stage beams are flat and faint.
- **Round 4 fixes (`244267fb`)**
  - **Sun:**
    - The spinner's ready ring and Chock's empty seat pulse in amber.
    - "The wheel is turning…" shows while it turns.
    - The spinner keeps its plain name until the wheel stops.
    - The Hebrew pad line is gender-free.
  - **Wobbly:** face-down cards are mist felt with the teal-ink stitch.
  - **Copy:**
    - Hero Band's Hebrew finish is gender-free.
    - Rover names the Start button.
    - Oops' Hebrew petals are עלה כותרת (petal), not עלה (leaf).
- **Declined**
  - **Oops "double jam":** the toy's own jam on the first right press is required by the brief, and a test pins it.
  - **Wobbly item words and separate "not yet" lines:** these need a voice re-render, and Guy's rule is no Google API for now.
- **Tests at `244267fb`:**
  - Sun: flow 28, rules 24.
  - Wobbly: flow 34, voice 14.
  - Oops: flow 30, rules 58.
  - Rover: flow 27, rules 44.
  - Hero Band: flow 6, rules 6.
  - Adventures: 12.
  - Guards: kidDesign 101, childSignalsLanguage 9, tokens 75, tokens.contrast 63, layoutTokens 32.

## Rendered checks (rounds 2–4)

These come from the local preview at 390×1000, in English with sound off, on the round-3 build.

| Check | Result |
|---|---|
| Success ring colour (`.bop-cheer__ring`) | rgb(17, 102, 95), which is teal-ink |
| Hint ring colour (`.bop-piece[data-hint]::after`) | rgb(217, 122, 43), which is signal amber |
| Hero Band ready screen | No yellow wash or glow; pads named Jump, Zoom, Pose and Wobble; `scrollWidth` 390 |

## Round 6: rendered play-throughs and idle nudges (`353e2a7d`)

Every game was played from its Playbank or Studio tile to its ending, in the local preview at 390×844, in English with sound off. Each run went through the real buttons, from a script that reads the board the way a child sees it.

| Game | Path played | Result |
|---|---|---|
| Hero Band | Own dance: eight steps filled, beat started, Show time, then the ending | Ends on "A dance of its own". Show time runs with the amber ring on the current step. `scrollWidth` 390 |
| Oops Button | Three rounds: round 1 clean, then the toy's own jam, Oops, undo newest first, Start again, copy, then round 3 | Ends on "It bloomed!" |
| Rover Delivery | Three floors, each solved by following the hint ring | Ends on the card's finish ("Delivered!" before the copy fix below) |
| Five-Friend Sun | Spin, count on, hop to the pad, bring Chock's pad in, until all five rays are lit | Ends on "Everyone is here!" |
| Wobbly Delivery | Three friends' requests delivered in order, through to the bloom | Ends on "Delivered!" |

**Defects the play-throughs found, now fixed:**
- **Five-Friend Sun:** the spinner's hub and its number chip shared one React key. Every spin left a stale hub behind, so by the third spin a column of hubs ran down past the card at 390px. With distinct keys there is one hub on every spin; rendered after 8 spins: 1.
- **Hero Band:** on a 390×844 phone the own-dance view hid "Show time!" below the fold, with the inner scroller 884px tall against 768px. A lower floor on phones puts the button's bottom at 804px.
- **Wobbly Delivery:** the ending's carry-over line still began "Try it for real:", unlike the other four games. It now starts "Away from the screen:" / "מחוץ למסך:".
- **Rover and Sun card copy** (the Studio card around the game): Rover's card still said the rover had a delivery and ended "Delivered!", though no parcel shows. It now ends "The rover made it to Pep!", as the game does. Sun's first beat says the wheel, not a dial.

**Added:**
- **Idle nudges.** These are rendered, and rules tests pin them.
  - **Oops Button:** after 6 s with no press on the child's turn, the next petal in the order gets the amber ring. Rendered: ring rgb(217, 122, 43) on the right petal.
  - **Rover Delivery:** after 7 s untouched on any floor, the sign to turn gets the ring. Rendered: amber ring after 7 s, absent at 6.8 s.
- **Sun advisories from round 5:**
  - The spinner reads "The wheel is turning…" while it turns.
  - Chock's empty-seat placeholder is ink at 40%.

**Tests at `353e2a7d`:**
- Oops: flow 30, rules 58.
- Rover: flow 29, rules 44.
- Sun: flow 28.
- Wobbly: flow 34, voice 14.
- Hero Band: 6.
- studioGameVoice 4, studioNextFlag 13.
- Guards: kidDesign 101, childSignalsLanguage 9, tokens 75, contrast 63, layoutTokens 32.

## Open list (residual P2s)

| Item | Why it is open |
|---|---|
| Wobbly's voiced lines (item words, separate wrong and early "not yet") | Need a voice re-render; held under "no Google API" |
| Rover: a parcel sprite, and floors beyond the three turned layouts | Art generation is held, and more floors are design work |
| Sun: separate clicks during the turn, beyond the single tap at the start | Sound pass |
| iPhone pass and a native Hebrew read | B-BOOK-34 |

## Round count and result

- Five critic rounds. Rounds 1–4 covered all five games. Round 5 covered only Five-Friend Sun, the one game still failing after round 4. This is past the skill's default cap of three rounds per module; the extra rounds ran because Guy's goal sets the bar at all five passing.
- **Round 5, Five-Friend Sun on `244267fb`:** 23/24, passed, G0 clean. It confirmed both amber "next" cues, the turning phase and the gender-free Hebrew. Two advisories, not failures:
  - Label the spinner with "The wheel is turning…" while it turns.
  - Draw Chock's empty-seat placeholder in ink, not teal.
- **Final scores:**
  - Five-Friend Sun 23/24.
  - Hero Band 22/24.
  - Wobbly Delivery 22/24.
  - Oops Button 21/24.
  - Rover Delivery 21/24.
  - All five have no zero and a clean G0.
- **Releases:**
  - `7679be35`: Arbor Deploy run 44125735569, live, health 200.
  - `071d5a5c`: Arbor Deploy run 44132184828, live, health 200.
  - `244267fb`: Arbor CI green, then main fast-forwarded. Arbor Deploy run 44135146268 passed deploy-candidate and promote. Live `timestamp.txt` reads `244267fb…-44135146268-1`, and `/api/health` returns 200 (17 Nov).

final result: passed. All five games clear 20/24 with no zero and a clean G0 on critic reading of the source. Each game was then played through to its ending at 390×844 in round 6. The three defects that pass found are fixed and were rendered again. The residual P2s are in the open list. Two are held by Guy's no-Google-API rule (voice and art); the iPhone and native Hebrew pass is B-BOOK-34.
