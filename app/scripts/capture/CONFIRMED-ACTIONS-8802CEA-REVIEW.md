# First confirmed-action capture: retained failure analysis

Source: `8802cea607ef70a77a5f7978153073fa0ccada92`, tree
`1db7bf818a9252893b3aba1503c3dac5d513ac0f`, run `38024115088`.
All four exact-font EN/HE mobile/desktop shards finished. 130/196 cells passed; all
196 app PNGs were retained. None of the four shards passed its complete contract.
These failed artifacts are retained; corrected captures must not be substituted for them.

## Root-cause grouping

| Group | Failed cells | Evidence and disposition |
|---|---:|---|
| Retired Routines route | 36 | All nine routine states per shard show Plans instead of a routine board. `routes.ts` deliberately redirects `routines` to `plans` (B-GROWTH-25). This was a harness/product-target mismatch. Retarget the nine states to the existing Plans disclosure and `RoutinesCard`, with its registered `routines` records; preserve the redirect. Runtime feedback correction is owned separately. |
| Family Receipt link scope | 16 | The saved-receipt PNG visibly contains Open. `Receipt.tsx` places that anchor beside the `<p data-testid="ritual-receipt-…">`, inside `data-receipt-row`, not inside the text node. Twelve receipt assertions and four destination clicks used the wrong descendant scope. Fix the selector; keep actual clicking and destination checks. |
| Blank child transitions | 12 | Four Milestones child-return, four failed Family child-retirement and four saved Family child-return cells time out before replacement-frame assertions. Pixels show Mira selected and tabs present with an empty route body. Exact runtime vs harness-interaction cause is not established by the retained artifacts. Add passive transition diagnostics; never accept a blank frame. Four cells overlap the Family receipt group above. |
| Hebrew Yes target | 2 | Mobile and desktop HE record actual 36×44 geometry, visible and hittable. Pixels show the small Yes control. This is a genuine width defect; retain the 44px requirement and fix the app separately. |
| Modal Save measurement | 1 | Desktop EN observed 298.84×42.97 while the other three matched 44px height. The source Save minimum is 44px and its parent Modal enters with scale 0.95→1. Pixels after capture show the full-size modal. This is consistent with premature geometry sampling; require settled real ancestor transforms, then measure without tolerance relaxation. |
| Visit arrival | 3 | Desktop EN body is blank below Consult tabs. Mobile EN/HE pixels show the right saved Speech appointment and audience despite the timeout. No assertion was reached, so the old generic timeout does not identify the exact failed await. Preserve the evidence; add action-stage and before/after/last destination observations. No longer timeout is justified by this evidence. |

The union is 36 + 16 + 12 − 4 + 2 + 1 + 3 = 66 failed cells.

## Pixel anchors inspected

Artifact root: `arbor-ui-capture-artifacts/8802cea/`, with each cell under its
`{mobile|desktop}-{en|he}-confirmed-actions-0/shots/` directory.

- Mobile HE: `sayback-yes-failure`, `routine-partial`, `ritual-start-local-saved`,
  `milestone-child-return`, `visit-target-arrival`.
- Desktop EN: `milestone-editor-cancel`, `ritual-failed-child-retirement`,
  `visit-target-arrival`.
- The independent pixel review additionally inspected 58 current PNGs, confirmed the
  route/receipt/blank-frame findings, and identified a separate enabled Send contrast
  defect. That runtime style correction belongs to its own lane.

## Correction boundary

Only the confirmed capture modules, their source contracts and evidence documentation
are changed here. Family Open uses the real receipt row. Actual frame observations wait
for settled opacity/transforms/animations and retain diagnostic data on failure; they
never alter those properties. The old 8s readiness budget and 44×44 geometry floor stay.

Nine routine cells now target the real Plans routine loop with two synthetic records.
A local persistence fault is scoped to one exact registered `routines` child key, armed
after hydration and restored in `finally`. It does not stand for Firestore failure.
Pending, remote acknowledgement, provider behaviour and arbitrary live data remain
outside this synthetic capture's evidence.

Corrected contracts passed 62/62 on integrated base `a1cc586`, five separate serial
processes with installed dependencies, one worker, offline preload and mock provider.
JavaScript syntax and diff checks passed. Exact-final-source rendered evidence is still
required; these source checks do not resolve the blank-transition runtime cause.

The rapid-flow amendment deliberately retains the original fresh-Now Prepare sequence
and close-editor→child-switch timing, while adding a trusted Family A→B→A interruption
before B's body settles. It starts with a fresh saved receipt and requires its retirement
on return. The 196-cell count is unchanged. Affected contracts: 17 confirmed-action +
10 release tests passed; no additional rendered outcome is claimed.
