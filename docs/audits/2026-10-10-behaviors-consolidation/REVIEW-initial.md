# Independent source review: initial candidate

Reviewed SHA: `ef2355c92b956d08d699ba6c7d2cf4d09d64b50c`.
Verdict: changes required. No browser, provider, production or typecheck run.

1. P2: Journal filters/exports consumed `useTimeline`'s folded rows (`JournalTab.tsx:490–513`). `timelineFold.ts:53–59` collapsed distinct persisted log IDs with the same type, trigger and minute, despite differing response, notes, photo or status. With the old Behaviors list removed, hidden records could not be individually found, edited, deleted or exported.
2. P2: echo dismissal lived in local component state (`BehaviorsTab.tsx:36–41,175,184`) while the saved identity lived in the provider (`ArborContext.tsx:1361,1431–1435`). Dismiss or Plans, leave and return could resurrect the echo. Editing that identity into another recurring type could retarget it.
3. P2: the old morning/screen/sibling quick-fill entry had no shared-sheet replacement. A bounded category-only replacement was approved so fictional narratives and ratings would not be treated as real observations.

The reviewer found that the inspected safety/review, microphone, optional-intensity, script-rendering and localization guards generally followed the live owners instead of simply disappearing. Static coverage did not establish the missing record identities or echo lifecycle.

The corrective test fails on all three gaps at this SHA, with a passing negative control proving the story read's collision. Corrections retain raw Journal log identities without changing story folding; retire provider-owned echo identity on dismiss/Plans/relevant edits; and expose situation-only starters that preserve the parent's inputs and use normal validation/review/confirmation.

Exact-SHA CI, rendered 390px geometry, EN/HE/RTL and interaction acceptance remain separate release gates.
