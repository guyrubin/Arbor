# Living landing page (draft, not deployed)

Version 2 of the English marketing landing page redesign. It shows what Arbor does today with real app screens, an example answer a parent can try, the seven approaches as an interactive picker, and a live 3D Living Forms sculpture that takes a different shape in four places on the page.

It lives here, outside `app/public`, so it cannot ship with a hosting deploy. `app/src/lib/marketingDeployGuard.test.ts` allows only approved files in `app/public/marketing`.

## Preview

```bash
node docs/marketing-drafts/living-landing/preview.mjs
```

Open `http://localhost:4812/marketing/arbor-living-en.html`. Add `?motion=off` for the still render.

## What is on the page

| Section | Content |
|---|---|
| Hero | Promise, trial button, a phone that turns through three app screens (Talk with Arbor, bedtime story, weekly report) twice and then rests |
| Try it | Three example moments; the question types itself, then the answer builds: one step, words to try, why it fits |
| What is inside | Twelve capabilities, each with its app screen and a ring on the part described. A list that plays through once on wide screens, a swipe row on phones |
| Seven approaches | Seven buttons tied to seven pebbles in the sculpture; the ones used in the chosen example are marked |
| Kids Studio | Artwork from three of the eight games, the counts, the four worlds and the eight game names, and how a parent opens and leaves it |
| Control | What is remembered and shared, the privacy facts, a small summary builder |
| Plans | Trial and Arbor Plus, in the wording and prices of the live page, with a trial button on both cards |
| Questions, start | Six questions, three steps, the last trial button |

## Facts the copy depends on

Each was checked against the repository on 15 Nov 2026. Recheck before go-live.

| Claim | Source |
|---|---|
| 130 milestones, eight areas, 2 months to 5 years | `app/src/lib/milestoneData.ts` (last rows are 60 months) |
| Eight games for ages 3 to 8; a child sees the ones for their age | `app/src/components/kidmode/kidWorlds.ts` (Sequence Quest starts at 48 months) |
| Leaving Kids Studio: three-second hold, then a sum or the parent's own PIN | `app/src/components/kidmode/parentGate.ts` (a friction barrier, not a security boundary: never call it a lock) |
| School brief: free draft from the profile, AI draft with Plus. Care summary has no AI draft | the critic's read of the two screens and their gates |
| A plan built for the family is in the trial and Plus | the critic's read of the plan gate |
| The trial link carries a `moment` only after a pick | `arbor-living-v2.js`; the app reads it in `app/src/lib/trialEntry.ts` |

## Files

- `arbor-living-en.html`, `arbor-living-v2.css`, `arbor-living-v2.js`: the page.
- `arbor-living-scene-v2.js`: the sculpture (three.js from the import map in the page). The page loads it last and on its own, so a failed download or a device without WebGL leaves the page whole with still artwork. It follows whichever `[data-stage]` element is most on screen and stops drawing when none is.
- `shots/*.webp`: twelve app screens. They come from the Arbor capture workflow (375 by 812, synthetic demo family) and are enlarged to 750 pixels wide. The page shows a window of each screen: `--y` sets where the window starts, `--h` how many capture pixels it shows (590 unless stated; phones cap it at 450, or at `--cap`), and `--sx --sy --sw --sh` place the ring, all in capture pixels.
- `preview.mjs`: serves this folder as `/marketing/*` over `app/public`.

Artwork and fonts already in `app/public` are used in place: `visuals/parent/v2/`, `visuals/studio-v2/adventures/`, `brand/`, `fonts/`.

## Known limits of this draft

- The app screens are day-one states of the demo family. No screen shows a finished Arbor answer, the Now screen says "No question chosen", and the weekly report holds one moment and one step. Several windows are cropped to hide empty, signed-out or clinical-sounding demo text (weekly report, action plans, care summary, school brief, sharing).
- There is no real Kids Studio screen, only game artwork.
- The screens are single-density captures enlarged; they are soft on high-density displays.

## Before go-live

- Fresh app screens at double density from a fuller demo family: a finished answer in Talk, a chosen question on Now, a week with several moments, a signed-in sharing screen, the Kids Studio home. Then widen the cropped windows again.
- A decision on the demo child's name shown in the screens.
- Clinical and native review of the new copy: approach descriptions, the three example answers, the capability texts, the questions.
- Hebrew version; the language link still points to the current Hebrew page.
- A decision on whether Kids Studio belongs on the public page yet.
- Register `utm_campaign=landing_living_v2` in `app/public/marketing/utm-scheme.md`, or reuse the live campaign name. The app records `landing_version: "v12"` for every arrival today.
- A pass on a real phone for the sculpture's frame rate and the swipe row.
- Remove `noindex`, then move every file except `preview.mjs` and this README into `app/public/marketing` unchanged and add each to `APPROVED_MARKETING_FILES` in the same pull request.
