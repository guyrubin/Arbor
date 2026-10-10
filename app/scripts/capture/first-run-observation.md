# First-run observation DEV capture

This extends the existing isolated `first-run-preview-only` collector from 14 to 26 states in each of four variants: EN/HE at 375×812 and 1280×800. A fresh run therefore requires 104 distinct canonical primary PNGs with exact-font evidence. It does not revise the historical c21011f run's 56 PNGs or 44 accepted cells. Historical images do not certify the observation runtime.

## Bounded state manifest

| State | Required evidence |
| --- | --- |
| about-initial | Blank real form, disabled Continue, progress and absent Close |
| about-keyboard-escape | Real Tab and Escape; no invented Close |
| about-consent-required | Two selected language buttons, each visibly checked; consent gate |
| about-unsaved-reload | Unsaved real form resets, no child created |
| worry-local-created | Exactly one real local child, exact fields and selection; then bounded narration scope |
| about-back-retained | Real Back retains the same child/form |
| worry-repeat-same-child | Repeat Continue; visible Nothing selection check |
| worry-moving-selected | Real Space selects Moving, visible check and Nothing deselection |
| neutral-card | Full neutral question, noticing CTA, checkpoint, reachable primary |
| worry-card-back | Real Back retains choice |
| neutral-checkpoint-reload | Real reload returns to full question and noticing CTA |
| hard-moment-card | Existing guide, unchanged try CTA, no acceptance |
| urgent-card | Existing urgent support and exact existing phone targets, no acceptance |
| talking-say-back-card | Full neutral question and source-pinned EN/HE say-back |
| local-completion-repeat | One observation accept, full recommendation, no outcome; repeated finish doesn't duplicate |
| explicit-preview-exit-now | Explicit removal of DEV query, accepted question in actual Now |
| browser-back-preview | Actual Back returns to forced preview without reopening completed child |
| browser-forward-now | Actual Forward returns to same accepted Now question |
| observation-blank | Full question/details, purpose, disabled blank save, one module/primary, no efficacy/receipt |
| observation-urgent-text | Existing urgent support for concerning synthetic text; no words persisted |
| observation-multiline | Real multiline entry and Tab to reachable save, full question/details, no premature receipt |
| observation-local-receipt | Real keyboard submit, resolved local-handler receipt, same exact row/question/words, no efficacy |
| observation-history-row | Open record reaches exact action row at `#/journal?view=all`, factual title, no dose/grade |
| observation-history-details | Real row opens detail dialog showing the complete original question and parent words |
| observation-details-close | Real Close restores focus to exact row; record unchanged |
| observation-completed-reload | Actual Back then reload; completed row unchanged, no reopened task or stale receipt |

A title/control must be painted, in the viewport and unobscured; new observation checks also reject overflow clipping, hidden/inert/transparent ancestors and sticky occlusion by hit testing. Scrolls use real locator scrolling only. Full text is checked in the detail sheet because the ordinary Journal row intentionally clamps its preview. No CSS, React, handler, auth or storage replacement is installed.

## Evidence limits and safeguards

- Writes are real handlers against disposable local storage. The visible receipt proves that local handler resolved and the exact local row agrees with it. It is never server or Firebase acknowledgement evidence.
- Failure/retry, pending remote writes, rapid concurrent completion, owner/selection lifetime and pending-close races remain actual form/provider unit-test evidence. No failure or delayed promise is fabricated in the browser.
- The forced `?onboarding=1` entry is DEV-only and explicitly removed by full navigation. Production empty-account entry, remote creation and automatic ProfileGate destination remain blocked. The form has no Close control; the new Close state belongs only to the actual Journal detail dialog.
- The clinical notice manifest stays closed. Hard-moment and urgent branches are read-only UI visits that reuse existing content; nothing is accepted there. Native Hebrew/product review and actual browser/OS month-language verification remain external gates. A he-IL browser context alone does not prove native Hebrew month rendering.
- The earliest same-origin complete `allHeaders()` admission, fail-closed credential rejection, exact recorded-created-child POST narration local 409 and final post-screenshot network guard are unchanged. No provider calls, authenticated requests, original-family writes, font binaries or route exceptions are added.
- The manifest is a requirement, not a rendered pass. Exact-commit CI browser results, typecheck/build and visual review are required before accepting fresh evidence. This capture work does not publish, merge or deploy.
