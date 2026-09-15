# Arbor landing page — selected design implementation

Source visual truth: /workspace/scratch/eaed225fc4c8/generated_images/exec-edec8171-e58c-4a6e-abcf-99d6a5fb2ffa.png (light option 1 design combined with option 2 copy).
Implementation: app/public/marketing/arbor-marketing-landing-page-en.html; Hebrew version and marketing/index.html.
State: default plans example; English and Hebrew.

## Verification before deployment
- Production build passed.
- Six marketing release integrity tests passed, including exact binary WebP envelope lengths for all three new assets.
- JavaScript syntax passed.
- Local supervised preview unavailable: checkout boundary prevents resolving sibling application dependencies. Bounded recovery completed; live browser QA will follow deployment.
- Corrected Hebrew mixed-language metadata and plans sentence, translated image alternatives and navigation labels.
- Corrected checklist label flex specificity and summary line breaks.

## Remaining browser comparison
Implementation screenshot path, viewport, density normalization, full-view/focused comparison evidence, interaction results, and console checks are pending the live release. No visual fidelity pass is claimed from code or build results.

final result: blocked
Blocker: rendered implementation not yet available for comparison.

## First live comparison
Evidence: /workspace/scratch/arbor-v6-hero-comparison.jpg, /workspace/scratch/arbor-v6-live-hero.jpg, /workspace/scratch/arbor-v6-live-map.jpg, /workspace/scratch/arbor-v6-live-hebrew.jpg, /workspace/scratch/arbor-v6-live-gallery.jpg.
Source 934 × 1685 px; implementation viewport 1363 × 936 CSS px, density 1. Hero normalized to source width for a focused side-by-side comparison. Full-page browser captures timed out; viewport captures are being used per region.
- P2 headline emphasis wrapped across lines; changed emphasis to a block to preserve the selected phrase.
- P2 photograph and app preview overlap the mother's face; shifted the desktop photograph into the space between copy and preview.
- P2 Hebrew photograph competes with the headline; mirror the photograph for RTL composition.
- Fixed singular step count (1 step).
Browser interactions passed: selected plan checklist and result count; guidance-to-plan transition; story continuation; editable memory review and confirmation; growth example; selected professional summary excludes unchecked item; three-image gallery navigation and demo transition; plans modal and close; English/Hebrew language link; gallery focus returns to its trigger. All nine initial image elements loaded and 31 icons rendered. No application-origin console errors; extension metadata warnings only. Desktop document width equals viewport width.
Second visual capture is pending the refinement deployment.
