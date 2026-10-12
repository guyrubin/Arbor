# Guide illustrations (VIS-05)

Twelve wide pictures for the guide card on Now, one per guide topic: mornings, drop-off, big feelings, sharing, bedtime, screens, meals, tidy-up, siblings, new words, outdoor play and calm corner. The registry, the alt text in English and Hebrew, and the topic lookup live in `src/lib/guideArt.ts`.

**Status:** no picture is made yet. Making them needs image-model spend or a commission, which is Guy's call. Until a topic ships, `guideArtFor` returns nothing for it and the card keeps its own shapes and medallion; there is never a broken image.

## Style

- A still life of everyday household objects, in the style of `public/visuals/companion/together-table.webp`: hand-painted gouache and watercolour with soft pencil contours, refined magazine art for adults, painterly shadows and a light paper grain.
- Warm daylight. The app palette: warm ivory, navy, sapphire, muted sage and a restrained yellow.
- Calm and uncluttered: a few real-scale objects, generous space, nothing busy.

## Never in a picture

- People, faces, hands, or any body part.
- Animals or toys with faces (no teddy bears, no dolls, no emoji cards).
- Letters, numbers, words, logos, signs, or a screen showing anything.
- Anything taken from a family photo or the hero avatar. Prompts are text only; a style reference may only be the app's own shipped art.

A picture is decoration and context, never evidence: nothing in it may read as a particular family's moment or as a statement about a child.

## Composition

- 16:9. The objects sit in the inline-end 55% of the frame (the right side as drawn).
- The inline-start 45% (the left side as drawn) stays calm and low in detail: plain wall, tabletop or floor, so the card's title reads cleanly over it.
- In Hebrew the app mirrors the picture with CSS (`transform: scaleX(-1)`), so the calm area moves to the right. Nothing in a picture may be directional or handed: no text, no clock faces, no arrows, no single-handed objects that would look wrong mirrored.

## Files

- Two WebP files per topic: `<topic>-960.webp` (960×540) and `<topic>-480.webp` (480×270), each at most 120 KB. Tune the quality until both fit.
- Topic names are exactly those in `GUIDE_TOPICS` (`src/lib/guideArt.ts`).
- Nothing else goes in this folder.

## Shipping a topic

In one commit:

1. Add the two files here.
2. Fill the topic's record in `docs/design/guide-art-v1.json` (at the repo root): `status` "shipped", `outputs`, `model`, `date`, `reviewer`, and the final `prompt`.
3. Add the topic to `GUIDE_ART_SHIPPED` in `src/lib/guideArt.ts`.

`src/lib/guideArt.guard.test.ts` checks that the three agree, and that each file is a WebP of the right size, 16:9 and at most 120 KB.

Each picture is reviewed by eye before it ships: no person, face, hand or text anywhere. To change a picture, regenerate it from its recorded prompt and update the record; never hand-edit the exported files.
