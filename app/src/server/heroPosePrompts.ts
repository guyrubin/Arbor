/**
 * B-GAME-13b — the pose prompts. The blocks are the ones that produced the
 * eight approved proof poses (execution/2026-10-06--kids-games/art/poses/
 * build_pose_jobs.py + manifest.jsonl, the picks of pick.json), generalised
 * from one child to any family's hero:
 *  - the reference is the child's STORED generated hero (image 2) and, after
 *    the anchor, the approved idle (image 1) — never a named child, never a
 *    photo;
 *  - the proof's HERO block described one child's face and suit; here the
 *    identity comes from the reference images only (no descriptors);
 *  - he/his -> the hero / their.
 * Fixed template text: no name, no free text, nothing from the request body
 * but the pose id. SPRITE_STYLE, STAGE's background and TAIL are verbatim.
 * Prompt order (as in the proof): SPRITE_STYLE REFS HERO STAGE POSE TAIL.
 */
import type { HeroSheetPoseId } from "../lib/heroSheetContract.js";

/** Verbatim but for the proof hero's own garments (suit, boots, cape -> the
 *  hero's clothes and shoes): a family's hero must not be handed a cape. */
export const SPRITE_STYLE = "Glossy stylised 3D character render at premium animated-feature-film quality: soft rounded sculpted "
  + "volumes; hair sculpted in glossy clumps, never strand-level; large expressive eyes with one clean "
  + "catch-light; skin with a gentle warm subsurface glow and no pores; semi-gloss materials on the clothes and "
  + "shoes; matte cloth with a soft fuzz; rich, warm, clean colour, never neon.";

export const TAIL = "Absolutely no text anywhere: no letters, words, numbers, writing on signs, labels, logos, watermarks, signatures, "
  + "captions, speech bubbles or interface elements. Stylised cartoon characters only: not photorealistic, no "
  + "realistic skin texture, not the likeness of any real person or celebrity, no resemblance to any existing film or "
  + "franchise character. Correct anatomy: five fingers on each hand, no extra or merged limbs. No weapons, no blood, "
  + "no scary faces, no menacing shadows. No sparkle trails, glitter, floating orbs, light beams everywhere or lens "
  + "flares; no screens or phones; no coins, trophies or reward stars. No border or frame.";

/** Generalised: the identity is the reference's, not a description. */
export const HERO = "THE HERO: the original stylised cartoon child hero shown in the reference, about 3.5 heads tall, head as "
  + "wide as the shoulders. FACE, eyes, eyebrows, skin tone and HAIR exactly as in the reference. OUTFIT: exactly the "
  + "reference's clothing, colours and accessories; where the reference shows only the head and shoulders, continue "
  + "the same outfit naturally down to a full body with matching shoes, inventing nothing that changes who the hero "
  + "is. A stylised cartoon character, never photoreal.";

export const BACKGROUND = "Background: one perfectly flat, uniform, saturated chroma-key green (#00B140) from edge to edge — no "
  + "gradient, no vignette, no floor, no horizon, no ground line, no contact shadow, no cast shadow, no "
  + "reflection, no props. No glow, no halo, no rim light spilling onto the background: the edge of the "
  + "figure meets the flat green directly. Light: soft warm-white studio key from the upper left, gentle "
  + "cool fill from the right. The green casts NO green light on the character: no green tint on skin, "
  + "hair, clothes or shoes.";

export const CAMERA = "Camera: CAMERA-FACING front view at the hero's chest height — the hero faces the viewer, the body turned at "
  + "most a slight three-quarter, the face clearly visible, large and lit; 50 mm lens, no perspective distortion.";

export const STAGE = "THE PICTURE: a character sprite on a flat chroma-key background. Exactly one child, the hero, alone: no "
  + "bunny, no companion, no second child, no reflection, nothing in the hands. FULL BODY head to toe, nothing "
  + "cropped: the whole hair, the whole outfit, both hands with all fingers and both feet inside the frame, with "
  + "at least 10 percent empty green background on EVERY side (above the hair or fingertips, below the feet, "
  + "left and right). " + CAMERA + " The hero fills about 75 percent of the image height. " + BACKGROUND;

/** The anchor (idle): image 1 = the stored hero. */
export const REFS_ANCHOR = "Image 1 is THE HERO — this is exactly who the hero is: copy the face shape, eyes, eyebrows, nose, skin "
  + "tone, hair, clothing, colours and accessories exactly, in the stylised 3D finish described. Ignore its framing, its "
  + "background, its lighting and any drawing style that differs from the finish described. Paint a NEW picture.";

/** Every other pose: image 1 = the approved idle, image 2 = the stored hero. */
export const REFS_POSE = "Image 1 is THE HERO exactly as the hero must look in every picture: the same face, the same hair, the "
  + "same skin, the same clothing with all its colours and details, the same shoes, the same proportions (the head the "
  + "same size relative to the body), the same render and the same light. Image 2 is the same hero's original portrait: "
  + "use it to keep the face, eyes, brows and hair exactly right; ignore its framing and background. Paint the hero "
  + "again, full body, in a NEW pose; change nothing about who the hero is or how the hero is lit.";

/** The approved proof poses (pick.json), generalised. Body mechanics, not move names. */
export const POSES: Readonly<Record<HeroSheetPoseId, string>> = {
  idle: "POSE: standing relaxed and steady, facing the viewer, weight evenly on both feet, feet about hip-width "
    + "apart with both feet flat on the ground, legs straight, arms hanging loosely a hand's width away from "
    + "the body so both hands are clearly separate from the torso, fingers relaxed, head level, looking straight "
    + "at the viewer with a warm closed-mouth smile.",
  // r3 (the approved tiptoe): the GAP under the heels is described, not the word.
  tiptoe: "POSE: sneaking toward the viewer, the body turned a slight three-quarter to the hero's left so the side of both "
    + "shoes shows, the face still toward the viewer. The hero balances on the front of both soles only: under BOTH heels "
    + "there is a clear gap of green background, the heels a hand's height above the ground, the ankles stretched; "
    + "the right foot is one step in front of the left; knees slightly bent; shoulders hunched up toward the ears; "
    + "the right index finger pressed against closed lips ('shh'); the left arm held out low behind for "
    + "balance, fingers spread; a sneaky closed-mouth grin, eyes wide open with the pupils turned to the side.",
  dash: "POSE: running straight toward the viewer, caught mid-stride: the right knee driven high up in front "
    + "toward the viewer, the left leg pushing off the ground with its foot on the toes, the body leaning "
    + "forward, the left arm punched forward toward the viewer with a loose fist and the right arm swung back, "
    + "clothes and hair streaming back with the speed, an excited open-mouthed grin, eyes on the viewer.",
  "freeze-a": "POSE: a frozen statue caught mid-step, perfectly still. The hero stands on the LEFT leg only, straight, "
    + "the foot flat on the ground; the RIGHT knee is lifted up in front to hip height with the right foot "
    + "hanging below it in the air; BOTH arms stretched straight out to the sides at shoulder height, "
    + "fingers spread, for balance; cheeks puffed out round like balloons, lips pressed shut, holding the "
    + "breath; eyes wide open, looking at the viewer.",
  // r3 (the approved freeze-b): hands on hips, a silhouette unlike freeze-a, cheer and hold-up.
  "freeze-b": "POSE: a frozen statue like a little tree, perfectly still. The hero stands on the LEFT leg only, straight, "
    + "the foot flat on the ground; the RIGHT knee is bent and turned OUT to the side, with the sole of "
    + "the right foot resting against the inside of the left knee; BOTH fists planted on the hips with "
    + "the elbows sticking far out to the sides like a teapot's handles; chest puffed out proudly; the "
    + "eyes are squeezed shut in happy upturned crescents, eyebrows relaxed and raised (never frowning), "
    + "lips pressed together in a big wobbly closed-mouth grin, cheeks puffed and rosy — bursting with a "
    + "giggle and holding it in. Happy, never worried.",
  // r1 (the approved oops): small hands beside the hips, nothing else on the ground.
  oops: "POSE: a soft, funny tumble — the hero has just plopped down and is SITTING on the ground, facing "
    + "the viewer, both legs stretched out straight in front toward the viewer, the two feet "
    + "apart with their soles toward the viewer; the body leans back a little; both arms go straight down "
    + "beside the body and the two small hands (five fingers each, the same size as in image 1) rest flat "
    + "on the ground right next to the hips; eyebrows raised high, a surprised giggling open-mouthed smile — "
    + "'silly me', never hurt, never scared. Nothing else lies on the ground.",
  cheer: "POSE: a joyful cheer. The hero stands on BOTH feet, legs straight and close together, BOTH heels lifted so "
    + "the hero is up on the toes of both feet, both feet touching the ground; both arms thrown straight up high in "
    + "a wide V with the fingers spread; a big open-mouthed joyful laugh with crinkled happy eyes.",
  // r1 (the approved hold-up): hands together above the head, an O, not a V.
  "hold-up": "POSE: proudly lifting something high above the head. The hero stands steady on both feet, feet flat, feet "
    + "hip-width apart; BOTH arms raised above the head with the elbows slightly bent, the two hands "
    + "TOGETHER directly above the top of the head, side by side and close (a small gap between them), "
    + "wrists bent back so both palms face UP to the sky like a tray, as if lifting an invisible bowl; "
    + "the hands are EMPTY — nothing in them, nothing above them; the face looks at the viewer with a "
    + "proud beaming smile. The arms make a rounded O-shape around the top of the head, NOT a V.",
};

/** The full prompt for one pose: idle = the anchor (stored hero only); the
 *  rest = anchored on the approved idle. Fixed text only. */
export function heroPosePrompt(pose: HeroSheetPoseId): string {
  const refs = pose === "idle" ? REFS_ANCHOR : REFS_POSE;
  return [SPRITE_STYLE, refs, HERO, STAGE, POSES[pose], TAIL].join(" ").replace(/ {2,}/g, " ");
}
