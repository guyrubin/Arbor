# Current portrait → care destination evidence

This harness-only diagnostic is based on local `737dc55cd686dd563dfaa6bc55f3b368d7e57356`
(reviewed remote source `d730c36eec6d7f1170aa6b9bf32b3e5af7ec1276`). Its app/src
identity remains `363487af1a943a00838f13cc8102e1712a3ad000`. It adds no app/runtime
changes and no fonts, provider access, deployment or production publication.

The existing branch-specific release workflow maps `codex/portrait-care-capture`
to `portrait-care-only`: exactly four shards, five states each, no base or other
interaction groups. The accepted Parent/Kept/Kids matrix remains 1,046 cells.
Only the owner may publish/run the diagnostic branch. Existing network-none,
mock/local, synthetic family, disposable source-font preparation and exact-PNG
receipts apply unchanged.

## Twenty required cells

In 375×812 and 1280×800, EN and HE:

1. Load My child (`development`), settle the actual portrait, scroll normally to
   its current `.portrait-care button`, require full ancestor opacity, nonzero
   geometry and five-point unoccluded hit-testing, then retain that viewport.
2. Click that real CTA. A passive listener records its trusted click while the
   current route is still `development`. Require `#/care-team`, retired outgoing
   portrait, one actual current route and TrustedSharing body, native animation
   settlement, heading visibly in the main scrollport and scrollTop zero. Retain
   the untouched first-fold image before capture scrolling.
3. On that same reached care destination, scroll normally to the actual
   `share-week-confirm` primary, require `open-care-roster`, opaque ancestors,
   full geometry/clipping and five-point hit-testing. Capture the scrolled state.
   Do not click or fill the sharing control.
4. Click the genuine `secondary-place-back` control. Require a trusted click on
   care-team, its outgoing body retired and the current portrait visibly returned
   at the top. Record actual active-element facts without assigning focus.
5. Load `#/sharing` independently as a clearly labeled diagnostic control. Require
   its actual TrustedSharing body and `grant-share` identity, then retain the
   untouched first fold. This cannot satisfy care-team navigation evidence.

## Fail closed and retained diagnosis

The existing `waitConfirmedFrame` observes the chosen body and every ancestor,
including nested TrustedSharing Motion wrappers, without altering them. It has
an unchanged eight-second deadline and retains before/final geometry, opacity,
transform, animation clocks, running-animation and sanitized asset/runtime facts.
The synthetic business Date uses the existing Date-only fixture at the demo seed
epoch; performance, timers, requestAnimationFrame and document timeline remain
native and are verified by that helper.

For this group only, the existing exact-font renderer receives
`animations: 'allow'`. A screenshot therefore cannot finish or cancel a stuck
animation. A failed assertion/readiness wait retains its actual diagnostic pixels
and remains incomplete; no longer timeout, opacity repair, forced route rewrite,
synthetic app callback, import retry or success response is introduced. The direct
sharing control still runs after a failed actual care attempt, so comparison is
available without concealing the failure. After successful screenshots, current
route identity is sampled again.

The Parent shell intrinsically invokes `ensureBookNarration` on mount. Exactly
`POST /api/children/<current synthetic child id>/book-narration` therefore uses
the reviewed Kids local 409 `synthetic_capture_media_disabled` refusal, counted
separately as `portraitCareNarrationRefusals`. It never continues to the server
or pretends generation succeeded. Other child IDs, methods, subpaths and mutations
remain denied. The only continued POSTs are the established local read seams
(`todays-focus` and `digest`). Attempted mutations fail evidence. Aggregation also
requires the final retained `deniedActions` and `deniedExternal` counters to be
zero, so a post-assertion request cannot preserve a green verdict.
No recipient is entered, sharing grant made, export requested, email sent or care
provider contacted. Raw text, form values, data payloads and exception messages
are excluded from the added observer.

## Limits and verification

- This covers the real in-app My child Back control, not browser-history Back.
- Shell currently does not restore focus to the route opener. The capture records
  whether focus is connected and outside hidden/inert content. It makes no claim
  that the care CTA regains focus and never moves focus to manufacture one.
- Offline contract verification: `capturePortraitCare.test.ts` 12/12 and
  `captureRelease.test.ts` 17/17, installed binary, one file/process,
  `--maxWorkers=1`, offline network guard. The new tests reject missing variants,
  stale identity, missing pixels/font proof, missing named assertions, substituted
  sharing route, untrusted clicks, opaque/animating/zero-size/occluded controls,
  mutated screenshots and attempted API mutations. They verify failed diagnostic
  retention and the unchanged bounded settlement helper.
- No local tsc, build, server or browser was run. Rendered success and visual
  acceptance remain pending the owner’s exact-source CI run and independent PNG
  review. A green unit contract cannot prove the destination visibly works.
