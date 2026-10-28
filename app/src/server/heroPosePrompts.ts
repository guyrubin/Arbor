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
import { isHeroBookPose, isHeroPlanPose, planPoseOfRoute, type HeroBookPoseId, type HeroPlanPoseId, type HeroPoseId, type HeroSheetPoseId } from "../lib/heroSheetContract.js";
import type { PlanPose } from "../lib/library/plans/planPoses.js";

/** ONE CHARACTER EVERYWHERE (Guy, 8 Oct): the hero looks the same on every kid
 *  surface - tiles, books, games. The finish is the stored hero's own; the pose
 *  route never re-styles it. Before 8 Oct this block forced a glossy 3D film
 *  finish (large eyes, ~3.5 heads tall, head as wide as the shoulders), which drew
 *  a second, cartoon version of the child beside the book's painted one. */
export const SPRITE_STYLE = "Paint the hero in EXACTLY the illustration finish of the hero reference image: the same rendering, "
  + "brushwork, shading, line quality, colour palette and light as that image. Do not re-style the hero: no glossy 3D "
  + "film render, no chibi or big-headed proportions, no enlarged eyes unless the reference has them. Natural "
  + "child proportions as in the reference.";

export const TAIL = "Absolutely no text anywhere: no letters, words, numbers, writing on signs, labels, logos, watermarks, signatures, "
  + "captions, speech bubbles or interface elements. An illustrated character only: never photorealistic, no "
  + "photographic skin texture, not the likeness of any celebrity or other real person, no resemblance to any existing film or "
  + "franchise character. Correct anatomy: five fingers on each hand, no extra or merged limbs. No weapons, no blood, "
  + "no scary faces, no menacing shadows. No sparkle trails, glitter, floating orbs, light beams everywhere or lens "
  + "flares; no screens or phones; no coins, trophies or reward stars. No border or frame.";

/** Generalised: the identity is the reference's, not a description. */
export const HERO = "THE HERO: the original illustrated child hero shown in the reference, with the reference's own body "
  + "proportions. FACE, eyes, eyebrows, skin tone and HAIR (cut, length and shape) exactly as in the reference. OUTFIT: exactly the "
  + "reference's clothing, colours and accessories; where the reference shows only the head and shoulders, continue "
  + "the same outfit naturally down to a full body with matching shoes, inventing nothing that changes who the hero "
  + "is. An illustrated character, never photoreal.";

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
  + "tone, hair, clothing, colours and accessories exactly, in image 1's OWN illustration finish. Ignore its framing, its "
  + "background and its lighting. Paint a NEW picture of the same character.";

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
 *  rest = anchored on the approved idle; a book pose = the book prompt (K2,
 *  below). Fixed text only. */
export function heroPosePrompt(pose: HeroPoseId): string {
  if (isHeroPlanPose(pose)) return planPosePrompt(pose);
  if (isHeroBookPose(pose)) return bookPosePrompt(pose);
  const game = pose as HeroSheetPoseId;
  const refs = game === "idle" ? REFS_ANCHOR : REFS_POSE;
  return [SPRITE_STYLE, refs, HERO, STAGE, POSES[game], TAIL].join(" ").replace(/ {2,}/g, " ");
}

/* ── K2: the BOOK poses ───────────────────────────────────────────────────────
 * Ported from the proof's sprite prompts (kids-books-proof-2026-10-06
 * proof-art/david/jobs_lib.py: POSES, rounds 1-4) and generalised from one
 * child to any family's hero, on the SAME SPRITE_STYLE / REFS_POSE / HERO
 * blocks as the game, so the book's hero is the game's hero:
 *  - no name, no costume of one child: the hero wears the hero's own clothes
 *    (HERO), plus the shepherd's bag OVER them; the armour goes over the
 *    hero's own clothes; the proof's second costume is dropped (worried-tunic
 *    draws the worried pose; Book.poseFallbacks maps it to `worried`);
 *  - the hero is the same age as the reference (no age clause of one child);
 *  - he/his/the boy -> the hero; boots -> shoes; the sling stays in the hands
 *    or tucked into the bag's strap (a hero's clothes may have no belt);
 *  - sit-hunched is the round-3 rewording that passed the safety filter;
 *  - STAGE_BOOK: the book's camera (profile, three-quarter, three-quarter
 *    back, as each pose says), not the game's front-facing one; props named
 *    by the pose are allowed; TAIL_BOOK: only the named sling and staff.
 * Always anchored on the approved game idle (image 1). Fixed text only.
 */
const SLING = "a simple shepherd's sling: two thin brown leather cords joined by a small leather pouch";
const STAFF = "a plain straight wooden shepherd's staff a little taller than the hero, with a gentle crook at the top";
const BAG = "Over the hero's own clothes, a small brown leather shepherd's bag on a thin leather strap across the body, from one shoulder to the opposite hip.";
const ARMOUR = "The hero's own clothes and shoes show at the lower arms and lower legs, but OVER the hero's own clothes the hero wears an "
  + "OVERSIZED adult's coat of bronze scale mail, far too big: it hangs from the shoulders down past the knees and its sleeves swallow "
  + "the upper arms; a wide leather sword belt sags crookedly at the hip (an empty belt, nothing hanging from it). The head is BARE: no "
  + "helmet, the hair fully visible. No shepherd's bag.";
const UPRIGHT = "The posture is unmistakably UPRIGHT and proud: back straight, shoulders pulled back and down, chest open, chin level, head "
  + "high, feet planted a little apart, weight even; ";
const WORRIED = "standing facing the viewer straight on, arms hanging at the sides, the eyes glancing to one side (toward the viewer's "
  + "left), lower lip caught between the teeth, a small worried frown.";
const ONLY_BAG = "Props: only the shepherd's bag.";

export const CAMERA_BOOK = "Camera: a picture-book camera at the hero's chest height, 50 mm lens, no perspective distortion; the body "
  + "turned exactly as the pose says (front, three-quarter, profile or three-quarter back view) and the face always visible, never "
  + "the back of the head.";

export const STAGE_BOOK = "THE PICTURE: a character sprite for a painted picture-book page, on a flat chroma-key background. Exactly one "
  + "child, the hero, alone: no bunny, no companion, no second child, no reflection; in the hands only the props the pose names. The "
  + "hero is the same age as the reference, with the reference's own proportions. FULL BODY head to toe, nothing cropped: the whole "
  + "hair, the whole outfit, both hands with all fingers, both feet and every named prop inside the frame, with at least 10 percent "
  + "empty green background on EVERY side. " + CAMERA_BOOK + " The hero fills about 75 percent of the image height. " + BACKGROUND;

/** The game's TAIL, with the book's props: only the named sling and staff. */
export const TAIL_BOOK = TAIL.replace("No weapons, no blood,", "In the hands, only the named sling and staff and only where the pose names "
  + "them: nothing sharp, no sword, no spear, no knife; no blood,");

export interface BookPose {
  /** What the hero wears over the hero's own clothes (default: the bag). */
  outfit?: string;
  pose: string;
  props: string;
  /** What must be inside the frame besides the whole body. */
  extent: string;
}

export const BOOK_POSES: Readonly<Record<HeroBookPoseId, BookPose>> = {
  "sling-swing": {
    pose: "standing with the feet planted apart in a three-quarter view facing the viewer's right; the right arm raised straight up "
      + "with the hand just above the head, whirling the short sling: the sling's cords and pouch form ONE small, tight, perfectly "
      + "round ring spinning flat just above the top of the head, like a halo seen slightly from below, no wider than the shoulders, "
      + "drawn crisp and sharp; the cords are SHORT (no longer than the forearm), never a long rope or lasso; NO motion blur, no speed "
      + "lines, no streaks; the other arm forward for balance; eyes fixed ahead to the right, determined, mouth set.",
    props: `Props: ${SLING} (short, in the raised hand).`,
    extent: "the whole body from the top of the sling ring down to both shoes, with plain green visible below the shoes (do NOT crop at the knees)",
  },
  "sling-swing-face-right": {
    pose: "a three-quarter BACK-right view: the hero seen partly from behind the left shoulder, the whole body and the face turned "
      + "toward the viewer's RIGHT and up, so the face shows in profile or three-quarter (cheek, eye, nose and mouth clearly visible; "
      + "NOT the back of the head); feet planted wide apart; the right arm raised with the hand just above the head whirling the short "
      + "sling as ONE small, tight, crisp ring just above the top of the head (no wider than the shoulders, no motion blur, no speed "
      + "lines); the other arm forward for balance; chin up, determined, looking UP to the right at something enormous.",
    props: `Props: ${SLING} (short, in the raised hand).`,
    extent: "the whole body from the top of the sling ring down to both shoes, with plain green visible below the shoes",
  },
  "sling-release": {
    pose: "a three-quarter BACK-right view: the hero seen partly from behind the left shoulder, body and face turned to the viewer's "
      + "RIGHT so the face shows in profile (eye, nose, cheek visible; not the back of the head); the instant after a throw: the right "
      + "arm extended straight forward and slightly up toward the right at the end of the swing, the empty sling's two short cords and "
      + "empty pouch trailing loosely from the hand; weight on the front foot, back heel lifted; eyes fixed far ahead to the right and "
      + "up, following a flying stone, determined.",
    props: `Props: ${SLING} (empty, trailing from the outstretched hand).`,
    extent: "the outstretched hand with the trailing sling and both shoes",
  },
  "run-staff": {
    pose: "running lightly in full profile toward the viewer's right, mid-stride with one foot off the ground, the trailing hand "
      + "holding the staff angled back behind, the shepherd's bag bouncing at the hip, the sling tucked into the bag's strap; bright "
      + "eager face, mouth open in a joyful grin.",
    props: `Props: ${STAFF}; ${SLING}, tucked into the bag's strap.`,
    extent: "the whole staff and both shoes",
  },
  // Left-facing, not mirrored: mirroring would put the key light on the wrong side.
  "run-staff-left": {
    pose: "running lightly in full profile toward the viewer's LEFT, mid-stride with one foot off the ground, one hand holding the "
      + "staff, the shepherd's bag bouncing at the hip, the sling tucked into the bag's strap; bright eager face, mouth open in a "
      + "joyful grin.",
    props: `Props: ${STAFF}; ${SLING}, tucked into the bag's strap.`,
    extent: "the whole staff and both shoes",
  },
  "walk-bread": {
    pose: "walking eagerly to the viewer's RIGHT in a three-quarter view, one foot forward, mid-stride; over the right shoulder a "
      + "short wooden stick with a knotted cream cloth bundle of bread loaves tied to its end; in the left hand the plain wooden "
      + "staff; bright eager face looking ahead to the right.",
    props: `Props: ${STAFF} (in the left hand); a short stick over the shoulder with a cream cloth bundle of bread tied to it.`,
    extent: "the bread bundle, the staff and both shoes",
  },
  "look-up": {
    pose: "standing in a three-quarter view facing the viewer's LEFT, head tilted well back, looking up at someone much taller; "
      + "eyebrows raised, mouth set in a brave but worried line; hands at the sides.",
    props: ONLY_BAG,
    extent: "both shoes",
  },
  "look-up-unsure": {
    pose: "standing in a three-quarter view facing the viewer's LEFT, head tilted back, looking UP at something being held out; both "
      + "hands half raised in front of the chest, palms open and up, hesitant, not touching anything; eyebrows raised, mouth slightly "
      + "open, unsure.",
    props: `${ONLY_BAG} Nothing in the hands.`,
    extent: "both half-raised hands and both shoes",
  },
  "look-across": {
    pose: "standing in a three-quarter BACK-left view: the hero seen partly from behind the right shoulder, the body turned toward the "
      + "viewer's LEFT and into the distance, the head turned to the left so the face shows in three-quarter profile (eye, nose, cheek "
      + "and mouth visible; NOT the back of the head); one foot a little forward as if just stopped walking; hands at the sides; "
      + "looking far across and slightly up at something huge in the distance, brave and curious, mouth closed.",
    props: ONLY_BAG,
    extent: "both shoes",
  },
  worried: { pose: WORRIED, props: ONLY_BAG, extent: "both shoes" },
  "worried-tunic": { pose: WORRIED, props: ONLY_BAG, extent: "both shoes" },
  "stand-tall-hand": {
    pose: "standing in a three-quarter view facing the viewer's LEFT. " + UPRIGHT + "the RIGHT hand raised to shoulder height with the "
      + "palm open and facing forward (volunteering: 'I will go'), the left hand holding the strap of the bag; the face calm and set, "
      + "eyes looking up to the left at a much taller person, mouth closed and firm.",
    props: `${ONLY_BAG} Nothing in the hands.`,
    extent: "the raised hand and both shoes",
  },
  "stand-tall": {
    pose: "standing in a three-quarter view facing the viewer's LEFT. " + UPRIGHT + "both arms down at the sides, the sling's cords "
      + "held loosely in the right hand, the staff held upright in the left hand; eyes looking forward to the left, mouth set, brave "
      + "even though a little scared.",
    props: `Props: ${STAFF} (upright in the left hand); ${SLING} (hanging from the right hand).`,
    extent: "the whole staff and both shoes",
  },
  "armour-stuck": {
    outfit: ARMOUR,
    pose: "front three-quarter view facing slightly to the viewer's right, knees bent under the weight, arms held stiffly out from "
      + "the body, comic strain on the face: cheeks puffed, one eye squeezed half shut, teeth gritted.",
    props: "Props: none (nothing in the hands).",
    extent: "the whole coat of mail and both shoes",
  },
  "free-stretch": {
    pose: "standing facing the viewer, both arms stretched wide up and out in a big relieved stretch, chin up, a big relieved open "
      + "grin showing the upper teeth.",
    props: ONLY_BAG,
    extent: "both raised hands and both shoes",
  },
  sit: {
    pose: "sitting on an invisible low seat at knee height (no seat drawn: the hero simply sits in the air on the flat green, the "
      + "thighs level), in a three-quarter view facing the viewer's LEFT, knees bent, feet flat, the staff lying across the knees with "
      + "both hands resting on it, a calm, content small smile.",
    props: `Props: ${STAFF}, lying across the knees.`,
    extent: "the whole staff and both shoes",
  },
  // Round 3's rewording (the first draft did not pass the safety filter).
  "sit-hunched": {
    pose: "sitting on an invisible low seat (no seat drawn: the hero sits in the air on the flat green) in a three-quarter view "
      + "facing the viewer's LEFT, curled up small: knees pulled up high to the chest, both arms hugging the knees, shoulders raised, "
      + "back rounded, chin resting on top of the knees, eyes looking up to the left, a small uncertain expression; the staff lying "
      + "flat beside the shoes.",
    props: `Props: ${STAFF} lying flat beside the shoes.`,
    extent: "the whole staff and both shoes",
  },
  "squat-stones": {
    pose: "squatting low on the heels in a three-quarter view facing the viewer's RIGHT; the right hand held out in front with the "
      + "palm OPEN and up, holding three smooth, round, pale grey river stones; the left hand dropping one more smooth stone into the "
      + "open mouth of the leather shepherd's bag at the hip; eyes looking down at the stones in the palm, a small concentrated smile.",
    props: "Props: the shepherd's bag (open at the hip); four smooth pale grey river stones (three in the open palm, one falling into the bag).",
    extent: "both shoes and the outstretched palm with the stones",
  },
};

/** The prompt of one book pose: anchored on the approved idle (REFS_POSE). */
function bookPosePrompt(pose: HeroBookPoseId): string {
  const b = BOOK_POSES[pose];
  return [SPRITE_STYLE, REFS_POSE, HERO, STAGE_BOOK, b.outfit ?? BAG, `POSE: ${b.pose}`, b.props, `Inside the frame, besides the whole body: ${b.extent}.`, TAIL_BOOK]
    .join(" ")
    .replace(/ {2,}/g, " ");
}

/* ── B-BOOK-75 follow-up: the PLAN poses ─────────────────────────────────────
 * The child's hero as THEMSELF, at home, in the hero's own clothes (standard
 * §0: the plan book's childRole is SELF): no bag, no costume, nothing in the
 * hands unless the pose names it. One shared sheet of twelve, every pattern. */
const OWN_CLOTHES = "OUTFIT: only the hero's own clothes and shoes from the reference — no bag, no costume, no hat, nothing added.";
const EMPTY_HANDS = "Props: none; both hands empty.";

export const PLAN_POSE_PROMPTS: Readonly<Record<PlanPose, BookPose>> = {
  "sit-calm": {
    outfit: OWN_CLOTHES,
    pose: "sitting calmly on an invisible low seat (no seat drawn: the hero sits in the air on the flat green), facing the viewer, "
      + "back comfortably straight, knees bent at a right angle with both feet flat on the ground a little apart, both hands resting "
      + "open on the knees, shoulders relaxed, a soft calm closed-mouth smile, eyes on the viewer.",
    props: EMPTY_HANDS, extent: "both shoes and both hands",
  },
  "stand-tall": {
    outfit: OWN_CLOTHES,
    pose: "standing tall and proud, facing the viewer, back straight, shoulders back, chest open, chin level, feet a little apart "
      + "and flat on the ground, arms relaxed at the sides a hand's width from the body, a warm confident closed-mouth smile.",
    props: EMPTY_HANDS, extent: "both shoes and both hands",
  },
  "point-up": {
    outfit: OWN_CLOTHES,
    pose: "standing facing the viewer, feet a little apart, the right arm raised straight up with the index finger pointing to the "
      + "sky, the left arm relaxed at the side, the face turned slightly up with bright curious eyes and an open-mouthed happy grin.",
    props: EMPTY_HANDS, extent: "the raised pointing finger and both shoes",
  },
  "hug-knees": {
    outfit: OWN_CLOTHES,
    pose: "sitting on the ground on the flat green in a three-quarter view facing the viewer's left, knees pulled up to the chest, "
      + "both arms wrapped around the shins, chin resting on the knees, a calm thoughtful face with a small soft smile, eyes open.",
    props: EMPTY_HANDS, extent: "both shoes and both arms",
  },
  "hold-tummy": {
    outfit: OWN_CLOTHES,
    pose: "standing facing the viewer, feet a little apart, both hands resting gently flat on the tummy one above the other, "
      + "shoulders relaxed, head tilted a little, a calm attentive face with a small closed-mouth smile, never a grimace, never in pain.",
    props: EMPTY_HANDS, extent: "both hands on the tummy and both shoes",
  },
  wave: {
    outfit: OWN_CLOTHES,
    pose: "standing facing the viewer, feet a little apart, the right hand raised beside the head with the open palm toward the "
      + "viewer in a friendly wave, the left arm relaxed at the side, a bright open-mouthed happy smile.",
    props: EMPTY_HANDS, extent: "the waving hand and both shoes",
  },
  "lie-down": {
    outfit: OWN_CLOTHES,
    pose: "lying on the back on the flat green as if on a bed, the body in full profile with the head toward the viewer's left, "
      + "legs straight and together, both arms resting along the sides, eyes closed, a peaceful resting face with a tiny smile; "
      + "no bed, no pillow, no blanket drawn (the page provides them).",
    props: EMPTY_HANDS, extent: "the whole body from the hair to both shoes",
  },
  "sit-at-table": {
    outfit: OWN_CLOTHES,
    pose: "sitting upright on an invisible chair (no chair, no table drawn: the hero sits in the air on the flat green), facing the "
      + "viewer, both forearms resting flat in front at waist height as if on a table edge, hands open and relaxed, an interested "
      + "closed-mouth smile, eyes looking a little down toward the invisible table.",
    props: EMPTY_HANDS, extent: "both forearms and both shoes",
  },
  "open-mouth-wide": {
    outfit: OWN_CLOTHES,
    pose: "sitting upright on an invisible chair facing the viewer, hands resting on the knees, the mouth open wide in a playful "
      + "'aaah' as if about to taste something, eyebrows raised, eyes bright and happy, head tilted slightly back; nothing in the mouth.",
    props: EMPTY_HANDS, extent: "the open mouth and both shoes",
  },
  "hold-hand": {
    outfit: OWN_CLOTHES,
    pose: "standing in a three-quarter view facing the viewer's right, feet a little apart, the right arm raised out to the side "
      + "to shoulder height with the small hand gently curled as if holding a grown-up's hand just outside the frame — NOBODY else "
      + "in the picture, no second hand drawn; the left arm relaxed; a calm brave closed-mouth smile, eyes forward.",
    props: EMPTY_HANDS, extent: "the raised reaching hand and both shoes",
  },
  "hold-box": {
    outfit: OWN_CLOTHES,
    pose: "standing facing the viewer, feet a little apart, both hands holding a small plain cardboard box with its lid open, held "
      + "at chest height in front of the body; the hero looks down into the box with wide curious eyes and a delighted open-mouthed smile.",
    props: "Props: one small plain light-brown cardboard box, lid open, held in both hands; the box is EMPTY inside.",
    extent: "the whole box and both shoes",
  },
  "hands-up": {
    outfit: OWN_CLOTHES,
    pose: "standing on both feet, feet flat and a little apart, both arms thrown straight up high in a wide V with the fingers "
      + "spread, head up, a big open-mouthed joyful laugh with crinkled happy eyes.",
    props: EMPTY_HANDS, extent: "both raised hands and both shoes",
  },
};

/** The prompt of one plan pose: anchored on the approved idle, the hero as themself. */
function planPosePrompt(id: HeroPlanPoseId): string {
  const b = PLAN_POSE_PROMPTS[planPoseOfRoute(id)];
  return [SPRITE_STYLE, REFS_POSE, HERO, STAGE_BOOK, b.outfit ?? OWN_CLOTHES, `POSE: ${b.pose}`, b.props, `Inside the frame, besides the whole body: ${b.extent}.`, TAIL_BOOK]
    .join(" ")
    .replace(/ {2,}/g, " ");
}
