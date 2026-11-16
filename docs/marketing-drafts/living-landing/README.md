# Living landing page (English): notes and sources

The English landing page, `app/public/marketing/arbor-marketing-landing-page-en.html`, carries the living landing, version 3, from 15 Nov 2026 (Guy: "go live"). It joins two earlier drafts: one evening followed through Arbor (a five-scene film inside a phone) and a screen-by-screen account of the product (a guide to the app's six parts). The ground is light throughout, on the tokens of `app/DESIGN.md`; navy is used as ink only.

This folder keeps what does not ship: these notes and `arbor-one-evening.mp4`.

## Files that ship

All in `app/public/marketing/`, each on `APPROVED_MARKETING_FILES` in `app/src/lib/marketingDeployGuard.test.ts`:

- `arbor-marketing-landing-page-en.html`: the page.
- `arbor-living-v3.css`, `arbor-living-v3.js`: styles and behaviour. Trial links go through `trialHref` in the shared `arbor-conversion-v12.js`, so incoming `utm_*` and `ref` still win.
- `arbor-living-scene-v3.js`: the Living Forms sculpture. It loads last, once the page is idle; data saver, a 2G link or a device with 2 GB of memory or less get the still artwork instead, as does a device without WebGL. It moves for a few seconds after the visitor scrolls or moves the pointer, then rests and stops drawing.
- `vendor/three-0.170.module.min.js`, `vendor/RoomEnvironment.js`, `vendor/three-LICENSE.txt`: three.js, from the import map in the page.

Artwork and fonts already in `app/public` are used in place: `visuals/studio-v2/`, `visuals/parent/v2/`, `visuals/guides/`, `brand/`, `fonts/`.

Trial buttons carry `utm_source=arbor_landing&utm_medium=website&utm_campaign=landing_v14` (see `utm-scheme.md`).

## Preview and the film

Serve `app/public` (for example `python -m http.server 4811` from `app/public`) and open `/marketing/arbor-marketing-landing-page-en.html`. Add `?motion=off` for the still render, or `?film=1` for the recording stage (the hero film alone, 16:9, driven by `window.__film.render(seconds)`). `arbor-one-evening.mp4` (36 seconds, 1280 by 720, no sound) was recorded frame by frame from that stage.

## What is on the page

| Section | Content |
|---|---|
| Hero | Promise, trial button with the price that follows the trial, and "One evening with Arbor": a phone that plays five scenes (Now at 18:40, Talk at 18:42, Together at 19:30, Tonight at 20:15, the week on Sunday). A chapter list jumps to any scene; the film plays twice while on screen, then rests, and can be paused |
| Guide | The six parts: three places (Now, My child, Together) and three doors (Talk with Arbor; Care, together; For you, the parent). Each has its screen and a numbered list that matches the numbers on the screen. Talk has three example moments to try; the care summary has boxes to tick |
| Seven approaches | Seven buttons tied to seven pebbles in the sculpture; the ones used in the chosen example are marked. An answer leads with the approaches that fit; it does not use all seven (`selectCouncil` blends about three) |
| Kids Studio | The four worlds with artwork from the app, the counts, and how a parent opens and leaves it, with a hold-to-leave demonstration |
| Control | What is remembered and shared, and four privacy facts |
| Plans | The 14-day trial and Arbor Plus, with a trial button on both cards |
| Questions, start | Six questions, three steps, the last trial button |

Every app screen is drawn in HTML and CSS on the app's tokens, with a synthetic child ("Noa", age 4). No screen capture and no real family data. The example content is written for the page; the layout of each screen is a drawing, not a copy of the component.

## Facts the copy depends on

Each was checked against the repository on 15 Nov 2026. Recheck when the app changes.

| Claim | Source |
|---|---|
| Three places and three doors, their names and icons | `app/src/lib/companionPlaces.ts`, `app/src/lib/i18nCompanion.ts` |
| Wording on the Now and Tonight screens; "Then and now" on My child | `app/src/components/companion/nowV41Copy.ts`, `nowViewCopy.ts` |
| Weekly report: "For next week:" | `app/src/lib/i18nElevation/foundation.ts` |
| Answer labels: Try today, Say this, Aligned with; actions Save to Action Plan, Log this, Copy | `app/src/lib/i18n.ts` (`coach.cards.*`, `coach.alignedWith`) |
| Seven named approaches; an answer blends about three | `app/src/lib/i18n.ts` (tones and "More approaches"), `app/src/services/council.ts` |
| Routine "Calm bedtime" and its four steps; Calm morning, Tidy-up time | `app/src/lib/routines.ts` |
| Together filters (All together, Stories, Games); "Create a story"; "{name}'s Bedtime Story" | `app/src/lib/i18nCompanion.ts`, `app/src/lib/i18nElevation/celebrate.ts` |
| 130 milestones, 2 months to 5 years, a map of eight areas | `app/src/lib/milestoneData.ts`, `i18nCompanion.ts` (`companion.milestones.*`) |
| Ten masterclasses and their titles; "Parent Masterclasses", "Recommended for your family" | `app/src/lib/masterclasses.ts`, `app/src/lib/i18n.ts` |
| More than 70 Learn cards; the two card titles shown; "{n} min read"; "Picked for {name}" | `app/src/learn/learnCardsCore.ts`, `app/src/lib/i18n.ts` |
| Kids Studio: four worlds, the guide, eight games for ages 3 to 8, 21 stories | `app/src/components/kidmode/studioV2/studioCopy.ts`, `studioCatalog.ts` |
| Leaving Kids Studio: three-second hold, then a two-digit sum or the parent's own PIN | `app/src/components/kidmode/parentGate.ts` (a friction barrier, not a security boundary: never call it a lock) |
| Care summary for eight kinds of reader, PDF without paying; school brief: free draft from what was recorded, "Draft with Arbor" with Plus | `app/src/lib/i18nElevation/careprofile.ts`, `learnCare.ts` |
| Trusted sharing: roles Co-parent, Viewer, Professional; scopes; 30 days, 60 days, end of term, until revoked. Co-parent sharing stays free | `app/src/lib/i18n.ts` (`share.*`), `app/src/lib/i18nElevation/coParent.ts` |
| Prices €12.99 a month, €129.90 a year | `app/src/lib/pricing.ts` (the claim audit test checks every price on the page) |
| The trial link carries a `moment` only after a pick | `arbor-living-v3.js`; the app reads it in `app/src/lib/trialEntry.ts` |

Not claimed, because the source does not support it today: app-store apps, languages beyond English and Hebrew, finding a professional, expert review of content, games for children over 8, a weekly email, sharing with a teacher or therapist being free.

## Open

- The Hebrew page (`arbor-marketing-landing-page-he.html`, copied byte for byte to `marketing/index.html`) is a translation of this page on the same CSS and script; the script reads `lang="he"` for its own words.
- The copy has had no clinical or native-speaker review.
- The Bebe and Gob Gob art kit is not used: the two children are likenesses of real children and the names are not cleared.
- The Claude Design kit "Arbor Design System" was not read; the page follows the kit in the repository (`app/DESIGN.md`, `app/src/index.css`).
- The app still records `landing_version: "v12"` for every arrival (`app/src/lib/trialEntry.ts`); the campaign tag tells the pages apart.
