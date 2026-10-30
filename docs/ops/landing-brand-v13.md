# Landing page: approved brand and full product positioning

The October 30 user review rejected v12: the old artwork and still-image camera
move did not implement the approved marketing direction, and shipped sections
did not demonstrate conversion value. This revision uses the October 26
`Arbor_Collaboration_Brief_EN_v3.pdf` as the visual source and the bilingual
brief's complete positioning as the messaging source.

## Positioning

Arbor combines child-development knowledge, AI and parent-controlled family
context. Parenting Companion, Growth and Kids Studio each have value in their
own right. Continuity is a product mechanism, not the complete positioning.
The opening names all three experiences before explaining how they connect.
No new expert endorsement, clinical outcome or conversion uplift is claimed.

## Visible change

- Large sans-serif hierarchy, navy/teal type, warm neutral canvas and the brief's
  actual sculptural parent/child artwork replace the old serif/photo opening.
- Three distinct experience entries use the exact 3D illustrations in page 3
  of the brief. Each links to the corresponding working product example.
- The old family-photo gallery is removed from these EN/HE pages. Existing
  application story artwork remains where the actual story library is shown.
- A 14-second illustrated walkthrough links a parenting question, something to
  try together, and a parent-reviewed observation. This is an illustrative
  product example, not recorded app usage or live-action footage. Its three
  chapter controls work independently of autoplay.
- Trial/signup behavior, price review and parent-control examples are retained.

## Asset provenance

`app/public/visuals/marketing/brief-v3/` contains images extracted unchanged from
the approved PDF: `arbor-3d.png` (page 1),
`parenting-3d.png`, `growth-3d.png` and `studio-3d.png` (page 3). No new generated image, replacement logo or third-party stock image is used.

`arbor-in-action.mp4` uses the three experience illustrations in parenting,
studio, growth order, with crossfades. Captions and controls are live localized
HTML, not baked-in text. H.264 Main / yuv420p, 900 × 900, 24 fps, 14 seconds,
233,965 bytes, no audio, fast-start metadata. The browser QA caught an initial
4:4:4 intermediate that stalled; the shipped asset is the 4:2:0 encode.

The old v12 video is no longer referenced by EN/HE. It remains in the repository
to avoid breaking a cached older page. The current media starts when visible,
does not wait on unrelated window-load resources, pauses offscreen/hidden, and
honors reduced-motion/data-saving preferences. It plays once and offers replay.
Manual Play remains available when browser autoplay is denied. A media failure
leaves the manual text chapters usable and displays a truthful fallback notice.

## Scope and verification

No app dependency, AI prompt, billing, consent, analytics collection, API or
database change. New stylesheet is explicitly authorized by the user's brand
repair and shipping request. EN and HE/root are changed together; other
marketing locales retain their existing presentation.

Local full suite: 17,888 tests passed. Typecheck, framework/floors, safety and
offline acceptance passed. The final targeted marketing/trial guards passed.
The full build uses `node --import tsx` for the two TS build scripts in this
runtime because the tsx CLI cannot open its local IPC socket.

Desktop visual QA confirmed the new hierarchy and artwork. Further local cloud
preview interaction was blocked by its URL policy; do not describe an unobserved
mobile render or corrected media playback as verified. CI/capture and production
verification are recorded separately in the release/goal record.

The five-milestone/50-iteration goal remains a delivery and evidence goal, not a
daily schedule. Earlier implementation is not proof of design acceptance or
conversion lift. Reopen the affected milestone quality criteria after the user
review and keep measurement open until real baseline/denominator data exists.
