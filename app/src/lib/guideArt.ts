import type { DomainId } from "./domains/registry";
import type { UiLang } from "./i18n";
import type { LearnCategoryId } from "../learn/learnLibrary";
import { normalizeSearchText } from "./searchNormalize";

/**
 * VIS-05 — guide illustrations for the v3 Now guide card (11 Oct 2026).
 *
 * Twelve topics, one wide picture each: a painterly still life of household
 * objects in the together-table style (public/visuals/companion/README.md).
 * Style brief: public/visuals/guides/README.md. Prompt, model and review per
 * picture: docs/design/guide-art-v1.json at the repo root.
 *
 * RULES
 *  - Objects only: never a person, a face, a hand, an animal with a face, a
 *    letter, a number or a logo, so a picture can never read as the family's
 *    own moment or as evidence about a child. Never derived from a family
 *    photo or from the hero avatar; prompts are text-only.
 *  - No text in any picture, so one file serves EN and HE; the alt text
 *    carries the words, in both languages, and names objects only.
 *  - 16:9 at 960x540 and 480x270 WebP, each at most 120 KB. The inline-start
 *    45% is the calm title area; in RTL the consumer mirrors the picture with
 *    CSS, so nothing in it may be directional or handed.
 *  - A topic ships only when its two files, its provenance record (status
 *    "shipped") and its entry in GUIDE_ART_SHIPPED land together. Until then
 *    guideArtFor returns undefined and the card keeps its own face (shapes
 *    and medallion), never a broken image. guideArt.guard.test.ts holds the
 *    files, this registry and the provenance together.
 */

export const GUIDE_TOPICS = [
  "mornings",
  "drop-off",
  "big-feelings",
  "sharing",
  "bedtime",
  "screens",
  "meals",
  "tidy-up",
  "siblings",
  "new-words",
  "outdoor-play",
  "calm-corner",
] as const;

export type GuideTopic = (typeof GUIDE_TOPICS)[number];

export interface GuideTopicDef {
  /** The parent-facing areas this guide speaks to (lib/domains/registry). Metadata, not a lookup key. */
  domains: readonly DomainId[];
  /** The ready-made routine this topic pictures (lib/routines.ts), when there is one. */
  routineId?: string;
  /** What the picture shows: objects only, in plain words, in both languages. */
  alt: { en: string; he: string };
}

export const GUIDE_ART: Readonly<Record<GuideTopic, GuideTopicDef>> = {
  mornings: {
    domains: ["hands", "family"],
    routineId: "morning",
    alt: {
      en: "A breakfast table in morning light with a small backpack by the chair",
      he: "שולחן ארוחת בוקר באור הבוקר, ותיק גב קטן ליד הכיסא",
    },
  },
  "drop-off": {
    domains: ["feelings", "family"],
    routineId: "goodbye",
    alt: {
      en: "Two coats on low hooks beside an open front door",
      he: "שני מעילים על ווים נמוכים ליד דלת כניסה פתוחה",
    },
  },
  "big-feelings": {
    domains: ["feelings"],
    alt: {
      en: "A soft cushion, a blanket and picture cards on a rug",
      he: "כרית רכה, שמיכה וכרטיסי תמונות על שטיח",
    },
  },
  sharing: {
    domains: ["playing", "feelings"],
    alt: {
      en: "Two cups and one bowl of fruit on a low table",
      he: "שתי כוסות וקערת פירות אחת על שולחן נמוך",
    },
  },
  bedtime: {
    domains: ["body", "family"],
    routineId: "bedtime",
    alt: {
      en: "A night light, a picture book and a folded blanket",
      he: "מנורת לילה, ספר תמונות ושמיכה מקופלת",
    },
  },
  screens: {
    domains: ["family", "thinking"],
    routineId: "screens",
    alt: {
      en: "A tablet lying screen down beside building blocks",
      he: "טאבלט מונח עם המסך כלפי מטה, ליד קוביות בנייה",
    },
  },
  meals: {
    domains: ["body", "family"],
    routineId: "meal",
    alt: {
      en: "A family table set with small plates and a jug",
      he: "שולחן משפחתי ערוך עם צלחות קטנות וקנקן",
    },
  },
  "tidy-up": {
    domains: ["hands", "thinking"],
    routineId: "tidy",
    alt: {
      en: "A toy basket half full beside a few scattered blocks",
      he: "סל צעצועים מלא עד חציו, ולידו כמה קוביות מפוזרות",
    },
  },
  siblings: {
    domains: ["family", "playing"],
    alt: {
      en: "Two pairs of shoes, one big and one small, by the door",
      he: "שני זוגות נעליים, אחד גדול ואחד קטן, ליד הדלת",
    },
  },
  "new-words": {
    domains: ["talking"],
    alt: {
      en: "Open picture cards and a small chalkboard with no writing",
      he: "כרטיסי תמונות פרושים ולוח גיר קטן בלי כתב",
    },
  },
  "outdoor-play": {
    domains: ["moving", "playing"],
    alt: {
      en: "A ball, a bucket and boots on grass",
      he: "כדור, דלי ומגפיים על הדשא",
    },
  },
  "calm-corner": {
    domains: ["feelings"],
    routineId: "calm",
    alt: {
      en: "A tent of cloth over cushions with a breathing ribbon",
      he: "אוהל בד מעל כריות, עם סרט לתרגול נשימה",
    },
  },
};

/**
 * The topics whose two files are on disk. Empty until the art is approved and
 * made (image-model spend or a commission, Guy's call): add a topic here in
 * the same commit as its files and its provenance record.
 */
export const GUIDE_ART_SHIPPED: ReadonlySet<GuideTopic> = new Set<GuideTopic>([]);

export const GUIDE_ART_DIR = "/visuals/guides";
export const GUIDE_ART_WIDTHS = [480, 960] as const;
export const GUIDE_ART_SIZE = { width: 960, height: 540 } as const;

export interface GuideArt {
  /** The 960x540 file; srcSet offers the 480x270 one to narrow slots. */
  src: string;
  srcSet: string;
  width: number;
  height: number;
  alt: string;
}

/** Both files of a topic, smallest first, as the app requests them. */
export function guideArtFiles(topic: GuideTopic): string[] {
  return GUIDE_ART_WIDTHS.map((w) => `${GUIDE_ART_DIR}/${topic}-${w}.webp`);
}

/**
 * The picture for a topic in the reader's language, or undefined when the
 * topic has no shipped art (or there is no topic): the caller then keeps its
 * own face, never a broken image.
 */
export function guideArtFor(
  topic: GuideTopic | null | undefined,
  lang: UiLang,
  shipped: ReadonlySet<GuideTopic> = GUIDE_ART_SHIPPED,
): GuideArt | undefined {
  if (!topic || !shipped.has(topic)) return undefined;
  const [small, large] = guideArtFiles(topic);
  return {
    src: large,
    srcSet: `${small} 480w, ${large} 960w`,
    width: GUIDE_ART_SIZE.width,
    height: GUIDE_ART_SIZE.height,
    alt: lang === "he" ? GUIDE_ART[topic].alt.he : GUIDE_ART[topic].alt.en,
  };
}

/* ── Which guide a question, routine or Learn shelf belongs to ───────────── */

const ROUTINE_TOPIC: ReadonlyMap<string, GuideTopic> = new Map(
  GUIDE_TOPICS.flatMap((topic) => {
    const routineId = GUIDE_ART[topic].routineId;
    return routineId ? [[routineId, topic] as const] : [];
  }),
);

const LEARN_CATEGORY_TOPIC: ReadonlyMap<LearnCategoryId, GuideTopic> = new Map<LearnCategoryId, GuideTopic>([
  ["feelings", "big-feelings"],
  ["behavior", "big-feelings"],
  ["language", "new-words"],
  ["sleep", "bedtime"],
  ["screens", "screens"],
  ["eating", "meals"],
  ["motion", "outdoor-play"],
]);

/**
 * Words that name each topic, in match order: the first topic that matches
 * wins, and the situation comes before the feeling ("tears at drop-off" is a
 * drop-off guide). Each list is one string, words split by "|".
 *
 *  - A word matches at the start of a word in the question, so endings are
 *    free; a trailing $ asks for the whole word. A phrase matches word by word.
 *  - A Hebrew word also matches behind up to three attached particles
 *    (ו ה ב ל מ ש כ), so "בגן" finds "גן".
 *  - `other` lists phrases in which one of the topic's words means something
 *    else ("לא מסכים" is "will not agree", not "screens"; "גן שעשועים" is a
 *    playground, not a kindergarten). They are blanked before that topic is
 *    tried, so a later topic can still claim them.
 *  - Both languages are always tried: a question is written in its own
 *    language, whatever the app's language.
 */
interface TopicWords {
  en: string;
  he: string;
  other?: string;
}

const TOPIC_WORDS: ReadonlyArray<readonly [GuideTopic, TopicWords]> = [
  ["drop-off", {
    en: "drop off|dropoff|dropping off|daycare|day care|nursery|preschool|pre school|kindergarten|goodbye|good bye|separation|school gate|childminder|nanny|babysit",
    he: "פרידה|פרידות|פרידת|להיפרד|גן$|גנון|מעון|צהרון|גננת|פעוטון|מטפלת|בייביסיטר",
    other: "nursery rhyme|drop off to sleep|drops off to sleep|dropping off to sleep|גן שעשועים|גן חיות",
  }],
  ["siblings", {
    en: "sibling|brother|sister|new baby|twin$|twins$",
    he: "אחים|אחיות|אחותי|אחותו|אחותה|אחות קטנה|אחות גדולה|אחות חדשה|אח$|אחי$|אחיו$|אחיה$|תינוק חדש|תינוקת חדשה|תאומים|תאומות",
  }],
  ["screens", {
    en: "screen|tablet|ipad|tv$|television|phone$|phones$|smartphone|youtube|cartoon|video|device",
    he: "מסך$|מסכים$|טלוויזיה|טלויזיה|טאבלט|אייפד|טלפון|פלאפון|סמארטפון|יוטיוב|סרטון|סרטים|מחשב$|מחשבים$|משחקי מחשב",
    other: "screening|לא מסכים$|אינו מסכים$|ממש מסכים$",
  }],
  ["bedtime", {
    en: "bed|sleep|asleep|nap$|naps$|napping|naptime|night|lullab",
    he: "שינה|לישון|להירדם|נרדם|לילה|לילות|מיטה|מיטת|השכבה|להשכיב|תנומה|תנומות|סיוט|חלום",
  }],
  ["mornings", {
    en: "morning|breakfast|get dressed|gets dressed|getting dressed|out the door|wake|waking|woke",
    he: "בוקר|בקרים|להתלבש|התלבשות|מתלבש|להשכים|השכמה|להתעורר|מתעורר",
  }],
  ["meals", {
    en: "meal|eat|food|dinner|lunch|snack|picky|vegetable|veggie|high chair|table manners",
    he: "ארוחה|ארוחות|ארוחת|אוכל|לאכול|אכילה|בררן|ירקות|צלחת|חטיף|כיסא אוכל",
  }],
  ["tidy-up", {
    en: "tidy|tidied|tidies|clean up|cleanup|cleaning up|put away|putting away|pack away|packing away|mess$|messy|messes$|chore",
    he: "לסדר|מסדר|סידור|בלגן|מבולגן|לנקות|ניקיון|לאסוף",
  }],
  ["sharing", {
    en: "share|sharing|take turns|taking turns|turn taking|grab|snatch|mine$",
    he: "שיתוף|לשתף|משתף|לחלוק|תורות|לחכות לתור|לחכות בתור|חוטף|לחטוף|חטף",
  }],
  ["new-words", {
    en: "word|vocabulary|speech|speak|language|babbl|naming|pronounc|bilingual|talker|not talking|start talking|started talking|starting to talk",
    he: "מילה|מילים|מילות|דיבור|שפה$|שפות|הגייה|דו לשוני|לא מדבר|מתחיל לדבר|מתחילה לדבר|התחיל לדבר|התחילה לדבר",
    other: "in other words|מילים אחרות|ברית מילה",
  }],
  ["outdoor-play", {
    en: "outdoor|outside|park$|parks$|playground|garden|nature|bike|scooter|sandbox|sandpit|climb|fresh air|mud$|muddy|ball$|balls$",
    he: "בחוץ$|החוצה$|פארק|גינה|גינת|גינות|גן שעשועים|גן חיות|טבע$|אופניים|אופנים|קורקינט|מגלשה|מגלשות|נדנדה|נדנדות|טיול|ארגז חול|בוץ$|כדורגל|לשחק בכדור|משחקי כדור|לטפס|טיפוס",
  }],
  ["big-feelings", {
    en: "tantrum|meltdown|feeling|emotion|angry|anger|upset|cry|cries|cried|scream|yell|frustrat|hit$|hits$|hitting|bite|biting|kick|whin|jealous|fear|afraid|scared",
    he: "התקף|זעם|כעס|כועס|כעוס|רגש|בכי|בוכה|בוכים|צורח|צרחות|צועק|צעקות|מרביץ|להרביץ|נושך|נשיכה|נשיכות|תסכול|מתוסכל|עצב|עצוב|פחד|פוחד|מתפרץ|התפרצות|קנא",
  }],
  ["calm-corner", {
    en: "calm|breath|quiet corner|quiet time|settl|sooth|regulat|relax|cool down|wind down|mindful",
    he: "רגוע|להירגע|נרגע|הרגעה|להרגיע|מרגיע|רגיעה|נשימה|נשימות|לנשום|שקט",
  }],
];

/** Lower-cased, niqqud-free, final letters folded; words only. */
const words = (text: string): string[] =>
  normalizeSearchText(text).split(/[^a-z0-9א-ת]+/).filter(Boolean);

const HEBREW = /[א-ת]/;
const HE_PARTICLES = "[והבלמשכ]{0,3}";

/** One list word as a pattern over " word word " text (see TOPIC_WORDS). */
function wordPattern(word: string): string {
  const whole = word.endsWith("$");
  const body = words(whole ? word.slice(0, -1) : word).join(" ");
  return ` ${HEBREW.test(body) ? HE_PARTICLES : ""}${body}${whole ? " " : ""}`;
}

const listPattern = (...lists: string[]): RegExp =>
  new RegExp(lists.flatMap((list) => list.split("|")).map(wordPattern).join("|"));

const TOPIC_MATCHERS: ReadonlyArray<{ topic: GuideTopic; match: RegExp; other?: RegExp }> = TOPIC_WORDS.map(
  ([topic, list]) => ({
    topic,
    match: listPattern(list.en, list.he),
    other: list.other ? listPattern(list.other) : undefined,
  }),
);

/** The text with every `other` phrase blanked to a single space, one at a time. */
function blank(text: string, other: RegExp): string {
  let out = text;
  for (let before = ""; before !== out; ) {
    before = out;
    out = out.replace(other, " ");
  }
  return out;
}

/**
 * The guide topic for a routine, a question's own words, or a Learn shelf, in
 * that order; undefined when nothing matches, so the caller keeps its own face.
 */
export function guideTopicFor(input: {
  routineId?: string | null;
  title?: string | null;
  learnCategory?: LearnCategoryId | null;
}): GuideTopic | undefined {
  const byRoutine = input.routineId ? ROUTINE_TOPIC.get(input.routineId) : undefined;
  if (byRoutine) return byRoutine;
  if (input.title) {
    const text = ` ${words(input.title).join(" ")} `;
    for (const { topic, match, other } of TOPIC_MATCHERS) {
      if (match.test(other ? blank(text, other) : text)) return topic;
    }
  }
  return input.learnCategory ? LEARN_CATEGORY_TOPIC.get(input.learnCategory) : undefined;
}
