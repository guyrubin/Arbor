/**
 * B-DIST-01 — the sanitized demo family: one seed, three uses (sandbox drive,
 * institutional demo, store review).
 *
 * Every string here is INVENTED. No real person, no real child, no real
 * photo: the two moment photos are bundled app illustrations. The child's
 * name is the sandbox demo profile's (initialData.ts), the age is 3y2m, the
 * languages are Hebrew + English.
 *
 * P2A AGES (B-INF-10): a second child, Leni (22 months, a girl), with a small
 * toddler record of her own (`siblings[0]`: three word-moments, one bedtime
 * note, seven noticed milestones (B-LOOP-17), three words) — so every chooser can be driven
 * on two children of different bands and on the switch between them.
 *
 * What six weeks of an ordinary family record holds (counts are the item's):
 *   14 moments (2 with photos) · 3 hard moments (one "hard morning" that
 *   matches a pilot guide) · 10 milestones noticed + 1 "not sure" (B-LOOP-17) · 4 words written down
 *   (2 HE) · 2 accepted steps with outcomes (one "helped") · 1 Kid Mode
 *   session (practice events + one hero story) · 1 appointment with an
 *   after-visit note · server memory: 1 approved fact + 1 pending proposal.
 *
 * Pure and deterministic for a given `now`: the seed script
 * (scripts/seed-demo-family.mjs) prints it on a dry run and writes it on
 * --apply; the sandbox hydrator (lib/demoFamilyHydrate.ts) writes the same
 * documents into the SAME per-child storage keys useChildCollection reads.
 * Collections are a subset of CHILD_SUBCOLLECTIONS (lib/childData.ts), so the
 * Art. 15/20 export and Art. 17 erase cover every demo document.
 *
 * B-LOOP-17 (v2026-10-07.1) — THE LOOP'S SEEDED STATES. The milestone answers
 * are shelf-aware and every loop write goes through the app's own builders
 * (never an invented field):
 *   milestones  lib/milestones/observe `observeMilestoneDoc` — "yes" on ~60 %
 *               of the in-window rows of Words / Feelings / Play / Moving
 *               (Math.round(0.6 × n) per shelf), ONE "not_sure" in Hands, two
 *               feeding rows "yes", NOTHING on Sleep (the thin shelf);
 *   actionLoops lib/practice/choosePractice `practiceDoseEntry` — 9 practice
 *               dose rows over 14 days (source "practice", 6 "did" + 3 "not
 *               today", no Sleep practice, never today: the morning state
 *               finds today's practice pending);
 *   night       lib/loop/tonight `tonightOutcomeEntry` — 3 of the "did" rows
 *               carry Tonight's step-1 answer (helped · somewhat · helped)
 *               and its "What happened?" line (`tonightLineEntry`, v .2:
 *               yesterday's line is Today's line 1 — P5-LOOP c2 r1);
 *   keepsakes   lib/loop/tonight `quoteKeepsakeDoc` — 4 `quote` keepsakes
 *               ("Things {name} said", Tonight's step 2).
 * The one bedtime hard moment became a sibling conflict, so the Sleep shelf
 * holds zero entries of any kind. Leni (P2A) gets the lighter version.
 */
import type { BehaviorLog, ChildProfile, HeroJourneyRun, Milestone, PracticeEvent } from "../types";
import type { ActionLoopEntry, ActionOutcome } from "../actionLoop/model";
import type { Appointment, AppointmentFollowUp } from "../lib/careTrack";
import type { LangObservation } from "../growth/vocabAgg";
import { defaultChildProfile, initialMilestones } from "../initialData";
import { hardMomentCards } from "../content/hardMomentCards";
import { practicesForMilestone } from "../content/practices";
import { observeMilestoneDoc, type ObserveStatus } from "../lib/milestones/observe";
import { shelfOfMilestone } from "../lib/milestones/selectByShelf";
import { practiceDoseEntry, type PracticeAnswer } from "../lib/practice/choosePractice";
import { quoteKeepsakeDoc, tonightLineEntry, tonightOutcomeEntry } from "../lib/loop/tonight";
import type { KeepsakeDoc } from "../lib/firstsKeepsake";
import { resolveHebrewSlash } from "../lib/hebrewSlashGender";

export const DEMO_FAMILY_VERSION = "2026-10-07.2";
export const DEMO_FAMILY_LABEL = { en: "Demo family", he: "משפחת הדגמה" } as const;
/** The demo child IS the sandbox's synthetic child, so `npm run seed:demo` populates it. */
export const DEMO_CHILD_ID = defaultChildProfile.id;
/** P2A AGES (B-INF-10): the second demo child — a toddler, 22 months, "getting to two". */
export const DEMO_SIBLING_ID = "leni-demo";

export type DemoLang = "en" | "he";
type L = { en: string; he: string };
const L = (en: string, he: string): L => ({ en, he });

const DAY = 86_400_000;

/** The memory ledger half (server-side store, written through appendMemoryProposals / transitionMemory). */
export type DemoMemorySeed = {
  approved: { fact: string; source: string };
  pending: { fact: string; source: string };
  /** W2-CAREPRO c2 r1: distinct (non-paraphrase) pending facts on the SAME
   *  topic as `pending`, so the grouped review ("{n} similar · See all ·
   *  Dismiss all", B-CAREPRO-25) renders on the demo family, EN and HE. */
  pendingMore: { fact: string; source: string }[];
};

export type DemoFamily = {
  version: string;
  seededAt: string;
  lang: DemoLang;
  /** users/{uid} merge — the flag cohort readers and egress headers read. */
  parent: { demo: true; displayName: string };
  child: ChildProfile & { demo: true };
  /** Per-child subcollections: name → documents (each has an `id`). */
  collections: {
    behaviorLogs: BehaviorLog[];
    milestones: Milestone[];
    langObs: LangObservation[];
    actionLoops: ActionLoopEntry[];
    practiceEvents: PracticeEvent[];
    heroRuns: HeroJourneyRun[];
    appointments: Appointment[];
    apptFollowUps: AppointmentFollowUp[];
    /** B-LOOP-17: Tonight's `quote` keepsakes (the registered keepsakes collection). */
    keepsakes: KeepsakeDoc[];
  };
  memory: DemoMemorySeed;
  /** P2A AGES: the other children of the family, each with her own small record. */
  siblings: DemoSibling[];
};

/** A second child: her profile and her own per-child subcollections. */
export type DemoSibling = {
  child: ChildProfile & { demo: true };
  collections: {
    behaviorLogs: BehaviorLog[];
    milestones: Milestone[];
    langObs: LangObservation[];
    /** B-LOOP-17: her lighter loop — practice dose rows (one night answer). */
    actionLoops: ActionLoopEntry[];
    /** B-LOOP-17: one `quote` keepsake. */
    keepsakes: KeepsakeDoc[];
  };
};

/* ── invented record text ─────────────────────────────────────────────── */

const MOMENTS: { daysAgo: number; hour: number; text: L; context: BehaviorLog["context"]; photo?: string }[] = [
  { daysAgo: 1, hour: 18, text: L("Sang the whole bath song on his own", "שר לבד את כל שיר האמבטיה"), context: "Home" },
  { daysAgo: 2, hour: 8, text: L("Put his shoes on by himself before breakfast", "נעל לבד את הנעליים לפני ארוחת הבוקר"), context: "Home" },
  { daysAgo: 3, hour: 17, text: L("Built a tall tower and counted the blocks to five", "בנה מגדל גבוה וספר את הקוביות עד חמש"), context: "Home", photo: "/visuals/stories/v1/little-bridge-builders-v1-480.webp" },
  { daysAgo: 5, hour: 16, text: L("Shared the red car with a friend at the park", "נתן לחבר את המכונית האדומה בגן השעשועים"), context: "Public" },
  { daysAgo: 7, hour: 19, text: L("Asked for the moon story three times", "ביקש את סיפור הירח שלוש פעמים"), context: "Home" },
  { daysAgo: 9, hour: 13, text: L("Told the teacher about the bus in Hebrew", "סיפר לגננת על האוטובוס בעברית"), context: "School" },
  { daysAgo: 12, hour: 10, text: L("Watered the plants with the small can", "השקה את העציצים עם המזלף הקטן"), context: "Home" },
  { daysAgo: 15, hour: 17, text: L("Drew a circle and called it grandma's house", "צייר עיגול וקרא לו הבית של סבתא"), context: "Home", photo: "/visuals/stories/v1/lantern-path-v1-480.webp" },
  { daysAgo: 18, hour: 9, text: L("Waved goodbye at the door without a hug first", "נופף לשלום בדלת לפני החיבוק"), context: "School" },
  { daysAgo: 21, hour: 18, text: L("Helped set two spoons on the table", "עזר לשים שתי כפות על השולחן"), context: "Home" },
  { daysAgo: 25, hour: 16, text: L("Climbed the small ladder and slid down twice", "טיפס על הסולם הקטן וגלש פעמיים"), context: "Public" },
  { daysAgo: 29, hour: 19, text: L("Said 'good night, moon' in English", "אמר 'good night, moon' באנגלית"), context: "Home" },
  { daysAgo: 34, hour: 11, text: L("Fed the ducks and named each one", "האכיל את הברווזים ונתן לכל אחד שם"), context: "Public" },
  { daysAgo: 39, hour: 17, text: L("Finished a puzzle of the farm on his own", "סיים לבד פאזל של החווה"), context: "Home" },
];

const HARD: { daysAgo: number; hour: number; type: string; trigger: L; response: L; intensity: number; minutes: number; context: BehaviorLog["context"] }[] = [
  // The "hard morning": a Transition Refusal on the way out, which the pilot guide shelf matches.
  { daysAgo: 2, hour: 7, type: "Transition Refusal", trigger: L("leaving for kindergarten", "יציאה לגן"), response: L("gave a two-minute heads-up and carried his bag together", "נתתי התראה של שתי דקות ונשאנו את התיק יחד"), intensity: 3, minutes: 12, context: "Home" },
  // B-LOOP-17: was a bedtime meltdown — the Sleep shelf is the thin shelf (zero entries).
  { daysAgo: 10, hour: 17, type: "Sibling Conflict", trigger: L("Leni knocked over his block tower", "לני הפילה לו את מגדל הקוביות"), response: L("named the anger and we built the base again together", "קראנו בשם לכעס ובנינו יחד את הבסיס מחדש"), intensity: 2, minutes: 8, context: "Home" },
  { daysAgo: 23, hour: 17, type: "Screentime Dispute", trigger: L("tablet turned off", "כיבוי הטאבלט"), response: L("sat next to him until he was calm", "ישבתי לידו עד שנרגע"), intensity: 3, minutes: 10, context: "Home" },
];

const WORDS: { daysAgo: number; language: string; phrase: string }[] = [
  { daysAgo: 4, language: "English", phrase: "moon" },
  { daysAgo: 11, language: "Hebrew", phrase: "כדור" },
  { daysAgo: 20, language: "English", phrase: "more juice" },
  { daysAgo: 31, language: "Hebrew", phrase: "עוד פעם" },
];

const STEPS: { daysAgo: number; text: L; outcome: ActionLoopEntry["outcome"] }[] = [
  { daysAgo: 9, text: L("Give a two-minute heads-up before leaving the house", "לתת התראה של שתי דקות לפני היציאה מהבית"), outcome: "helped" },
  { daysAgo: 4, text: L("Read the last page with the night light on", "לקרוא את העמוד האחרון עם מנורת הלילה"), outcome: "somewhat" },
];

/* ── B-LOOP-17: the loop's record ─────────────────────────────────────────
   Milestone answers per shelf (catalogue ids; the shelf comes from the
   registry, the in-window share is asserted by the guard), the 14-day
   practice dose log with Tonight's three night answers, and the quotes. */

type LoopAnswer = { id: string; status: ObserveStatus; daysAgo: number };
/** Dylan (38 months, window 30–36 m): Words 4 of 7 · Feelings 1 of 1 · Play 2 of 3 ·
 *  Moving 1 of 1 · Hands one "not sure" · two feeding rows · Sleep nothing. */
const LOOP_ANSWERS: LoopAnswer[] = [
  { id: "cdc-30m-4", status: "yes", daysAgo: 33 },
  { id: "cdc-30m-5", status: "yes", daysAgo: 22 },
  { id: "cdc-36m-4", status: "yes", daysAgo: 11 },
  { id: "cdc-36m-5", status: "yes", daysAgo: 4 },
  { id: "cdc-36m-1", status: "yes", daysAgo: 5 },
  { id: "cdc-30m-1", status: "yes", daysAgo: 26 },
  { id: "cdc-30m-2", status: "yes", daysAgo: 14 },
  { id: "cdc-30m-10", status: "yes", daysAgo: 3 },
  { id: "cdc-36m-10", status: "not_sure", daysAgo: 6 },
  { id: "cdc-36m-11", status: "yes", daysAgo: 7 },
  { id: "asha-feed-24m", status: "yes", daysAgo: 30 },
];

type LoopDose = { daysAgo: number; milestoneId: string; answer: PracticeAnswer; night?: Exclude<ActionOutcome, "not_today">; what?: L };
/** Nine dose rows over 14 days, never today, never the Sleep shelf; three night answers. */
const LOOP_DOSES: LoopDose[] = [
  { daysAgo: 1, milestoneId: "cdc-36m-3", answer: "did", night: "helped", what: L("He told me the whole big-slide story twice, and I just listened", "הוא סיפר לי פעמיים את כל הסיפור על המגלשה הגדולה, ורק הקשבתי") },
  { daysAgo: 2, milestoneId: "cdc-30m-11", answer: "not_today" },
  { daysAgo: 3, milestoneId: "cdc-36m-2", answer: "did" },
  { daysAgo: 5, milestoneId: "cdc-36m-7", answer: "did", night: "somewhat", what: L("He drew a big round sun and called it Mummy", "הוא צייר שמש עגולה וגדולה וקרא לה אמא") },
  { daysAgo: 6, milestoneId: "cdc-30m-10", answer: "not_today" },
  { daysAgo: 8, milestoneId: "cdc-36m-1", answer: "did", night: "helped", what: L("Short goodbye at the gate; he waved from the window", "פרידה קצרה בשער; הוא נופף מהחלון") },
  { daysAgo: 10, milestoneId: "cdc-36m-11", answer: "did" },
  { daysAgo: 12, milestoneId: "cdc-30m-3", answer: "not_today" },
  { daysAgo: 14, milestoneId: "cdc-36m-9", answer: "did" },
];

/** Tonight's step 2 answers — "Things Dylan said" (invented). */
const LOOP_QUOTES: { daysAgo: number; text: L }[] = [
  { daysAgo: 1, text: L("I did it all by my own self!", "עשיתי את זה לגמרי לבד!") },
  { daysAgo: 4, text: L("Leni is my baby. I take care of her.", "לני היא התינוקת שלי. אני שומר עליה.") },
  { daysAgo: 9, text: L("The bus says beep beep, not moo.", "האוטובוס עושה ביפ ביפ, לא מו.") },
  { daysAgo: 13, text: L("When I'm big I will reach the top shelf.", "כשאהיה גדול אגיע למדף העליון.") },
];

/** Leni (22 months, window 15–18 m), the lighter version: Words 2 of 4 · Play 3 of 5 ·
 *  Moving 1 of 2 · one feeding row · three dose rows (one night answer) · one quote. */
const LENI_ANSWERS: LoopAnswer[] = [
  { id: "cdc-15m-3", status: "yes", daysAgo: 12 },
  { id: "cdc-18m-4", status: "yes", daysAgo: 3 },
  { id: "cdc-15m-1", status: "yes", daysAgo: 13 },
  { id: "cdc-18m-1", status: "yes", daysAgo: 6 },
  { id: "cdc-18m-2", status: "yes", daysAgo: 2 },
  { id: "cdc-15m-7", status: "yes", daysAgo: 10 },
  { id: "cdc-18m-9", status: "yes", daysAgo: 5 },
];
const LENI_DOSES: LoopDose[] = [
  { daysAgo: 1, milestoneId: "cdc-18m-5", answer: "did", night: "helped", what: L("She brought me the sock and clapped for herself", "היא הביאה לי את הגרב ומחאה לעצמה כפיים") },
  { daysAgo: 3, milestoneId: "cdc-18m-3", answer: "not_today" },
  { daysAgo: 5, milestoneId: "cdc-18m-8", answer: "did" },
];
const LENI_QUOTES: { daysAgo: number; text: L }[] = [
  { daysAgo: 2, text: L("Uh-oh! Ball gone!", "אוי! כדור הלך!") },
];

const MEMORY: Record<DemoLang, DemoMemorySeed> = {
  en: {
    approved: { fact: "Settles faster at bedtime when the night light stays on for the last page.", source: "parent" },
    pending: { fact: "Mornings go smoother when his bag is packed the night before.", source: "coach conversation" },
    pendingMore: [
      { fact: "Puts his shoes on alone when the timer song plays.", source: "coach conversation" },
      { fact: "Brushing teeth goes better with the two-minute sand timer.", source: "coach conversation" },
      { fact: "The morning routine runs smoother with the picture chart by the door.", source: "coach conversation" },
    ],
  },
  he: {
    approved: { fact: "נרגע מהר יותר לפני השינה כשמנורת הלילה דולקת בעמוד האחרון.", source: "parent" },
    pending: { fact: "הבקרים עוברים בקלות יותר כשהתיק מוכן מהערב.", source: "coach conversation" },
    pendingMore: [
      { fact: "נועל נעליים לבד כששיר הטיימר מתנגן.", source: "coach conversation" },
      { fact: "צחצוח שיניים הולך טוב יותר עם שעון החול של שתי דקות.", source: "coach conversation" },
      { fact: "שגרת הבוקר זורמת יותר עם לוח התמונות ליד הדלת.", source: "coach conversation" },
    ],
  },
};

/* ── the toddler (P2A AGES): Leni, 22 months, a girl ─────────────────────
   A small toddler record, two weeks deep: three word-moments, one bedtime
   note, seven noticed milestones (B-LOOP-17). Every string invented. */
const LENI_MOMENTS: { daysAgo: number; hour: number; text: L; context: BehaviorLog["context"] }[] = [
  { daysAgo: 1, hour: 8, text: L("Said \"more\" at breakfast and pointed to the banana", "אמרה \"עוד\" בארוחת הבוקר והצביעה על הבננה"), context: "Home" },
  { daysAgo: 4, hour: 17, text: L("Called the dog \"woof\" at the park", "קראה לכלב \"הב הב\" בגן השעשועים"), context: "Public" },
  { daysAgo: 9, hour: 18, text: L("Said \"aba\" when the door opened", "אמרה \"אבא\" כשהדלת נפתחה"), context: "Home" },
  // the bedtime note
  { daysAgo: 2, hour: 20, text: L("Fell asleep after the same two songs, no crying", "נרדמה אחרי אותם שני שירים, בלי בכי"), context: "Home" },
];
const LENI_WORDS: { daysAgo: number; language: string; phrase: string }[] = [
  { daysAgo: 1, language: "English", phrase: "more" },
  { daysAgo: 4, language: "English", phrase: "woof" },
  { daysAgo: 9, language: "Hebrew", phrase: "אבא" },
];

function buildLeni(now: number, lang: DemoLang): DemoSibling {
  const pick = (text: L) => text[lang];
  const birth = new Date(now);
  birth.setUTCMonth(birth.getUTCMonth() - 22); // 22 months
  const child: ChildProfile & { demo: true } = {
    ...defaultChildProfile,
    id: DEMO_SIBLING_ID,
    name: "Leni",
    gender: "girl",
    age: 1,
    ageMonths: 22,
    birthDate: birth.toISOString().slice(0, 10),
    languages: ["Hebrew", "English"],
    schoolContext: lang === "he" ? "מעון יום, בוקר" : "Daycare, mornings",
    strengths: lang === "he" ? ["מחקה פרצופים", "אוהבת שירים"] : ["Copies faces", "Loves songs"],
    challenges: [],
    onboardingComplete: true,
    demo: true,
  };
  const behaviorLogs: BehaviorLog[] = LENI_MOMENTS.map((m, i): BehaviorLog => ({
    id: `demo-leni-moment-${i + 1}`,
    timestamp: at(now, m.daysAgo, m.hour),
    behaviorType: "Moment",
    durationMinutes: 0,
    trigger: pick(m.text),
    context: m.context,
  })).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  // B-LOOP-17: the lighter loop — seven answers across Words / Play / Moving / Food.
  const milestones: Milestone[] = answeredMilestones(now, LENI_ANSWERS);
  const langObs: LangObservation[] = LENI_WORDS.map((w, i) => ({ id: `demo-leni-word-${i + 1}`, timestamp: at(now, w.daysAgo, 18), language: w.language, phrase: w.phrase }));
  const actionLoops = doseRows(now, child.id, LENI_DOSES, lang, child.gender);
  const keepsakes = quoteDocs(now, LENI_QUOTES, lang);
  return { child, collections: { behaviorLogs, milestones, langObs, actionLoops, keepsakes } };
}

/* ── the builder ──────────────────────────────────────────────────────── */

const at = (now: number, daysAgo: number, hour: number) => {
  const d = new Date(now - daysAgo * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

/* B-LOOP-17: the loop's writes, each through the app's own builder. The
   hours are UTC 09/18/19, so a dose row's local-day id is the same day from
   UTC−9 to UTC+5 (the content hash is pinned; CI runs in UTC). */
const catalogueRow = (id: string): Milestone => {
  const row = initialMilestones.find((m) => m.id === id);
  if (!row) throw new Error(`B-LOOP-17: unknown catalogue milestone ${id}`);
  if (shelfOfMilestone(row) === "sleep") throw new Error(`B-LOOP-17: ${id} is a Sleep milestone — the Sleep shelf stays empty`);
  return row;
};

/** The milestone list with the parent's answers, through `observeMilestoneDoc` (THE write seam). */
function answeredMilestones(now: number, answers: readonly LoopAnswer[]): Milestone[] {
  const byId = new Map(answers.map((a) => [a.id, a]));
  for (const a of answers) catalogueRow(a.id);
  return initialMilestones.map((m) => {
    const a = byId.get(m.id);
    return a ? observeMilestoneDoc(m, a.status, { now: at(now, a.daysAgo, 18) }) : { ...m };
  });
}

/** The practice dose log (`practiceDoseEntry`), Tonight's step-1 answer where given (`tonightOutcomeEntry`). */
function doseRows(now: number, childId: string, doses: readonly LoopDose[], lang: DemoLang, gender: ChildProfile["gender"]): ActionLoopEntry[] {
  return doses
    .map((d) => {
      const milestone = catalogueRow(d.milestoneId);
      const practice = practicesForMilestone(d.milestoneId)[0];
      if (!practice || practice.shelf === "sleep") throw new Error(`B-LOOP-17: no non-Sleep practice for ${d.milestoneId}`);
      const say = lang === "he" ? resolveHebrewSlash(practice.say.he, gender) : practice.say.en;
      const row = practiceDoseEntry({ practice, milestone, shelf: practice.shelf }, d.answer, childId, say, new Date(at(now, d.daysAgo, 9)));
      if (!d.night) return row;
      const night = tonightOutcomeEntry(row, d.night, new Date(at(now, d.daysAgo, 19)));
      return (d.what && tonightLineEntry(night, lang === "he" ? d.what.he : d.what.en)) || night;
    })
    .sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));
}

/** Tonight's step-2 answers as `quote` keepsakes (`quoteKeepsakeDoc`). */
function quoteDocs(now: number, quotes: readonly { daysAgo: number; text: L }[], lang: DemoLang): KeepsakeDoc[] {
  return quotes.map((q) => {
    const doc = quoteKeepsakeDoc(q.text[lang], new Date(at(now, q.daysAgo, 18)));
    if (!doc) throw new Error("B-LOOP-17: an empty demo quote");
    return doc;
  });
}

export function buildDemoFamily({
  now = Date.now(),
  lang = "en" as DemoLang,
  childId = DEMO_CHILD_ID,
}: { now?: number; lang?: DemoLang; childId?: string } = {}): DemoFamily {
  const pick = (text: L) => text[lang];
  const birth = new Date(now);
  birth.setUTCMonth(birth.getUTCMonth() - 38); // 3 years 2 months

  const child: ChildProfile & { demo: true } = {
    ...defaultChildProfile,
    id: childId,
    age: 3,
    ageMonths: 38,
    birthDate: birth.toISOString().slice(0, 10),
    languages: ["Hebrew", "English"],
    schoolContext: lang === "he" ? "גן עירוני, שנה ראשונה" : "City kindergarten, first year",
    // P1-NEXTLEVEL critic r2 (profile P1): the time-bearing identity facts are
    // dated, so the sweep renders "as of {month}" in EN and HE.
    factsAsOf: { schoolContext: at(now, 36, 9), languages: at(now, 36, 9) },
    onboardingCompletedAt: at(now, 36, 9),
    strengths: lang === "he" ? ["משחקי דמיון", "אוהב לבנות ולספור"] : ["Pretend play", "Loves building and counting"],
    challenges: lang === "he" ? ["בקרים עם יציאה מהבית"] : ["Mornings when it is time to leave the house"],
    onboardingComplete: true,
    demo: true,
  };

  const behaviorLogs: BehaviorLog[] = [
    ...MOMENTS.map((m, i): BehaviorLog => ({
      id: `demo-moment-${i + 1}`,
      timestamp: at(now, m.daysAgo, m.hour),
      behaviorType: "Moment",
      // B-DATA-09: a plain moment stores no intensity.
      durationMinutes: 0,
      trigger: pick(m.text),
      context: m.context,
      ...(m.photo ? { photoAttachment: m.photo } : {}),
    })),
    ...HARD.map((h, i): BehaviorLog => ({
      id: `demo-hard-${i + 1}`,
      timestamp: at(now, h.daysAgo, h.hour),
      behaviorType: h.type,
      intensity: h.intensity,
      durationMinutes: h.minutes,
      trigger: pick(h.trigger),
      response: pick(h.response),
      context: h.context,
      resolved: true,
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // B-LOOP-17: the parent's answers, shelf by shelf (LOOP_ANSWERS), through the write seam.
  const milestones: Milestone[] = answeredMilestones(now, LOOP_ANSWERS);

  const langObs: LangObservation[] = WORDS.map((w, i) => ({ id: `demo-word-${i + 1}`, timestamp: at(now, w.daysAgo, 18), language: w.language, phrase: w.phrase }));

  const actionLoops: ActionLoopEntry[] = STEPS.map((s, i) => ({
    id: `demo-step-${i + 1}`,
    recommendation: pick(s.text),
    source: "today-guidance",
    capacity: "tiny",
    status: "completed",
    acceptedAt: at(now, s.daysAgo, 8),
    outcome: s.outcome,
    outcomeAt: at(now, s.daysAgo - 1, 20),
  }));
  // NEXTLEVEL critic r1 (B-ASKJB-33 rendered evidence): one hard-moment step
  // the parent booked from the Tantrum guide two days ago and answered "held
  // the plan" — so "Last time, this helped with Dylan" renders on #/behaviors
  // and in the sheet, and the Consult packet prints the dated adults' line.
  const tantrum = hardMomentCards.find((c) => c.id === "tantrum");
  if (tantrum) {
    actionLoops.push({
      id: "demo-held-1",
      recommendation: tantrum.doNow[lang],
      source: "hard-moment",
      capacity: "standard",
      status: "completed",
      acceptedAt: at(now, 2, 17),
      outcome: "helped",
      outcomeAt: at(now, 2, 19),
      held: "yes",
      childResponse: "calmer",
    });
  }
  // B-LOOP-17: the 14-day practice dose log with Tonight's three night answers.
  actionLoops.push(...doseRows(now, childId, LOOP_DOSES, lang, child.gender));
  const keepsakes = quoteDocs(now, LOOP_QUOTES, lang);

  // One Kid Mode session, six days ago: a few practice events + one hero story.
  const kidDay = 6;
  const practiceEvents: PracticeEvent[] = [
    { id: "demo-practice-1", kind: "emotion-id", domain: "emotional", timestamp: at(now, kidDay, 16) },
    { id: "demo-practice-2", kind: "vocab-naming", domain: "language", meta: "ball", timestamp: at(now, kidDay, 16) },
    { id: "demo-practice-3", kind: "rhythm", domain: "cognition", timestamp: at(now, kidDay, 16) },
    { id: "demo-practice-4", kind: "mood-checkin", domain: "emotional", emotion: "happy", timestamp: at(now, kidDay, 16) },
  ];
  const heroRuns: HeroJourneyRun[] = [
    {
      id: "demo-hero-1",
      storyId: "david-and-goliath",
      title: lang === "he" ? "הרועה הקטן והענק" : "The Small Shepherd and the Giant",
      language: lang,
      startedAt: at(now, kidDay, 16),
      completedAt: at(now, kidDay, 17),
      choiceId: "b",
      metricsEarned: {},
      render: {
        storyId: "david-and-goliath",
        title: lang === "he" ? "הרועה הקטן והענק" : "The Small Shepherd and the Giant",
        scenes: [
          {
            beatId: "call",
            title: lang === "he" ? "הקריאה" : "The Call",
            narration: lang === "he" ? "רועה קטן שומע שענק מפחיד את כל העמק." : "A small shepherd hears that a giant is frightening everyone in the valley.",
            imagePrompt: "A small shepherd on a green hill, soft storybook style",
          },
        ],
        choices: [{ id: "b", label: lang === "he" ? "לבקש עזרה מחבר קודם" : "Ask a friend for help first", consequence: lang === "he" ? "הגיבור אוסף אומץ יחד עם חבר." : "The hero gathers courage with a friend." }],
        reflection: { practiced: [lang === "he" ? "לבקש עזרה" : "Asking for help"], questions: [lang === "he" ? "את מי היית מבקש לעזור לך?" : "Who would you ask for help?"] },
      },
    },
  ];

  const appointments: Appointment[] = [
    {
      id: "demo-appt-1",
      who: lang === "he" ? "רופאת הילדים" : "The pediatrician",
      role: lang === "he" ? "ביקור שגרתי" : "Routine visit",
      profession: "pediatrician",
      when: at(now, 16, 9).slice(0, 10),
      whenIso: at(now, 16, 9),
      mode: "in-person",
      status: "done",
    },
    // W2-CAREPRO c2 r1: one BOOKED visit inside the 14-day Prepare window, so
    // the Upcoming row, its Prepare door and the reminder strip render on the
    // demo family (EN + HE). No note — nothing has happened yet.
    {
      id: "demo-appt-2",
      who: lang === "he" ? "קלינאית התקשורת" : "The speech therapist",
      role: lang === "he" ? "פגישת היכרות" : "First meeting",
      profession: "slp",
      when: at(now, -9, 10).slice(0, 10),
      whenIso: at(now, -9, 10),
      mode: "in-person",
      status: "confirmed",
    },
  ];
  const apptFollowUps: AppointmentFollowUp[] = [
    {
      id: "demo-followup-1",
      apptId: "demo-appt-1",
      note: lang === "he" ? "הרופאה אמרה להמשיך לקרוא יחד בערב ולחזור בעוד חצי שנה." : "The doctor said to keep reading together in the evening and come back in six months.",
      createdAt: at(now, 16, 12),
    },
  ];

  return {
    version: DEMO_FAMILY_VERSION,
    seededAt: new Date(now).toISOString(),
    lang,
    parent: { demo: true, displayName: DEMO_FAMILY_LABEL[lang] },
    child,
    collections: { behaviorLogs, milestones, langObs, actionLoops, practiceEvents, heroRuns, appointments, apptFollowUps, keepsakes },
    memory: MEMORY[lang],
    siblings: [buildLeni(now, lang)],
  };
}

/** Per-collection document counts — what the dry run prints. */
export function demoFamilyCounts(family: DemoFamily): Record<string, number> {
  return Object.fromEntries(Object.entries(family.collections).map(([name, docs]) => [name, docs.length]));
}

/** The localStorage keys useChildCollection / ProfileContext read in the sandbox. */
export const demoSandboxStorage = (family: DemoFamily): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [name, docs] of Object.entries(family.collections)) out[`arbor.${name}.${family.child.id}`] = JSON.stringify(docs);
  for (const sib of family.siblings ?? []) {
    for (const [name, docs] of Object.entries(sib.collections)) out[`arbor.${name}.${sib.child.id}`] = JSON.stringify(docs);
  }
  return out;
};
