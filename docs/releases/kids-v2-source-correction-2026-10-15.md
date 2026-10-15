# Kids Studio V2 — original handoff correction

The owner reported that the game preview did not resemble Kids Mode V2. Inspection of the original `Arbor Kids Studio v2.zip` confirmed that the earlier preview substituted a generic three-card gallery for the actual composition and applied dark glass to play stages that should be cream.

## Source and implementation

Source: `HANDOFF.md` names `Kids Studio Sky.dc.html` as the final 1180×820 landscape composition; `Kids Studio Sky Portrait.dc.html` is the same component at 820×1180. Earlier Comic World explorations are not the target. `docs/final-home.png` and `docs/final-world.png` were inspected directly.

- Restore the six-stop authored sky, aurora, rays, horizon, glass door perspective and world-color glows. Adapt the related atmosphere work from draft PR #138 without merging that PR.
- Restore the connected four-step quest dock. Place the three new games in the existing world activity lists.
- Preserve current matching approved hero sheets. Composite the canonical approved portrait over neutral door/world/game artwork; no export-specific child image is committed.
- Match #f7b91d gold, #1a2b4a ink, #fbf8f1 cream, V2 radii and Nunito/Heebo 900. Load the actual 900 font weight.
- Restore Sprout's white prompt bubbles and cream play surfaces while keeping Canal Quest, Story Theater and Sound Orbit visually distinct.
- Use the actual production UI in the private preview. Track a reproducible Vite entry under `app/scripts/studio-v2-preview/` so future previews cannot silently drift into a separate design.

## Boundaries

The synthetic preview deliberately has no real child avatar, so it exercises the production Sprout fallback. Real profiles use their approved identity. Books from a real family are not embedded. Preview creations and quest progress stay in a dedicated device-local namespace. No real account, cloud writes or analytics are connected.

The handoff's sample currency, level ranks and locked games are not fabricated. Existing eligibility, stored creation identifiers, session mechanics, completion semantics and parent gate remain in place.

## Checks

- Focused V2, approved-avatar and hero-identity suite: 15 files, 132 tests passed (including the parent hold gate).
- Application TypeScript check and Vite production build passed; existing bundle-size notices remain.
- The private preview uses a normal Vite build with external JS/CSS assets.
- Browser interaction, responsive painting on devices and physical audio remain unverified in this environment; the supported browser preview capability is unavailable. The version-6 native publication screenshot was inspected and confirms the sunset sky, four-door composition, central Sprout fallback and V2 typography. A low-contrast no-avatar caption found in that render was corrected with a navy label surface. It does not verify subsequent gameplay or responsive views.

The Arbor production release remains unchanged. This work updates draft PR #141 and the existing owner-private review Site only.
