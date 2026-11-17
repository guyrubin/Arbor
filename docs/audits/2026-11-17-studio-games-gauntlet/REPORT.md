# Studio games gauntlet: 17 Nov 2026

B-GAME-46. One critic round over the five live Studio games, then fixes and a release.

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

## Round count and result

- One round, then fixes. No second critic round has run on the fixed build, and no game has been re-scored above 20/24.
- Released: Arbor CI green on `24235dd6`, then main fast-forwarded to it. Arbor Deploy run 44113686375 passed both stages, deploy-candidate and promote. Live `timestamp.txt` reads `24235dd6…-44113686375-1`, and `/api/health` returns 200 (17 Nov).

final result: blocked. The G0 defects the critics named are fixed, and the G1 copy defects are fixed except the voiced Wobbly lines. The game scores have not been re-measured. Replay variety (Rover 0) and the voice items above remain open.
