# Kids Studio V2 — Studio Sky visual correction

Status: review branch; production merge remains Guy-gated.

## Reference and diagnosis

The user identified `Arbor Kids Studio v2.zip` as the reference. Its SHA-256 is
`276379bc46137dc3f0d836a9072f9c610ab40a5a6df777e746334e1d3f8b3643`.
The archive's handoff selects `Kids Studio Sky.dc.html` (1180 × 820) and its
portrait variant (820 × 1180). Earlier comic variants are not the target.

Production was verified at `fa3f994715e2dba1ef782480c13863dfab0597cf`, the
deployed V2 release. This was a visual implementation gap, not a stale deploy.
The four-door layout survived, but the authored sky became an unrelated cloud
image, the large portrait became a small standing figure, and the world screen
lost its atmospheric background. Game thumbnails were identical within a world.

## Changes

- Restore the source sky gradient, aurora, stars, light rays and foreground glow.
- Restore the large masked portrait, translucent doors, source weights and gold
  controls. Load Nunito/Heebo 900 instead of relying on synthesized weight.
- Composite the current approved portrait over neutral portal scenes. Keep the
  existing identity resolver; never use a raw photo or the export's fixed child.
- Restore the world environment and card depth; add a distinct icon for each
  activity. Keep the real books, age eligibility, progress and game routes.
- Connect quest steps using stored completion only. Keep optional, unpressured
  play; the export's fabricated stars, ranks and locks remain excluded.
- Override the parent shell's white `aside` style inside the keepsake panel and
  make the hold-to-exit caption readable on the dark Studio background.

## Verification

- Focused local tests, one file at a time with one worker: portrait identity
  **3/3**, keepsakes **4/4**, real game integration **25/25**.
- Browser: landscape home at 1180 × 820; tablet portrait at 820 × 1180;
  phone at 390 × 844 including the lower doors and quest. No horizontal overflow.
- Hebrew landscape: mirrored navigation, quest and text with no overflow.
- Real local flow: home → Playbank → Memory Match introduction → active game →
  reveal a card → return to world → home. Hold exit opens the adult challenge;
  correct answer returns to the parent area. Language changed through Settings.
- React review: stable keys, module-level icon mapping, decorative images hidden
  from assistive technology, current-profile resolution, no extra model calls.
- Cloud CI is the type/build gate; see the branch/PR checks for the exact final
  SHA. Local TypeScript compilation is intentionally not run under the machine
  resource rule.
- The first cloud run passed types and 15,268 tests; its one failure identified
  the capture tool's pinned font URL. Update that exact URL for the intentional
  Nunito/Heebo 900 weights, preserving the host/resource restrictions. The focused
  URL contract passes locally. The wider font suite has an existing Linux-style
  `/tmp` expectation that fails on Windows; final Linux CI remains authoritative.

Screenshots and the source archive stay outside Git. Local evidence is under
the ROS `.workspace/arbor-kids-v2-parity-2026-10-14/` directory. The preview uses
invented demo records and, locally only, the supplied illustrated reference
portrait to compare scale. It does not write a real family profile or call AI.

## Remaining design differences and release decision

The export uses a different illustrated child pose for each world and game.
This patch uses the active child's approved portrait with neutral scenery and
activity icons; it does **not** reproduce those bespoke poses or promise pixel
identity for every child's portrait. Phone layout is a responsive adaptation;
the source specifies tablet compositions. Device playback and physical-device
QA are not claimed by these browser checks.

Next action: review the corrected composition, then Guy decides whether to merge
the green branch. No production merge, deploy or family-data migration is part
of this correction branch.
