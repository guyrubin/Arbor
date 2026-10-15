# Arbor Kids — distinct original worlds, Studio V2

The owner rejected three similar woodland environments and asked for inspiration from leading children's worlds without copying their protected creative expression. The follow-up explicitly requires the new design system. This revision keeps the existing game loops and approved profile identity, while changing the games' visible world identities.

## Design-system authority — corrected after owner review

The original **Arbor Kids Studio v2.zip** is authoritative, specifically `HANDOFF.md`, `Kids Studio Sky.dc.html`, and `docs/final-home.png` / `docs/final-world.png`. The earlier version of this document incorrectly treated the already-shipped shell as the authority without checking the original export.

The handoff specifies an authored sunset sky, four glass doors around the large approved child avatar, a connected quest dock, deep world backdrops, a glass intro card and a **cream play stage** with navy text and Sprout's white prompt bubble. Nunito/Heebo display text uses weight 900; gold is #f7b91d, ink #1a2b4a, and cream #fbf8f1. Shared tokens now reflect those actual source values.

The custom three-card private-preview landing page and replacement featured-game dock were deviations. Both are removed. The preview now imports the actual StudioHome, StudioWorld, StudioGame, StudioQuest and StudioCollection components, with synthetic account/profile adapters. The three games live inside their appropriate V2 worlds.

The handoff's atmosphere CSS from draft PR #138 is adapted here; that PR remains unmerged. No fixed child's export imagery, fabricated ranks or simulated currency are imported. Current matching approved hero sheets continue to drive the central/player figure, with the canonical profile portrait as fallback and Sprout when absent. Portal and intro portraits use that same canonical resolver.

## Three visual identities

| Visible game | Environment / composition | Material / palette | In-game expression |
| --- | --- | --- | --- |
| Canal Quest / מסע בתעלות | Elevated architectural waterways, locks, water wheels and bridges; central water basin | Rounded ceramic and wood; terracotta, turquoise, warm saffron | Ceramic channel board, brass-colored route and cargo, canonical hero aboard the moving boat |
| Story Theater / תיאטרון הסיפורים | Front-facing intimate stage, curtains and paper arches | Cardstock, cork and stitched felt; ochre, plum, peach | Story-specific stage prop, two friends on stage, tactile speech card, caring-response choices |
| Sound Orbit / מסלול הצלילים | Floating circular sound stage, acoustic arches and distant planets | Matte ceramic and translucent acrylic; Studio navy, mint, coral and lavender | Three illuminated instrument pods, distinct star/drop/triangle symbols, visual sequence and saved composition |

Each world is distinguishable by silhouette, composition and material before reading its title. UI action colors retain the same meaning across worlds. World scenery never paints in a child, mascot or substitute identity. All names are working product names; no legal clearance or trademark availability claim is made.

The internal IDs `river-rescue`, `feelings-forest` and `rhythm-garden` are intentionally stable for routes, eligibility, history and stored creations. The public-facing titles and instructions are updated consistently in EN/HE. Saved note IDs and audio pitches are unchanged; the third note's visible symbol is now a triangle in both the game and saved creation.

## Reference principles and separation

Sources checked 15 October 2026:

- PAW Patrol / Spin Master: https://www.spinmaster.com/en-us/brands/paw-patrol/paw-patrol-marshall-and-farmer-al-figure-pack-with-sheep-toy-figure-kids-toys-for-boys-and-girls-ages-3-and-up/ — missions and imaginative cooperative play. Our design interpretation: give the child a clear role and a visible, achievable task.
- Bluey official: https://www.bluey.tv/media-hub/bluey-highlights/ — current reach and co-viewing. This is a brand reference for accessible shared play, not evidence that a particular interface causes engagement.
- DreamWorks: https://www.dreamworks.com/gabbys-dollhouse — distinct miniature activity worlds, flexible thinking and learning through mistakes. Our interpretation: different activities deserve genuinely distinct worlds and room to experiment.

No franchise image, screenshot, character, costume, vehicle, logo, badge, catchphrase, model, music or branded architecture is imported or used as a generation reference. Prompts describe original compositions directly and exclude recognizable franchise details. There is no rescue squad, uniform system, lookout headquarters, paw/shield motif, dog cast or cat-shaped dollhouse. The approved Arbor avatar and Sprout remain the cast.

## Asset production

Built-in ImageGen produced three independent 1536×1024 environment plates. Outputs were inspected, then encoded as WebP with 480px derivatives. The old three similar scenery plates are removed from the shipped asset set.

- `app/public/visuals/studio-v2/adventures/canal-world.webp` (+ `-480.webp`): original miniature water-engineering world, sculptural terracotta/saffron canal locks, turquoise central basin, rounded ceramic arches, off-center water wheels and workshops, elevated architectural camera, no characters/text/UI or rescue motifs.
- `app/public/visuals/studio-v2/adventures/story-theater.webp` (+ `-480.webp`): original straight-on handcrafted theater in cardstock/cork/felt/wood, ochre side curtains and plum/peach arches, central empty cream stage, soft light, no characters/text/UI or dollhouse/cat motifs.
- `app/public/visuals/studio-v2/adventures/sound-orbit.webp` (+ `-480.webp`): original cosmic sound playground with a circular indigo stage, ceramic/acrylic acoustic arches, sparse distant planets, empty central performance space, navy/mint/coral/lavender, no characters/spacecraft/text/UI or landscape elements.

No new runtime generation, AI calls, dependencies or collection data are introduced. Scene files resolve through the central `kidThemeManifest` for both supported child themes. Full-size optimized files are 112–159 KB each, below the existing 400 KiB gate.

## Verification scope

Focused gameplay, identity, collection, localization, icon and art tests, TypeScript and production build are checked after integration; final receipts are recorded in PR #141. The private synthetic preview is updated from the same source. Its platform-provided homepage screenshot can verify initial rendering and world differentiation. Authenticated interactive mobile/desktop playthrough, physical audio and real family persistence remain separate acceptance gates; the earlier login approval block has not been bypassed.
