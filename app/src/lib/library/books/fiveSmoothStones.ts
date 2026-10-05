/**
 * "Five Smooth Stones" (1 Samuel 17) — B-BOOK-06: THE PROOF BOOK (RULINGS
 * BR1), as data. Source of record: MANUSCRIPT v2 = execution/2026-10-06--
 * kids-books/depth-pass-david.md §3 (pages) + §3.2 (parent panel); v1 was
 * proof-book-david.md §4. v2 adds p3b (Eliab: "Nobody sent him to the
 * giant"), so the paths are 11 / 12 / 12 screens.
 *
 * - CAST mode (BR2): the child plays David. The narration says "David"; the
 *   child's name ({name}) appears only on the cover's name line and in the
 *   frame lines of p1 and p10. HE-f differs from HE-m only on those two frame
 *   lines; the cover is gender-neutral. Hebrew nikud is kept exactly as
 *   written, NFC-normalised (tested). Every HE line: native review owed.
 * - ALL art geometry (slots incl. the pose, windows, text rects, focus rects,
 *   repair tap points, overlays, occluders, plate sizes + provenance) comes
 *   from ONE object, fiveSmoothStones.geometry.json, GENERATED from the art
 *   agent's proof-art/david/plates.json by scripts/import-book-art.py.
 * - Repairs: p7b = three taps (fixed order helmet → sword → coat; cannot
 *   fail), p7c = one tap "Stand up!" and the page ends on David standing
 *   (`stand-tall`). No "Another way?" (BR3).
 * - p9 has ordered ART STATES (v2): the swing → the dust on the narration cue
 *   → "the soldiers rise" (PL7-rise) ~2 s later. A state whose plate is not
 *   delivered yet is skipped.
 */
import rawGeometry from "./fiveSmoothStones.geometry.json";
import { readGeometry } from "../bookGeometry";
import { makePlate, type BookPlate, type LightRig, type PlateTable } from "../bookPlates";
import type { Book, BookLine, Page, PageOverlay, Slot } from "../types";

const BOOK_ID = "five-smooth-stones";

/** The geometry object (validated). Overwrite the JSON, not this file. */
export const fiveSmoothStonesGeometry = readGeometry(rawGeometry);
const G = fiveSmoothStonesGeometry;

/** Where a pose stands if the geometry file does not name it (tested: no page
 *  of this book falls back — GEOMETRY_FALLBACKS stays empty). */
const FALLBACK_SLOT: Omit<Slot, "pose"> = { x: 0.5, y: 0.9, scale: 0.4, facing: "right", z: "fr" };

/** `<pageId>:<what>` for every value that fell back to a placeholder. */
export const GEOMETRY_FALLBACKS = new Set<string>();

/** The page's hero slot from the geometry (its pose included — the art agent
 *  picks left-facing poses where the light needs them); `pose` is the
 *  manuscript's pose, used only for the fallback. */
function heroOf(pageId: string, pose: string): Slot {
  const g = G.pages[pageId]?.hero;
  if (g) return g;
  GEOMETRY_FALLBACKS.add(`${pageId}:hero`);
  return { ...FALLBACK_SLOT, pose };
}

function afterOf(pageId: string, pose: string): Slot {
  const g = G.pages[pageId]?.heroAfter;
  if (g) return g;
  GEOMETRY_FALLBACKS.add(`${pageId}:heroAfter`);
  return { ...FALLBACK_SLOT, pose };
}

function itemAt(pageId: string, itemId: string): { x: number; y: number; to?: { x: number; y: number } } {
  const g = G.pages[pageId]?.items?.[itemId];
  if (g) return g;
  GEOMETRY_FALLBACKS.add(`${pageId}:item:${itemId}`);
  return { x: 0.5, y: 0.7 };
}

/** The page's art extras from the geometry: overlays (real files beside the
 *  plates; DEV falls back to public/_dev/overlays/<bookId>/<id>.webp), plate
 *  occluders, the spread's calm text rect, costume variants, the 3:4 window. */
function artOf(pageId: string): Pick<Page, "overlays" | "occluders" | "textRect" | "heroAlt" | "phoneCrop"> {
  const g = G.pages[pageId];
  if (!g) {
    GEOMETRY_FALLBACKS.add(`${pageId}:page`);
    return {};
  }
  const overlays: PageOverlay[] = Object.entries(g.overlays ?? {}).map(([id, o]) => ({
    id,
    file: `/visuals/books/${BOOK_ID}/overlays/${o.file ?? id}.webp`,
    x: o.x,
    y: o.y,
    scale: o.scale,
    aspect: o.aspect ?? 1,
    ...(o.footX != null ? { footX: o.footX } : {}),
    ...(o.anchor ? { anchor: o.anchor } : {}),
    ...(o.z ? { z: o.z } : {}),
    ...(o.rotate != null ? { rotate: o.rotate } : {}),
    ...(o.shadow != null ? { shadow: o.shadow } : {}),
    ...(o.showWhen ? { showWhen: o.showWhen } : {}),
    ...(o.reveal ? { reveal: o.reveal } : {}),
  }));
  return {
    ...(overlays.length ? { overlays } : {}),
    ...(g.occluders ? { occluders: g.occluders } : {}),
    ...(g.textRect ? { textRect: g.textRect } : {}),
    ...(g.heroAlt ? { heroAlt: g.heroAlt } : {}),
    ...(g.phoneCrop != null ? { phoneCrop: g.phoneCrop } : {}),
  };
}

/** The plate table (§5.1): 5 base plates + 4 edits (`variantOf`), at the
 *  shipped files' real sizes, with the art agent's QC as provenance. */
function plate(id: string, light: LightRig): BookPlate {
  const g = G.plates[id];
  if (!g?.size) GEOMETRY_FALLBACKS.add(`plate:${id}`);
  return makePlate(BOOK_ID, id, light, {
    ...(g?.size ? { width: g.size.w, height: g.size.h } : {}),
    ...(g?.provenance ? { provenance: g.provenance } : {}),
    ...(g?.variantOf ? { variantOf: g.variantOf } : {}),
    ...(g?.lightDx != null ? { lightDx: g.lightDx } : {}),
    window: g?.window ?? { cx: 0.5 },
    ...(g?.textZone ? { textZone: g.textZone } : {}),
    ...(g?.focus ? { focus: g.focus } : {}),
  });
}

export const fiveSmoothStonesPlates: PlateTable = {
  PL1: plate("PL1", "morning"), // Bethlehem hills
  PL1b: plate("PL1b", "day"), // midday, the lion fleeing
  PL1d: plate("PL1d", "dusk"), // the same hills at dusk (not night)
  PL3: plate("PL3", "morning"), // the Valley of Elah (Goliath at the upper LEFT)
  PL3w: plate("PL3w", "day"), // later, soldiers sitting
  PL4: plate("PL4", "day"), // King Saul's tent (light from the flap, right)
  PL4e: plate("PL4e", "day"), // the stand empty, a rug in front
  PL6: plate("PL6", "morning"), // the brook (+ the kneeling boulder)
  PL7: plate("PL7", "day"), // the duel
  "PL7-dust": plate("PL7-dust", "day"), // full-plate BOOM alternative — NOT used (the edit re-framed; the dust overlay is used)
  // v2 (round 3): registered only when the geometry has them
  ...(G.plates.PL3e ? { PL3e: plate("PL3e", "morning") } : {}), // p3b: Eliab standing by the bread basket
  ...(G.plates["PL7-rise"] ? { "PL7-rise": plate("PL7-rise", "day") } : {}), // p9 state 3: the soldiers stand
};

/** A line that is the same for both Hebrew genders (CAST: spoken of David). */
const same = (en: string, he: string): BookLine => ({ en, he: { m: he, f: he } });

/** Manuscript v2 poses the art agent's round 3 delivers (stand-tall-hand,
 *  stand-tall, sit-hunched): the page names the v2 pose at the geometry's
 *  slot; until the sheet has it, the reader shows `poseFallbacks`. */
const withPose = (slot: Slot, pose: string): Slot => ({ ...slot, pose });

/** Pages whose art waits for the art agent's round 3 (placeholder geometry
 *  allowed; listed in BUILD-LOG's TODO). Empty once round 3 is imported. */
export const ART_PENDING = new Set<string>(G.pages.p3b ? [] : ["p3b"]);

const cover: Page = {
  id: "cover",
  plateId: "PL3",
  type: "spread",
  hero: heroOf("cover", "walk-bag"),
  ...artOf("cover"),
  text: same(`Everyone ran. One shepherd went.`, `כולם ברחו. רועה אחד הלך.`),
};

const p1: Page = {
  id: "p1",
  plateId: "PL1",
  hero: heroOf("p1", "sling-swing"),
  ...artOf("p1"),
  text: {
    en: `Today, {name} is David, the shepherd. On the hills of Bethlehem, David keeps his father's sheep. Every day he practises with his sling. Whirr, whirr, whirr… CLACK! A hundred times a day. Each day, a little closer to the middle.`,
    he: {
      m: `היום {name} הוא דוד, הרועה. על גבעות בית לחם, דוד שומר על הכבשים של אבא שלו. כל יום הוא מתאמן בקלע. ווּשׁ, ווּשׁ, ווּשׁ… טַק! מאה פעמים ביום. וכל יום, קצת יותר קרוב לאמצע.`,
      f: `היום {name} היא דוד, הרועה. על גבעות בית לחם, דוד שומר על הכבשים של אבא שלו. כל יום הוא מתאמן בקלע. ווּשׁ, ווּשׁ, ווּשׁ… טַק! מאה פעמים ביום. וכל יום, קצת יותר קרוב לאמצע.`,
    },
  },
};

const p2: Page = {
  id: "p2",
  plateId: "PL1b",
  hero: heroOf("p2", "run-staff"),
  ...artOf("p2"),
  text: same(
    `One day, a lion grabs the smallest lamb! David's heart thumps. He runs after it anyway, and saves the lamb from its mouth. Another day, a bear. David runs again. Whirr, whirr, whirr… CLACK! Then Father calls: "David!"`,
    `יום אחד, אריה חוטף את הטלה הכי קטן! הלב דופק. ובכל זאת דוד רץ אחריו, ומציל את הטלה מפיו. יום אחר, דוב. ודוד רץ שוב. ווּשׁ, ווּשׁ, ווּשׁ… טַק! ואז אבא קורא: "דוד!"`,
  ),
};

const p3: Page = {
  id: "p3",
  plateId: "PL3",
  hero: heroOf("p3", "look-up"),
  ...artOf("p3"),
  text: same(
    `"Take this bread to your brothers," says Father. David leaves his sheep with a keeper, and goes. In the valley of Elah stands Goliath, big as a tree. "GIVE ME A MAN!" Forty days, everyone runs. Even the king.`,
    `"קח את הלחם הזה לאחים שלך," אומר אבא. דוד משאיר את הכבשים אצל שומר, והולך. בעמק האלה עומד גָּלְיָת, גבוה כמו עץ. "תְּנוּ־לִי אִישׁ וְנִלָּחֲמָה יָחַד!" ארבעים יום, כולם בורחים. אפילו המלך.`,
  ),
};

// v2: NEW page — mocked first (Eliab). Until round 3 delivers PL3e and its
// geometry, the valley plate and p3's slot with `look-across` stand in.
const p3b: Page = {
  id: "p3b",
  plateId: G.plates.PL3e ? "PL3e" : "PL3",
  hero: G.pages.p3b?.hero ?? withPose(G.pages.p3?.hero ?? heroOf("p3", "look-across"), "look-across"),
  ...(G.pages.p3b ? artOf("p3b") : { phoneCrop: G.pages.p3?.phoneCrop }),
  text: same(
    `"Who is he, to shout at us?" asks David. Big brother Eliab frowns: "Why are you here? Who is keeping your sheep?" "What did I do? I only asked." Father sent him with bread. Nobody sent him to the giant.`,
    `"מי הוא, שיצעק עלינו ככה?" שואל דוד. אליאב, אחיו הגדול, כועס: "לָמָּה־זֶּה יָרַדְתָּ? ואצל מי הכבשים?" "מֶה עָשִׂיתִי עָתָּה? רק שאלתי." אבא שלח אותו עם לחם. אף אחד לא שלח אותו אל הענק.`,
  ),
};

const p4: Page = {
  id: "p4",
  plateId: "PL4",
  hero: withPose(heroOf("p4", "stand-tall-hand"), "stand-tall-hand"),
  ...artOf("p4"),
  text: same(
    `David stands up tall before the king. "Let no one's heart fall," he says. "I will go." "You are only a boy," says Saul. "A lion came. A bear came. I ran after them. This giant will be like them."`,
    `דוד עומד זקוף מול המלך. "אַל־יִפֹּל לֵב־אָדָם עָלָיו," הוא אומר. "אני אלך." "אתה רק נער," אומר שאול. "בא אריה. בא דוב. רדפתי אחריהם. והענק הזה יהיה כמו אחד מהם."`,
  ),
};

const p5: Page = {
  id: "p5",
  plateId: "PL4",
  type: "spread",
  hero: heroOf("p5", "worried"),
  ...artOf("p5"),
  text: same(
    `King Saul gives David his armour: a bronze helmet, a heavy coat, a sword. Made for a king. Here is David's own staff, his own sling. He has never tried the armour. Not once. What will David do?`,
    `שאול נותן לדוד את כלי המלחמה שלו: כובע נחושת, שריון כבד וחרב. במידה של מלך. והנה המקל של דוד, והקלע שלו. את כלי המלך הוא עוד לא ניסה. אף פעם. מה יעשה דוד?`,
  ),
};

// ── Branch A — HARD: "Go as I am" (1 page) ────────────────────────────────────
const p6a: Page = {
  id: "p6a",
  plateId: "PL3",
  hero: heroOf("p6a", "run-staff"),
  ...artOf("p6a"),
  text: same(
    `David looks at the king's armour. "I cannot go with these," he says, "for I have not tried them." He takes his own staff, his own sling. No helmet. His heart thumps. He goes anyway, light-footed, down the hill.`,
    `דוד מביט בכלי המלך. "לֹא אוּכַל לָלֶכֶת בָּאֵלֶּה, כִּי לֹא נִסִּיתִי," הוא אומר. הוא לוקח את המקל שלו, את הקלע שלו. בלי כובע. הלב דופק. והוא הולך בכל זאת, ברגליים קלות, במורד הגבעה.`,
  ),
};

// ── Branch B — EASY: "Wear the king's armour" (2 pages) ───────────────────────
const p6b: Page = {
  id: "p6b",
  plateId: "PL4e",
  hero: heroOf("p6b", "armour-stuck"),
  ...artOf("p6b"),
  text: same(
    `On goes the king's helmet. On goes the heavy coat. David takes one step. CLANK! The helmet slips over his eyes. He cannot see, he cannot run. It is the king's, not his. He has never tried it.`,
    `כובע המלך, על הראש. השריון הכבד, על הגוף. דוד עושה צעד. קְלַנְק! הכובע נופל על העיניים. הוא לא רואה, לא יכול לרוץ. זה של המלך, לא שלו. ואת זה לא ניסה אף פעם.`,
  ),
};

const p7b: Page = {
  id: "p7b",
  plateId: "PL4e",
  hero: heroOf("p7b", "armour-stuck"),
  ...artOf("p7b"),
  text: same(`"I cannot go with these," says David, "for I have not tried them."`, `"לֹא אוּכַל לָלֶכֶת בָּאֵלֶּה, כִּי לֹא נִסִּיתִי," אומר דוד.`),
  repair: {
    promptLabel: { en: `Take it off`, he: `להוריד` },
    // Fixed order (fix round 1): helmet → sword → coat, so the coat lands on the
    // rug only on the last tap, when the sprite swaps to free-stretch.
    ordered: true,
    items: [
      { id: "helmet", label: { en: `the helmet`, he: `הכובע` }, ...itemAt("p7b", "helmet"), line: same(`Off comes the helmet.`, `הכובע יורד.`) },
      { id: "sword", label: { en: `the sword`, he: `החרב` }, ...itemAt("p7b", "sword"), line: same(`Off comes the sword.`, `החרב יורדת.`) },
      { id: "coat", label: { en: `the coat`, he: `השריון` }, ...itemAt("p7b", "coat"), line: same(`Off comes the coat.`, `השריון יורד.`) },
    ],
    textAfter: same(`David can see again. His own staff, his own sling. Now he runs!`, `דוד רואה שוב. המקל שלו, הקלע שלו. ועכשיו הוא רץ!`),
    heroAfter: afterOf("p7b", "free-stretch"),
  },
};

// ── Branch C — THIRD: "Wait for someone bigger" (2 pages) ─────────────────────
const p6c: Page = {
  id: "p6c",
  plateId: "PL3w",
  hero: withPose(heroOf("p6c", "sit-hunched"), "sit-hunched"),
  ...artOf("p6c"),
  text: same(
    `David sits down to wait for someone bigger. He curls up small, like the soldiers. "GIVE ME A MAN!" The giant comes closer. And closer. The shout grows bigger. Nobody goes. David's knees shake more and more.`,
    `דוד מתיישב לחכות למישהו גדול יותר. הוא מתכווץ, כמו החיילים. "תְּנוּ־לִי אִישׁ!" הענק מתקרב. ומתקרב. הצעקה גדלה. אף אחד לא הולך. והברכיים של דוד רועדות, עוד ועוד.`,
  ),
};

const p7c: Page = {
  id: "p7c",
  plateId: "PL3w",
  hero: withPose(heroOf("p7c", "sit-hunched"), "sit-hunched"),
  ...artOf("p7c"),
  text: same(`Nobody. Not one.`, `אף אחד. אפילו לא אחד.`),
  repair: {
    promptLabel: { en: `Stand up!`, he: `לקום!` },
    items: [{ id: "stand", label: { en: `Stand up!`, he: `לקום!` }, ...itemAt("p7c", "stand") }],
    textAfter: same(
      `David stands up tall. If nobody goes, David will go. His heart thumps. His knees still shake. He goes anyway. From up here, the giant looks a little smaller.`,
      `דוד קם, זקוף. אם אף אחד לא הולך, דוד ילך. הלב דופק, הברכיים עוד רועדות, והוא הולך בכל זאת. ומלמעלה, הענק נראה קצת יותר קטן.`,
    ),
    // v2: the page ENDS on David standing (stand-tall), not running
    heroAfter: withPose(afterOf("p7c", "stand-tall"), "stand-tall"),
  },
};

// ── Rejoin, climax, ending ────────────────────────────────────────────────────
const p8: Page = {
  id: "p8",
  plateId: "PL6",
  hero: heroOf("p8", "kneel"),
  ...artOf("p8"),
  text: same(
    `At the brook, David chooses five smooth stones. One, two, three, four, five. Into his shepherd's bag. Across the valley, Goliath looks down at him, and laughs. Just a boy!`,
    `דוד יורד אל הנחל. "וַיִּבְחַר־לוֹ חֲמִשָּׁה חַלֻּקֵי־אֲבָנִים מִן־הַנַּחַל." אחת, שתיים, שלוש, ארבע, חמש, אל ילקוט הרועים. ומעבר לעמק, גָּלְיָת מביט בו, וצוחק. סתם נער!`,
  ),
  echo: {
    a: same(`His feet are light. He got here first.`, `הרגליים קלות. הוא הגיע ראשון.`),
    b: same(`His shoulders still ache from the heavy coat.`, `הכתפיים עוד כואבות מהשריון הכבד.`),
    c: same(`The sun is high. The waiting took all morning.`, `השמש גבוהה. ההמתנה לקחה את כל הבוקר.`),
  },
};

/** p9's art states (v2): 0 = the swing; 1 = the dust on the narration cue;
 *  2 = "the soldiers rise" plate ~2 s later (3 s when silent), held 1.5 s
 *  before Next. A state whose plate is not delivered yet is skipped. */
const p9States: NonNullable<Page["artStates"]> = [
  { id: "dust", overlays: ["dust-cloud"], trigger: "narration" },
  ...(G.plates["PL7-rise"] ? [{ id: "rise", plateId: "PL7-rise", overlays: [] as string[], trigger: { afterMs: 2000, silentAfterMs: 3000 } }] : []),
];

const p9: Page = {
  id: "p9",
  plateId: "PL7",
  type: "spread",
  hero: heroOf("p9", "sling-swing"),
  ...artOf("p9"),
  artStates: p9States,
  text: same(
    `David answers: "You come with a sword and a spear. I come in the name of God. All will see: swords and spears do not win!" He runs toward the giant. Whirr, whirr, whirr… The stone flew. The giant fell. BOOM.`,
    `דוד עונה: "אַתָּה בָּא אֵלַי בְּחֶרֶב וּבַחֲנִית וּבְכִידוֹן, וַאֲנִי בָּא אֵלֶיךָ בְּשֵׁם אֱלֹהִים. וכולם יידעו: לֹא בְּחֶרֶב וּבַחֲנִית!" דוד רץ לקראת הענק. ווּשׁ, ווּשׁ, ווּשׁ… האבן עפה. הענק נפל. בּוּם.`,
  ),
};

const p10: Page = {
  id: "p10",
  plateId: "PL1d",
  type: "spread",
  hero: heroOf("p10", "sit"),
  ...artOf("p10"),
  text: same(
    `That day, the soldiers stood up tall. That evening, David sits with his sheep. Baa. Four smooth stones in his bag. Tomorrow? A hundred times again.`,
    `באותו יום, החיילים קמו זקופים. בערב, דוד יושב עם הכבשים על הגבעה. מֶההה. ארבע אבנים חלקות בילקוט. מחר? שוב מאה פעמים.`,
  ),
  echo: {
    a: same(`His own staff. His own sling.`, `המקל שלו. הקלע שלו.`),
    b: same(`Armour? One day, after a hundred tries.`, `שריון? יום אחד, אחרי מאה ניסיונות.`),
    c: same(`His knees remember the long wait.`, `הברכיים זוכרות את ההמתנה הארוכה.`),
  },
  // The play frame closes the book (the only other place the name appears).
  closing: {
    en: `And today, {name} was David, the shepherd.`,
    he: { m: `והיום {name} היה דוד, הרועה.`, f: `והיום {name} הייתה דוד, הרועה.` },
  },
};

export const fiveSmoothStones: Book = {
  id: BOOK_ID,
  title: { en: `Five Smooth Stones`, he: `חָמֵשׁ אֲבָנִים חֲלָקוֹת` },
  coverLine: { en: `Everyone ran. One shepherd went.`, he: `כולם ברחו. רועה אחד הלך.` },
  coverNameLine: { en: `{name} as David`, he: `{name} בתפקיד דוד` },
  sourceRef: "1 Samuel 17",
  knowledge:
    "For forty days a whole army waited for someone else to face the giant; the youngest volunteered, went as himself with what he had practised on small dangers, left the king's armour because he had never tried it, and when he went the others stood up.",
  childRole: "CAST (BR2) — the child is David, a youth in the text (17:33, 17:42); play frame on the first and last pages.",
  additions: [
    "the play frame",
    "Bun (painted, neutral)",
    "the olive-tree target David practises on",
    "\"a hundred times a day\"",
    "the lamb's black ear",
    "the tally marks",
    "the giant's shadow",
    "the path where David waits (in the text the army waited forty days, 17:16; David did not)",
    "staging: the armour waits on a stand (in the text Saul dresses David himself, 17:38)",
    "omitted: 17:25-27 (the reward and David's questions about it), 17:43-44 (curses), 17:50-51 (how the giant dies), 17:52 (the chase)",
  ],
  ageBand: "4-7",
  /** v2 poses the hero sheet may not have yet (round 3): the nearest pose it has. */
  poseFallbacks: { "stand-tall-hand": "look-up", "stand-tall": "look-up", "sit-hunched": "sit" },
  cover,
  pages: [p1, p2, p3, p3b, p4, p5, p8, p9, p10],
  decision: {
    pageId: "p5",
    // dedicated card pictures, when the art agent delivers them (geometry)
    ...(G.choiceArt ? { choiceArt: Object.fromEntries(Object.entries(G.choiceArt).map(([k, f]) => [k, `/visuals/books/${BOOK_ID}/${f}`])) } : {}),
    choices: [
      { id: "a", type: "hard", label: { en: `Go as I am`, he: `ללכת כמו שאני` }, branch: [p6a] },
      { id: "b", type: "easy", label: { en: `Wear the king's armour`, he: `ללבוש את השריון של המלך` }, branch: [p6b, p7b] },
      { id: "c", type: "third", label: { en: `Wait for someone bigger`, he: `לחכות למישהו גדול יותר` }, branch: [p6c, p7c] },
    ],
  },
  rejoinPageId: "p8",
  parent: {
    knows: {
      en: `For forty days a whole army, the king included, waited for someone else to face the giant. The youngest went. Nobody sent him: he volunteered. He went as himself, with what he had practised on small dangers, and he left the king's armour because he had never tried it. When he went, the others stood up.`,
      he: `ארבעים יום חיכה צבא שלם, והמלך איתו, שמישהו אחר יצא אל הענק. הצעיר מכולם יצא. אף אחד לא שלח אותו: הוא התנדב. הוא הלך כמו שהוא, עם מה שתרגל מול סכנות קטנות, והשאיר את שריון המלך כי מעולם לא ניסה אותו. כשהוא יצא, כל האחרים קמו.`,
    },
    whyNow: {
      en: `Five-year-olds meet small giants every week: a new group, a bigger child, the dark, the deep end. The story never says David was not afraid; his heart thumps every time. It shows the order that works: practise small, then choose to go yourself. A fear faced by choice, in small steps, usually shrinks. A fear avoided, or always handled by an adult, usually grows.`,
      he: `ילדים בני חמש פוגשים ענקים קטנים כל שבוע: קבוצה חדשה, ילד גדול יותר, החושך, המים העמוקים. הסיפור לא אומר שדוד לא פחד; הלב שלו דופק כל פעם. הוא מראה את הסדר שעובד: מתאמנים בקטן, ואז בוחרים ללכת בעצמך. פחד שפוגשים מבחירה, בצעדים קטנים, בדרך כלל קטן. פחד שבורחים ממנו, או שמבוגר תמיד פותר במקומך, בדרך כלל גדל.`,
    },
    tomorrow: {
      en: `Choose one small "lion" your child can meet alone: ordering their own roll at the bakery, carrying the bag to the car, asking the teacher a question. Stand beside them; do not do it for them. Afterwards, say only what happened: "Your heart was thumping, and you did it."`,
      he: `בחרו "אריה" קטן אחד שהילד יכול לפגוש לבד: להזמין בעצמו לחמנייה במאפייה, לסחוב את התיק לאוטו, לשאול את הגננת שאלה. עמדו לידו, אל תעשו במקומו. אחר כך אמרו רק מה שקרה: "הלב שלך דפק, ועשית את זה."`,
    },
    askAfter: same(`Why did David leave the king's armour in the tent?`, `למה דוד השאיר את השריון של המלך באוהל?`),
    askAfterOptional: {
      en: `Who stood up at the end, and why do you think they stood up?`,
      he: { m: `מי קם בסוף, ולמה אתה חושב שהם קמו?`, f: `מי קם בסוף, ולמה את חושבת שהם קמו?` },
    },
    together: { en: `What if David had waited for someone bigger? Read it again and see.`, he: `ומה אם דוד היה מחכה למישהו גדול יותר? קראו שוב ותראו.` },
    sourceNote: {
      en: `1 Samuel 17, told in short. Quoted: 17:10, 17:28, 17:29, 17:32, 17:39, 17:40, the first half of 17:45, and the words "not by sword and spear" from 17:47. "In the name of God" is David's own claim (17:45), in plain words; in the Bible he says the battle belongs to God (17:47), and the narrator adds that "there was no sword in David's hand" (17:50). Left out for young children: the king's reward and David's questions about it (17:25–27), Goliath's curses (17:43–44), how the giant dies (17:50–51) and the chase (17:52). Added: the play frame, Bun, the olive-tree target, "a hundred times a day", the lamb's black ear, the tally marks, the giant's shadow, and the path where David waits (in the Bible the army waited forty days, 17:16; David did not). The "armour" path tells it as the Bible does; there Saul dresses David himself (17:38).`,
      he: `שמואל א׳ יז, בקיצור. מצוטטים: יז, י; כח; כט; לב; לט; מ; תחילת מה; והמילים "לֹא בְּחֶרֶב וּבַחֲנִית" מיז, מז. "בשם אלוהים" הם דברי דוד עצמו (יז, מה), במילים פשוטות; במקרא הוא אומר שהמלחמה לאלוהים (יז, מז), והמספר מוסיף "וְחֶרֶב אֵין בְּיַד־דָּוִד" (יז, נ). הושמטו לילדים צעירים: שכר המלך ושאלות דוד עליו (יז, כה–כז), קללות גלית (יז, מג–מד), מות הענק (יז, נ–נא) והמרדף (יז, נב). נוספו: מסגרת המשחק, ארנבוני, עץ הזית, "מאה פעמים ביום", האוזן השחורה של הטלה, סימני הספירה, צל הענק, והדרך שבה דוד מחכה (במקרא הצבא חיכה ארבעים יום, יז, טז; דוד לא). דרך "השריון" מספרת כמו המקרא; שם שאול עצמו מלביש את דוד (יז, לח).`,
    },
  },
};
