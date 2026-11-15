# Living landing page (draft, not deployed)

Version 3 of the English marketing landing page redesign. It joins the two earlier drafts: the one evening followed through Arbor from version 1 (now a five-scene film inside a phone) and the screen-by-screen account of the product from version 2 (now a guide to the app's six parts). The ground is light throughout, on the tokens of `app/DESIGN.md`; navy is used as ink only.

It lives here, outside `app/public`, so it cannot ship with a hosting deploy. `app/src/lib/marketingDeployGuard.test.ts` allows only approved files in `app/public/marketing`.

## Preview

```bash
node docs/marketing-drafts/living-landing/preview.mjs
```

Open `http://localhost:4812/marketing/arbor-living-en.html`. Add `?motion=off` for the still render, or `?film=1` for the recording stage (the hero film alone, 16:9, driven by `window.__film.render(seconds)`).

## What is on the page

| Section | Content |
|---|---|
| Hero | Promise, trial button with the price that follows the trial, and "One evening with Arbor": a phone that plays five scenes (Now at 18:40, Talk at 18:42, Together at 19:30, Tonight at 20:15, the week on Sunday). A chapter list beside it jumps to any scene; the film plays twice while it is on screen, then rests, and can be paused |
| Guide | The app's six parts: three places (Now, My child, Together) and three doors (Talk with Arbor; Care, together; For you, the parent). Each has its screen and a numbered list, and the numbers on the screen match the list. Talk has three example moments to try; the care summary has boxes to tick |
| Seven approaches | Seven buttons tied to seven pebbles in the sculpture; the ones used in the chosen example are marked. The copy says an answer leads with the approaches that fit, not that all seven are in every answer (`selectCouncil` blends about three) |
| Kids Studio | The four worlds with artwork from the app, the counts, and how a parent opens and leaves it, with a hold-to-leave demonstration |
| Control | What is remembered and shared, and four privacy facts |
| Plans | The 14-day trial and Arbor Plus, in the wording and prices of the live page, with a trial button on both cards |
| Questions, start | Six questions, three steps, the last trial button |

Every app screen on the page is drawn in HTML and CSS on the app's tokens, with a synthetic child ("Noa", age 4). No screen capture and no real family data is used. Labels follow the app's copy where a source is listed below. The example content (the child, the moments, the answers, the story) is written for this page, and the layout of each screen is a drawing, not a copy of the component.

## Facts the copy depends on

Each was checked against the repository on 15 Nov 2026. Recheck before go-live.

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
| The trial link carries a `moment` only after a pick | `arbor-living-v3.js`; the app reads it in `app/src/lib/trialEntry.ts` |

Not claimed, because the source does not support it today: app-store apps, languages beyond English and Hebrew, finding a professional, expert review of content, games for children over 8, a weekly email, sharing with a teacher or therapist being free.

## Files

- `arbor-living-en.html`, `arbor-living-v3.css`, `arbor-living-v3.js`: the page.
- `arbor-living-scene-v3.js`: the Living Forms sculpture (three.js from the import map in the page). The page loads it last and on its own, so a failed download or a device without WebGL leaves the page whole with still artwork. It follows whichever `[data-stage]` element is most on screen, moves for a few seconds after the visitor scrolls or moves the pointer, then slows to rest and stops drawing.
- `arbor-one-evening.mp4`: the hero film as a 36-second video (1280 by 720, no sound), recorded frame by frame from `?film=1`. It is for sharing and is not loaded by the page.
- `vendor/`: three.js 0.170 and its licence.
- `preview.mjs`: serves this folder as `/marketing/*` over `app/public`.

Artwork and fonts already in `app/public` are used in place: `visuals/studio-v2/`, `visuals/parent/v2/`, `visuals/guides/`, `brand/`, `fonts/`.

## Known limits of this draft

- The screens are drawings, not captures. A pixel comparison with the running app has not been made, and the dock and the count tiles are approximations.
- The Claude Design kit "Arbor Design System" could not be opened from this session; the page is built on the kit in the repository (`app/DESIGN.md`, `app/src/index.css`).
- The Bebe and Gob Gob art kit is not used on the page: the two children are likenesses of real children and the names are not cleared.
- The film has no voice or music. Its screen is hidden from screen readers; the chapter list and the guide carry the same content as text.

## Before go-live

- A decision on the demo child's name shown in the screens.
- A decision on whether Kids Studio belongs on the public page yet.
- Clinical and native review of the copy: approach descriptions, the three example answers, the guide texts, the questions.
- Hebrew version; the language link still points to the current Hebrew page.
- Register `utm_campaign=landing_living_v3` in `app/public/marketing/utm-scheme.md`, or reuse the live campaign name. The app records `landing_version: "v12"` for every arrival today.
- A pass on a real phone for the sculpture's frame rate and the film.
- Remove `noindex`, then move every file except `preview.mjs` and this README into `app/public/marketing` unchanged and add each to `APPROVED_MARKETING_FILES` in the same pull request.
