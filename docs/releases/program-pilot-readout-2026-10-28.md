# Program pilot read-out — B-PROG-12 (28 Oct 2026)

Branch `claude/parent-t2-2026-10-28`. This note is the dated B-PROG-12 entry for the ROS `PROGRAM.md` (the orchestrator carries it into ROS at write-back) and the record of the metric contract the read-out implements. The numbers are **pending the production read**: no production data was read to write this note.

## The PROGRAM.md entry (paste as-is)

- 2026-10-28 ~21:30Z — **B-PROG-12 pilot instrumentation BUILT (branch `claude/parent-t2-2026-10-28`): metric version `program-pilot-v1`, read-out `GET /api/admin/program-pilot` (admin only, counts and shares, never per child, demo always and internal by default excluded).** Rows: dose 4+ days by program week (week 4 = enrolment days 22–28) · parent proxy moved by week 6 against the family's own week 1 · child proxy moved by week 8 (Steady Nights: its last week, 6) against the family's own baseline · bridge (a professional share granted on or after the enrolment day) · D30 active from first access · D7 full Parent loop (a practice in enrolment days 1–7 answered at night) · paid renewal = not measured here (billing's record, BD-06 / BD-37). Every row carries `eligible`, `notYetEligible` (window not closed) and `missing` (window closed, nothing to compare); `share` is null, never 0, on an empty denominator. **Kill rule (thesis §10):** dose fails at week 4 in two cohorts with the guided tier on → the thesis is wrong and Arbor is a record-and-bridge product. **First read-out: the day Guy runs the production read (date set then); numbers pending the production read.** Seed states `prog-week1` · `prog-week5` · `prog-steady-nights` · `prog-coach` (`prog-video-consent` swapped for `prog-steady-nights`: video self-review has no surface yet, behind E4).

## Metric contract `program-pilot-v1`

The family is the unit: one row per family, its first enrolment by start day, so two enrolled children count once. Demo families (`cohort: "demo"`) are always excluded; internal families (`cohort: "internal"`) are excluded unless `?includeInternal=1`. The arithmetic is `lib/programs/measures.ts`, the same definition the program page reads.

| Row | Numerator | Denominator (eligible) | Not yet eligible | Thesis bar |
|---|---|---|---|---|
| `programDose4plus.byWeek[n]` | families with ≥ 4 practice days in program week n (a completed practice row, outcome not "not today") | families whose program week n has ended | families still inside week n or earlier | 60 % by week 4 |
| `programDose4plus.week4` | the same, week 4 (enrolment days 22–28) | families whose week 4 has ended | as above | 60 % |
| `parentProxyMoved` | families whose week-6 parent proxy (Talk Together: turns waited, the Tonight tap; Steady Nights: nights tapped "Done in order") is above their own week 1 | families whose week 6 (or last week) has ended, with both weeks readable | inside week 6 | 50 % by week 6 |
| `kidProxyMoved` (= the pack's childProxyMoved; the reader's key guard refuses "child") | families whose week-8 child proxy (Talk Together: new words written down; Steady Nights: the week's middle longest stretch) is above their own baseline (captured first-week count, else week 1) | families whose week 8 (or last week) has ended, with a baseline and a week value | inside week 8; `missing` = no baseline or no diary | a majority by week 8 |
| `bridgePacketSent` | families with a professional share granted for the enrolled child on or after the enrolment day | all families | — | 3 of 5 (the thesis bar is the receiving SLP's written statement, which the app cannot see; this row is its in-app proxy) |
| `d30Active` | families active on day 30 from first access (`lib/retention` classic D-N) | families whose day 30 has come | younger accounts; `missing` = no retention rollup | above 57 % |
| `d7FullLoop` | families with a practice in enrolment days 1–7 answered at night ("It helped" / "A little") | families whose enrolment day 7 has passed | enrolled under 7 days ago | — (BD-25: kept separate from D7 first value) |
| `paidRenewal` | not measured | — | — | an actual second charge is billing's record |

Engagement and proxy movement are neither a diagnosis nor a paid renewal. No row is shown on a parent surface.

## The kill rule (thesis §10, verbatim intent)

Dose: 60 % of pilot families practise 4+ days a week by week 4 · parent proxy moves for 50 % by week 6 · child proxy moves against baseline for a majority by week 8 (counts only; no efficacy claim until a clinical PI signs a study) · bridge: the receiving SLP says in writing that the intake was shorter or better prepared for 3 of 5 families · D30 above 57 %. **Kill:** dose fails at week 4 in two cohorts with the guided tier on → the thesis is wrong and Arbor is a record-and-bridge product.

## First read-out

- Date: the day Guy runs the production read below (written into `PROGRAM.md` then).
- Numbers: pending the production read.
- Maturity: until a cohort has passed program week 4, the dose row answers "not yet" (`share: null`, `notYetEligible` > 0); that is the correct answer, not a miss.

## Seed states (sandbox and sweep only)

`src/demo/demoPrograms.ts`, listed by `npm run seed:demo` (dry run) and rendered by the `development` sweep cells on `#/development?view=program`. The base demo family carries no enrolment.

| State | What it is |
|---|---|
| `prog-week1` | Talk Together, day 3 of week 1: two practice days with Tonight's answer and turn taps |
| `prog-week5` | Talk Together, week 5: baseline captured, counts beside the family's own first week |
| `prog-steady-nights` | Steady Nights, week 2: routine taps and diary nights (replaces the pack's `prog-video-consent`: video self-review has no surface yet, behind E4) |
| `prog-coach` | Talk Together week 1 with the guided tier's first session booked |

## Guy's steps

1. Approve the metric version `program-pilot-v1` (the contract above) for BD-25, or name what changes.
2. Run the production read once, signed in as an admin listed in `ARBOR_ADMIN_UIDS` / `ARBOR_ADMIN_EMAILS`: `GET https://arborparentingapp.com/api/admin/program-pilot` (add `?includeInternal=1` for the internal view). It reads a collection-group query over `programs` plus each enrolled child's practice rows, diary nights, word timestamps and professional shares, projected at the store (no notes, no words, no ids leave it).
3. Paste the date and the counts into the `PROGRAM.md` entry above.
