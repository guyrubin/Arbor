# Arbor marketing — selected combination

**Source visual truth:** `/workspace/scratch/eaed225fc4c8/generated_images/exec-edec8171-e58c-4a6e-abcf-99d6a5fb2ffa.png`; retained at `docs/marketing-qa/v6/selected-source.webp`. This combines option 1's light design with option 2's copy, as selected by the user.

**Implementation:** https://arborparentingapp.com/marketing/arbor-marketing-landing-page-en.html and the Hebrew page; `/marketing/` serves the Hebrew entry point. Release source: `ed99f9181a231edb4eade47d278c6b2eb48abdee`.

## Evidence and normalization

Source image: 934 × 1685 pixels, generated from a desktop design brief; no authoritative CSS viewport or font metadata is embedded in it. Browser viewport: 1363 × 936 CSS pixels, devicePixelRatio 1. Initial captures are 1363 × 936 pixels; later browser screenshot output is 1348 × 926 pixels. Comparisons normalize the actual image widths to 934 pixels and exclude repeated sticky navigation from lower sections. They compare composition and hierarchy, not unsupported pixel-exact typography measurements across differing desktop widths.

State: English, light theme, signed out, default plans example; Hebrew hero additionally checked. Full-page screenshot calls timed out. Viewport screenshots cover the complete page in four regions. The full-view comparison is assembled from those region captures, and explicitly is not a single full-page browser capture.

Evidence directory: `docs/marketing-qa/v6/`.

- Initial focused comparison: `arbor-v6-hero-comparison.jpg`.
- Other region comparisons: `arbor-v6-map-comparison.jpg`, `arbor-v6-gallery-comparison.jpg`, `arbor-v6-closing-comparison.jpg`.
- Initial browser captures: `arbor-v6-live-hero.jpg`, `arbor-v6-live-map.jpg`, `arbor-v6-live-gallery.jpg`, `arbor-v6-live-closing.jpg`, `arbor-v6-live-hebrew.jpg`.
- First refinement captures: `arbor-v6-refined-hero.jpg`, `arbor-v6-refined-hebrew.jpg`.
- Final browser captures: `arbor-v6-final-hero.jpg`, `arbor-v6-final-hebrew.jpg` (both 1348 × 926 pixels).
- Final full-view composite: `arbor-v6-final-full-comparison.jpg` (1868 × 1874 pixels).
- Final focused hero comparison: `arbor-v6-final-hero-comparison.jpg`.

## Comparison history and fixes

1. **P2 — headline wrapping.** The initial live page split “fuller picture” across lines and mixed the emphasized phrase into the preceding line. Changed the emphasis to a block. The refined English capture confirms the selected three-line hierarchy and intact phrase.
2. **P2 — photo/preview overlap.** The app preview partly covered the parent's face. Repositioned the desktop photograph between the copy and preview. The refined English capture shows both faces clearly.
3. **P2 — Hebrew composition.** The photograph competed with the right-aligned headline. Mirrored the hero photograph for RTL and adjusted its placement. The refined Hebrew capture confirms separation between headline and faces.
4. **P2 — introduction contrast.** Repositioning the photograph introduced background detail under the English introduction. Measured sampled contrast against the actual text color, #526586, at 2.78–4.06:1. Added a white-to-transparent veil behind the desktop copy, with mirrored treatment in Hebrew. The final hero capture and combined comparisons confirm the fix. The same six sampled areas now measure 5.86–5.89:1 against the actual text color; the background is white throughout the introduction. Both faces remain visible.
5. **Copy correction.** Changed “1 steps” to “1 step”; corrected mixed-language Hebrew metadata and a plans sentence.
6. **Responsive source review.** Made the phone preview more compact by hiding its duplicate image and adjusting the photograph crop. Phone emulation is unavailable in the supported browser, so this is an implementation review, not a claimed mobile visual pass.

## Required fidelity surfaces

- **Fonts and typography:** The source uses an unidentified heavy geometric sans. The implementation uses the declared Inter/Arial/Helvetica stack, with Arial rendering in the test browser. It preserves bold display hierarchy, blue emphasis, tight display tracking, and readable sentence-case support text. The exact source font is not claimed. The final headline wrap was verified after correction. A closer brand font match is P3 polish, contingent on a supplied font specification.
- **Spacing and layout:** Preserves the split hero, floating app preview, central capability object with three controls on either side, three-image gallery, and two-column navy closing section. Additional example labels, context captions, legal links, and native dialog controls intentionally expand spacing. Desktop document width equals viewport width; no horizontal overflow was observed.
- **Colors and tokens:** White and pale-blue surfaces, navy copy, cobalt primary actions and selection states, navy closing section. The photograph is masked rather than replaced with drawn imagery. The final introduction contrast samples pass 4.5:1; the page retains the selected light/navy/cobalt palette.
- **Image quality:** Official multicolor Arbor mark retained. Three generated WebP assets match the selected family/play/story art direction and are shipped locally. All initial image elements loaded in the live browser. Gallery crops retain the principal subjects and legible captions. Decorative footer foliage from the mock was omitted to keep the closing message focused; it was not approximated with CSS or SVG art. Outline icons are genuine Lucide library assets.
- **Copy and content:** Selected headline, supporting promise, gallery message, and closing copy are preserved. Functional examples are clearly labeled and do not imply account writes. Hebrew copy and accessibility labels were reviewed. Pricing matches the existing app configuration; Get started opens the current app access screen.

## Behavior and accessibility checks

Passed live: all six capability selections; guidance-to-plan transition; checkbox selection and plan result; story continuation; editable memory review and confirmation; growth example; professional summary excluding unchecked items; gallery next/previous navigation through all three images; gallery-to-demo transition; pricing dialog; English/Hebrew links; Get started opens the app access screen. Gallery close restores trigger focus. Escape dismisses the plans dialog and restores focus. Arrow-key capability navigation works. Native form labels, focus outlines, image alternatives, and reduced-motion rules are present.

No application-origin console errors were observed. Browser-extension metadata errors were present and are recorded separately from application behavior.

## Release checks and residual gaps

Production build and six marketing integrity tests passed locally. The tests check that the Hebrew entry point matches its page, local assets are present, and every new WebP retains an exact binary envelope length. Full Arbor CI passed for the final source commit. The Android workflow failed during SDK setup before application compilation; this is outside the marketing implementation.

Residual gaps: physical-phone/mobile-emulation visual verification and a full-page single browser capture were unavailable. Responsive breakpoints and reduced-motion behavior were reviewed in source; they are not represented as device-tested. No account was created and no payment or personal data was submitted.

## Implementation checklist

- Selected combination implemented and production source committed.
- All required photographs, illustration, logo, and library icons included.
- Six interactive examples and gallery verified.
- First-round visual findings corrected and recaptured.
- Final introduction contrast and hosting release verified.
- Final release `ed99f9181a231edb4eade47d278c6b2eb48abdee` completed successfully in Arbor Deploy run `34962697326`.
- English page and Hebrew marketing entry both serve CSS/JS version 6.3. Final gallery reverse navigation wraps from 1 / 3 to 3 / 3; plan result correctly reads “1 step marked.” Images load, desktop overflow checks pass, and no application-origin errors were observed.
- No actionable P0/P1/P2 findings remain within the desktop comparison scope. Mobile visual verification remains the explicit gap above.

final result: passed
