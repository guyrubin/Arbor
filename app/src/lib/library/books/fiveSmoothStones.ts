/**
 * "Five Smooth Stones" (1 Samuel 17) — B-BOOK-06: THE PROOF BOOK (RULINGS
 * BR1), as data. Source of record: execution/2026-10-06--kids-books/
 * proof-book-david.md — §4 (manuscript), §3.1 (parent panel), §1 (source,
 * knowledge, omissions), §5 (plate and pose ledger).
 *
 * - CAST mode (BR2): the child plays David. The narration says "David"; the
 *   child's name ({name}) appears only on the cover's name line and in the
 *   frame lines of p1 and p10. HE-f differs from HE-m only on those two frame
 *   lines; the cover is gender-neutral. Hebrew nikud is kept exactly as
 *   written, NFC-normalised (tested). Every HE line: native review owed.
 * - ALL art geometry (slots, windows, text zones, focus rects, repair item
 *   and overlay positions) comes from ONE object, fiveSmoothStones.geometry.json,
 *   which the plate author overwrites from proof-art/david/plates.json. The
 *   numbers there now are placeholders.
 * - Repairs: p7b = three taps (helmet, coat, sword; any order; cannot fail),
 *   p7c = one tap "Stand up!". No "Another way?" (BR3).
 */
import rawGeometry from "./fiveSmoothStones.geometry.json";
import { readGeometry } from "../bookGeometry";
import { makePlate, type BookPlate, type LightRig, type PlateTable } from "../bookPlates";
import type { Book, BookLine, Page, PageOverlay, Slot } from "../types";

const BOOK_ID = "five-smooth-stones";

/** The geometry object (validated). Overwrite the JSON, not this file. */
export const fiveSmoothStonesGeometry = readGeometry(rawGeometry);
const G = fiveSmoothStonesGeometry;

/** Where a pose stands until the geometry file names it: centre, mid-size. */
const FALLBACK_SLOT: Omit<Slot, "pose"> = { x: 0.5, y: 0.9, scale: 0.4, facing: "right", z: "fr" };

function heroOf(pageId: string, pose: string): Slot {
  const g = G.pages[pageId]?.hero;
  return g ? { ...g, pose } : { ...FALLBACK_SLOT, pose };
}

function afterOf(pageId: string, pose: string): Slot {
  const g = G.pages[pageId]?.heroAfter ?? G.pages[pageId]?.hero;
  return g ? { ...g, pose } : { ...FALLBACK_SLOT, pose };
}

function itemAt(pageId: string, itemId: string, fallback: { x: number; y: number }) {
  return G.pages[pageId]?.items?.[itemId] ?? fallback;
}

/** Overlay art: the real file beside the plates; DEV falls back to
 *  public/_dev/overlays/<bookId>/<id>.webp (see bookPlates.overlaySources). */
function overlay(pageId: string, id: string, extra: Partial<PageOverlay> = {}): PageOverlay {
  const g = G.pages[pageId]?.overlays?.[id];
  return {
    id,
    file: `/visuals/books/${BOOK_ID}/overlays/${id}.webp`,
    x: g?.x ?? 0.5,
    y: g?.y ?? 0.6,
    scale: g?.scale ?? 0.15,
    aspect: g?.aspect ?? 1,
    ...extra,
  };
}

/** The plate table (§5.1): 5 base plates + 4 edits (`variantOf`). */
function plate(id: string, light: LightRig, variantOf?: string): BookPlate {
  const g = G.plates[id] ?? {};
  return makePlate(BOOK_ID, id, light, {
    window: g.window ?? { cx: 0.5 },
    ...(g.textZone ? { textZone: g.textZone } : {}),
    ...(g.focus ? { focus: g.focus } : {}),
    ...(variantOf ? { variantOf } : {}),
  });
}

export const fiveSmoothStonesPlates: PlateTable = {
  PL1: plate("PL1", "morning"), // Bethlehem hills
  PL1b: plate("PL1b", "day", "PL1"), // midday, the lion fleeing
  PL1d: plate("PL1d", "dusk", "PL1"), // the same hills at dusk (not night)
  PL3: plate("PL3", "morning"), // the Valley of Elah
  PL3w: plate("PL3w", "day", "PL3"), // later, soldiers sitting
  PL4: plate("PL4", "day"), // King Saul's tent
  PL4e: plate("PL4e", "day", "PL4"), // the stand empty, a rug in front
  PL6: plate("PL6", "morning"), // the brook
  PL7: plate("PL7", "day"), // the duel
};

/** A line that is the same for both Hebrew genders (CAST: spoken of David). */
const same = (en: string, he: string): BookLine => ({ en, he: { m: he, f: he } });

const cover: Page = {
  id: "cover",
  plateId: "PL3",
  type: "spread",
  hero: heroOf("cover", "walk-bag"),
  phoneCrop: G.pages.cover?.phoneCrop,
  text: same(`A shepherd, a sling, and a giant as big as a tree.`, `רועה, קלע, וענק גבוה כמו עץ.`),
};

const p1: Page = {
  id: "p1",
  plateId: "PL1",
  hero: heroOf("p1", "sling-swing"),
  phoneCrop: G.pages.p1?.phoneCrop,
  text: {
    en: `Today, {name} is David, the shepherd. On the hills of Bethlehem, David keeps his father's sheep. Every day he practises with his sling. Whirr, whirr, whirr… CLACK! Right on the old olive tree. A hundred times a day.`,
    he: {
      m: `היום {name} הוא דוד, הרועה. על גבעות בית לחם, דוד שומר על הכבשים של אבא שלו. כל יום הוא מתאמן בקלע. ווּשׁ, ווּשׁ, ווּשׁ… טַק! בּוּל בעץ הזית הזקן. מאה פעמים ביום.`,
      f: `היום {name} היא דוד, הרועה. על גבעות בית לחם, דוד שומר על הכבשים של אבא שלו. כל יום הוא מתאמן בקלע. ווּשׁ, ווּשׁ, ווּשׁ… טַק! בּוּל בעץ הזית הזקן. מאה פעמים ביום.`,
    },
  },
};

const p2: Page = {
  id: "p2",
  plateId: "PL1b",
  hero: heroOf("p2", "run-staff"),
  phoneCrop: G.pages.p2?.phoneCrop,
  text: same(
    `One day, a lion leaps out and grabs a lamb! David runs after it and saves the lamb from its mouth. Another day, a bear. David runs again. Whirr, whirr, whirr… CLACK! Then Father calls: “David!”`,
    `יום אחד, אריה קופץ וחוטף טלה! דוד רץ אחריו, ומציל את הטלה מפיו. יום אחר, דוב. ודוד רץ שוב. ווּשׁ, ווּשׁ, ווּשׁ… טַק! ואז אבא קורא: "דוד!"`,
  ),
};

const p3: Page = {
  id: "p3",
  plateId: "PL3",
  hero: heroOf("p3", "look-up"),
  phoneCrop: G.pages.p3?.phoneCrop,
  text: same(
    `“Take this bread to your brothers,” says Father. So David walks to the valley of Elah. Across the brook stands a giant. Goliath! Big as a tree. “GIVE ME A MAN, AND WE WILL FIGHT!” All the soldiers run.`,
    `"קח את הלחם הזה לאחים שלך," אומר אבא. ודוד הולך אל עמק האלה. מעבר לנחל עומד ענק. גָּלְיָת! גבוה כמו עץ. "תְּנוּ־לִי אִישׁ וְנִלָּחֲמָה יָחַד!" וכל החיילים בורחים.`,
  ),
};

const p4: Page = {
  id: "p4",
  plateId: "PL4",
  hero: heroOf("p4", "look-up"),
  phoneCrop: G.pages.p4?.phoneCrop,
  text: same(
    `“I will go,” says David. King Saul looks down at him. “You are only a boy.” “A lion came,” says David. “A bear came. I ran after them. I saved the lamb.” Saul is quiet. He points to his armour.`,
    `"אני אלך," אומר דוד. שאול המלך מביט בו מלמעלה. "אתה רק נער." "בא אריה," אומר דוד. "בא דוב. רדפתי אחריהם, והצלתי את הטלה." שאול שותק. ואז מצביע על השריון שלו.`,
  ),
};

const p5: Page = {
  id: "p5",
  plateId: "PL4",
  type: "spread",
  hero: heroOf("p5", "worried"),
  phoneCrop: G.pages.p5?.phoneCrop,
  text: same(
    `Here is the king's armour: a bronze helmet, a heavy coat of mail, a sword. Here is David's own staff, his own sling. He has never tried the armour. Not once. Outside, the giant shouts again. What will David do?`,
    `הנה כלי המלחמה של המלך: כובע נחושת, שריון כבד וחרב. והנה המקל של דוד, והקלע שלו. את כלי המלך הוא עוד לא ניסה. אף פעם. בחוץ, הענק צועק שוב. מה יעשה דוד?`,
  ),
};

// ── Branch A — HARD: "Go as I am" (1 page) ────────────────────────────────────
const p6a: Page = {
  id: "p6a",
  plateId: "PL3",
  hero: heroOf("p6a", "run-staff"),
  phoneCrop: G.pages.p6a?.phoneCrop,
  text: same(
    `David looks at the helmet, the coat, the sword. “I cannot go with these,” he says, “for I have not tried them.” He takes his own staff and sling. No helmet? No sword? His heart thumps. His feet are light.`,
    `דוד מביט בכובע, בשריון, בחרב. "לֹא אוּכַל לָלֶכֶת בָּאֵלֶּה, כִּי לֹא נִסִּיתִי," הוא אומר. הוא לוקח את המקל שלו, את הקלע שלו. בלי כובע? בלי חרב? הלב דופק חזק. אבל הרגליים קלות.`,
  ),
};

// ── Branch B — EASY: "Wear the king's armour" (2 pages) ───────────────────────
const armourOverlays = (pageId: string): PageOverlay[] => [overlay(pageId, "helmet"), overlay(pageId, "sword")];

const p6b: Page = {
  id: "p6b",
  plateId: "PL4e",
  hero: heroOf("p6b", "armour-stuck"),
  phoneCrop: G.pages.p6b?.phoneCrop,
  overlays: armourOverlays("p6b"),
  text: same(
    `On goes the bronze helmet. On goes the heavy coat. On goes the sword. David takes one step. Clank. Another. CLANK! He cannot run. He cannot lift his arm to swing the sling. He has never tried these. Not once.`,
    `כובע הנחושת, על הראש. השריון הכבד, על הגוף. החרב, על המותן. דוד עושה צעד. קְלַנְק. ועוד צעד. קְלַנְק! הוא לא יכול לרוץ, לא יכול להרים יד לקלע. את אלה לא ניסה. אף פעם.`,
  ),
};

const p7b: Page = {
  id: "p7b",
  plateId: "PL4e",
  hero: heroOf("p7b", "armour-stuck"),
  phoneCrop: G.pages.p7b?.phoneCrop,
  overlays: armourOverlays("p7b"),
  text: same(`“I cannot go with these,” says David, “for I have not tried them.”`, `"לֹא אוּכַל לָלֶכֶת בָּאֵלֶּה, כִּי לֹא נִסִּיתִי," אומר דוד.`),
  repair: {
    promptLabel: { en: `Take it off`, he: `להוריד` },
    items: [
      { id: "helmet", overlay: "helmet", label: { en: `the helmet`, he: `הכובע` }, ...itemAt("p7b", "helmet", { x: 0.5, y: 0.54 }), line: same(`Off comes the helmet.`, `הכובע יורד.`) },
      { id: "coat", label: { en: `the coat`, he: `השריון` }, ...itemAt("p7b", "coat", { x: 0.5, y: 0.76 }), line: same(`Off comes the coat.`, `השריון יורד.`) },
      { id: "sword", overlay: "sword", label: { en: `the sword`, he: `החרב` }, ...itemAt("p7b", "sword", { x: 0.6, y: 0.9 }), line: same(`Off comes the sword.`, `החרב יורדת.`) },
    ],
    textAfter: same(`David stretches. Light again! With his own sling, he runs to the brook.`, `דוד מתמתח. קל שוב! ועם הקלע שלו, הוא רץ אל הנחל.`),
    heroAfter: afterOf("p7b", "free-stretch"),
  },
};

// ── Branch C — THIRD: "Wait for a soldier" (2 pages) ──────────────────────────
const p6c: Page = {
  id: "p6c",
  plateId: "PL3w",
  hero: heroOf("p6c", "sit"),
  phoneCrop: G.pages.p6c?.phoneCrop,
  text: same(
    `David sits and waits for a soldier. One soldier stares at his own feet. One hides behind his shield. “GIVE ME A MAN!” The shout is bigger now. The sun climbs higher. Nobody goes. David's knees shake more and more.`,
    `דוד יושב ומחכה שחייל ילך. חייל אחד מסתכל על הרגליים שלו. חייל אחר מתחבא מאחורי המגן. "תְּנוּ־לִי אִישׁ!" הצעקה גדלה. השמש עולה גבוה. אף אחד לא הולך. והברכיים של דוד רועדות, עוד ועוד.`,
  ),
};

const p7c: Page = {
  id: "p7c",
  plateId: "PL3w",
  hero: heroOf("p7c", "sit"),
  phoneCrop: G.pages.p7c?.phoneCrop,
  text: same(`Nobody. Not one.`, `אף אחד. אפילו לא אחד.`),
  repair: {
    promptLabel: { en: `Stand up!`, he: `לקום!` },
    items: [{ id: "stand", label: { en: `Stand up!`, he: `לקום!` }, ...itemAt("p7c", "stand", { x: 0.78, y: 0.74 }) }],
    textAfter: same(
      `Then David stands up tall. If nobody goes, David will go. He grips his staff and his sling. His knees still shake. He goes anyway, down to the brook.`,
      `ואז דוד קם, זקוף. אם אף אחד לא הולך, דוד ילך. הוא אוחז במקל ובקלע. הברכיים עוד רועדות. והוא הולך בכל זאת, אל הנחל.`,
    ),
    heroAfter: afterOf("p7c", "run-staff"),
  },
};

// ── Rejoin, climax, ending ────────────────────────────────────────────────────
const p8: Page = {
  id: "p8",
  plateId: "PL6",
  hero: heroOf("p8", "kneel"),
  phoneCrop: G.pages.p8?.phoneCrop,
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

const p9: Page = {
  id: "p9",
  plateId: "PL7",
  type: "spread",
  hero: heroOf("p9", "sling-swing"),
  phoneCrop: G.pages.p9?.phoneCrop,
  // The dust cloud hides the giant after BOOM; no body is ever shown.
  overlays: [overlay("p9", "dust", { reveal: "afterNarration" })],
  text: same(
    `“You come to me with a sword and a spear,” says David. “I come to you in the name of God.” David runs toward the giant. One stone. Whirr, whirr, whirr… The stone flew. The giant fell. BOOM.`,
    `"אַתָּה בָּא אֵלַי בְּחֶרֶב וּבַחֲנִית וּבְכִידוֹן," אומר דוד. "וַאֲנִי בָּא אֵלֶיךָ בְּשֵׁם אֱלֹהִים." דוד רץ לקראת הענק. אבן אחת. ווּשׁ, ווּשׁ, ווּשׁ… האבן עפה. הענק נפל. בּוּם.`,
  ),
};

const p10: Page = {
  id: "p10",
  plateId: "PL1d",
  type: "spread",
  hero: heroOf("p10", "sit"),
  phoneCrop: G.pages.p10?.phoneCrop,
  text: same(
    `Then, quiet. That evening, David sits with his sheep on the hill. Baa. Four smooth stones in his bag. Tomorrow? A hundred times again.`,
    `ואז, שקט. בערב, דוד יושב עם הכבשים על הגבעה. מֶההה. ארבע אבנים חלקות בילקוט. מחר? שוב מאה פעמים.`,
  ),
  echo: {
    a: same(`His own staff. His own sling. All tried.`, `המקל שלו. הקלע שלו. את כולם ניסה.`),
    b: same(`The king's armour? One day, after a hundred tries.`, `ושריון המלך? אולי יום אחד, אחרי מאה ניסיונות.`),
    c: same(`Next time a giant shouts, David won't wait.`, `בפעם הבאה שענק יצעק, דוד לא יחכה.`),
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
  coverLine: { en: `A shepherd, a sling, and a giant as big as a tree.`, he: `רועה, קלע, וענק גבוה כמו עץ.` },
  coverNameLine: { en: `{name} as David`, he: `{name} בתפקיד דוד` },
  sourceRef: "1 Samuel 17:12-50",
  knowledge:
    "What you practise in small dangers is what you can bring to the big one; borrowed armour, however royal, does not fit; and when the strong freeze, the small one who has practised steps forward of their own will.",
  childRole: "CAST (BR2) — the child is David, a youth in the text (17:33, 17:42); play frame on the first and last pages.",
  additions: [
    "the play frame",
    "Bun (painted, neutral)",
    "the olive-tree target David practises on",
    "\"a hundred times a day\"",
    "the path where David waits (in the text the army waited forty days, 17:16; David did not)",
    "staging: the armour waits on a stand (in the text Saul dresses David himself, 17:38)",
    "omitted: 17:25-27 (the reward), 17:28-30 (Eliab's anger), 17:43-44 and 17:46-47 (curses), 17:50-58 (after the fall)",
  ],
  ageBand: "4-7",
  cover,
  pages: [p1, p2, p3, p4, p5, p8, p9, p10],
  decision: {
    pageId: "p5",
    choices: [
      { id: "a", type: "hard", label: { en: `Go as I am`, he: `ללכת כמו שאני` }, branch: [p6a] },
      { id: "b", type: "easy", label: { en: `Wear the king's armour`, he: `ללבוש את השריון של המלך` }, branch: [p6b, p7b] },
      { id: "c", type: "third", label: { en: `Wait for a soldier`, he: `לחכות שחייל ילך` }, branch: [p6c, p7c] },
    ],
  },
  rejoinPageId: "p8",
  parent: {
    builds: {
      en: `Courage that has been practised. David faces the giant with what he has tried a hundred times, not with the king's armour. When the strong freeze, the one who practised steps forward.`,
      he: `אומץ שמתאמנים בו. דוד יוצא אל הענק עם מה שניסה מאה פעמים, ולא עם השריון של המלך. כשהגדולים קופאים, מי שהתאמן יוצא קדימה.`,
    },
    why: {
      en: `The choice is the Bible's own: David put on the king's armour and took it off, "for I have not tried them" (1 Sam 17:39). Every path reaches the brook with what is his; each leaves a different memory. Nothing is scored.`,
      he: `הבחירה לקוחה מהמקרא עצמו: דוד לבש את שריון המלך והסיר אותו, "כִּי לֹא נִסִּיתִי" (שמואל א׳ יז, לט). כל דרך מגיעה אל הנחל עם מה ששלו, וכל אחת משאירה זיכרון אחר. שום דבר לא נמדד.`,
    },
    askAfter: same(`What did David take to the giant, and why not the king's armour?`, `מה דוד לקח איתו אל הענק, ולמה לא את השריון של המלך?`),
    askAfterOptional: {
      en: `What have you practised so many times that you could do it even when you're scared?`,
      he: {
        m: `מה תרגלת כל כך הרבה פעמים, שהיית מצליח לעשות את זה גם כשאתה מפחד?`,
        f: `מה תרגלת כל כך הרבה פעמים, שהיית מצליחה לעשות את זה גם כשאת מפחדת?`,
      },
    },
    sourceNote: {
      en: `1 Samuel 17:12–50, told in short. Quoted: 17:10, 17:39, 17:40, and the first half of 17:45. "In the name of God" is David's own claim (17:45), said here in plain words. Left out for young children: the king's reward (17:25), Eliab's anger (17:28), Goliath's curses (17:43–44), and everything after the giant falls. In the Bible, Goliath dies (17:50–51). Added: the play frame, Bun, the olive-tree target, "a hundred times a day", and the path where David waits (in the Bible the army waited forty days, 17:16, but David did not). The "armour" path tells it exactly as the Bible does; in the Bible Saul dresses David himself.`,
      he: `שמואל א׳ יז, יב–נ, בקיצור. מצוטטים: יז, י; יז, לט; יז, מ; ותחילת יז, מה. "בשם אלוהים" הם דברי דוד עצמו (יז, מה), במילים פשוטות. הושמטו לילדים צעירים: שכר המלך (יז, כה), כעס אליאב (יז, כח), קללות גלית (יז, מג–מד) וכל מה שאחרי נפילת הענק: במקרא גלית מת (יז, נ–נא). נוספו: מסגרת המשחק, ארנבוני, עץ הזית שבו דוד מתאמן, "מאה פעמים ביום", והדרך שבה דוד מחכה (במקרא הצבא חיכה ארבעים יום, יז, טז, אבל דוד לא). דרך "השריון" מספרת בדיוק כמו המקרא; שם שאול עצמו מלביש את דוד.`,
    },
  },
};
