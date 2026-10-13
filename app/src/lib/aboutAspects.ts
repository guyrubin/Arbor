/**
 * v3 F-CHILD-3 — About {child}: the eight areas a parent tells Arbor about.
 *
 * Pure. It reads the child doc and the (already scrubbed) memory lists and
 * returns, per area, the newest thing the parent told Arbor with the day it
 * was told, and the newest proposal still waiting for the parent. An area is
 * TOLD or NOT TOLD: there is no share, no fill and no "how much" (clinical
 * firewall — the page counts told areas in a sentence, never against eight).
 *
 * Where a line comes from, and its date:
 *  - strengths and interests → "strengths", always (the describe ledger's
 *    confirmedAt, else the profile's as-of stamp, else the onboarding day);
 *  - languages → the "lang" area's role rows (home, second, also heard);
 *  - the school setting → "school";
 *  - what is hard right now, the focus words and kept memory → the area its
 *    words name (keywords, EN and HE), else the area its domain maps to; a
 *    line that names no area stays on #/memory only;
 *  - a pending proposal → the same placement, newest per area.
 * Undated lines rank after dated ones; nothing is given an invented date.
 */
import type { ChildProfile, MemoryReviewItem } from "../types";
import { keptItemsFromProfile } from "./describeChild";
import { isDomainId, type DomainId } from "./domains/registry";
import type { FactField } from "./factsAsOf";
import { memoryTopicOf } from "./memoryGroups";

export const ASPECT_IDS = ["temper", "lang", "social", "routine", "sleep", "senses", "school", "strengths"] as const;
export type AspectId = (typeof ASPECT_IDS)[number];

export function asAspectId(value: unknown): AspectId | null {
  return typeof value === "string" && (ASPECT_IDS as readonly string[]).includes(value) ? (value as AspectId) : null;
}

/** The glyph of each area (all in the shipped icon subset). */
export const ASPECT_ICONS: Readonly<Record<AspectId, string>> = Object.freeze({
  temper: "self_improvement",
  lang: "forum",
  social: "groups",
  routine: "wb_sunny",
  sleep: "bedtime",
  senses: "hearing",
  school: "school",
  strengths: "auto_awesome",
});

/** The domain whose tokens tint each area (the AREA's colour, never the child's state). */
export const ASPECT_TONE: Readonly<Record<AspectId, DomainId>> = Object.freeze({
  temper: "feelings",
  lang: "talking",
  social: "moving",
  routine: "family",
  sleep: "body",
  senses: "hands",
  school: "thinking",
  strengths: "playing",
});

/** A domain with one clear area; body, hands and moving span several, so a
 *  line known only by them is not placed. */
const DOMAIN_ASPECT: Readonly<Partial<Record<DomainId, AspectId>>> = Object.freeze({
  feelings: "temper",
  talking: "lang",
  playing: "social",
  family: "routine",
  thinking: "school",
});

interface KeywordRow { id: AspectId; en: readonly string[]; he: readonly string[]; heExact?: readonly string[] }

/** Checked in this order: the first area a line names wins. English on word
 *  boundaries; Hebrew per word, with up to two leading particles (ו ה ב ל מ ש כ)
 *  removed; a phrase (space or hyphen) matches as written. A bare "night" is
 *  not a sleep word ("packed the night before" is a morning). */
const KEYWORDS: readonly KeywordRow[] = [
  {
    id: "sleep",
    en: ["sleep", "sleeps", "sleeping", "slept", "asleep", "nap", "naps", "napping", "bedtime", "at night", "every night", "in the night", "during the night", "through the night", "nighttime", "night-time", "night waking", "night wakings", "wakes up", "waking up", "nightmare", "nightmares"],
    he: ["שינה", "לישון", "נרדם", "נרדמת", "נרדמים", "להירדם", "הירדמות", "תנומה", "תנומות", "לילה", "לילות", "מתעורר", "מתעוררת", "מתעוררים", "התעוררות", "התעוררויות", "סיוט", "סיוטים", "השכבה"],
  },
  {
    id: "routine",
    en: ["morning", "mornings", "routine", "routines", "bath", "bathtime", "bath time", "getting dressed", "get dressed", "dressing", "shoes", "evening", "evenings", "drop-off", "drop off", "pick-up", "pickup", "leaving the house", "leave the house", "transition", "transitions", "schedule", "brushing teeth"],
    he: ["בוקר", "בקרים", "שגרה", "שגרות", "שגרת", "מקלחת", "אמבטיה", "נעליים", "נעלי", "להתלבש", "התלבשות", "ערב", "ערבים", "פרידה", "פרידות", "מעבר", "מעברים", "לצאת מהבית", "יציאה מהבית", "צחצוח שיניים"],
  },
  {
    id: "senses",
    en: ["noise", "noises", "noisy", "loud", "textures", "labels", "smell", "smells", "taste", "tastes", "food", "foods", "eat", "eats", "eating", "meal", "meals", "picky", "sensory", "socks", "sticky", "breakfast", "lunch", "dinner", "snack", "snacks", "bright lights"],
    he: ["רעש", "רעשים", "רועש", "רועשת", "רועשים", "מרקם", "מרקמים", "תווית", "תוויות", "ריח", "ריחות", "טעם", "טעמים", "אוכל", "לאכול", "אוכלת", "מאכל", "מאכלים", "ארוחה", "ארוחות", "ארוחת", "בררן", "בררנית", "בררנות", "חושים", "גרביים", "דביק", "אור חזק"],
  },
  {
    id: "school",
    en: ["school", "preschool", "pre-school", "kindergarten", "nursery", "daycare", "day care", "teacher", "teachers", "classroom", "letters", "reading", "homework", "circle time"],
    he: ["בית ספר", "בית הספר", "גננת", "גננות", "כיתה", "מורה", "מורים", "מורות", "למידה", "אותיות", "שיעורי", "צהרון", "מסגרת", "מעון"],
    heExact: ["גן", "בגן", "לגן", "הגן", "מהגן", "והגן", "גנון", "בגנון", "לגנון"],
  },
  {
    id: "social",
    en: ["friend", "friends", "friendship", "playdate", "playdates", "play date", "peers", "other kids", "other children", "share", "shares", "sharing", "take turns", "takes turns", "taking turns", "group"],
    he: ["חבר", "חברה", "חברים", "חברות", "ילדים אחרים", "לחלוק", "תור", "קבוצה", "קבוצתי"],
  },
  {
    id: "temper",
    en: ["calm", "calms", "calming", "calmer", "upset", "angry", "anger", "tantrum", "tantrums", "meltdown", "meltdowns", "cry", "cries", "crying", "frustrated", "frustration", "overwhelmed", "scared", "afraid", "fear", "fears", "anxious", "mood", "moods", "temper", "feelings", "emotions", "hug", "hugs", "shy"],
    he: ["רגוע", "רגועה", "נרגע", "נרגעת", "להירגע", "מרגיע", "מרגיעה", "כועס", "כועסת", "כעס", "התפרצות", "התפרצויות", "בוכה", "בכי", "מתוסכל", "מתוסכלת", "תסכול", "מוצף", "מוצפת", "מפחד", "מפחדת", "פחד", "פחדים", "חרדה", "מצב רוח", "רגש", "רגשות", "חיבוק", "ביישן", "ביישנית"],
  },
  {
    id: "lang",
    en: ["talk", "talks", "talking", "says", "word", "words", "sentence", "sentences", "speech", "speak", "speaks", "speaking", "language", "languages", "hebrew", "english", "arabic", "russian", "french", "bilingual", "understands", "understanding", "explains", "vocabulary", "stutter", "stutters", "pronounces"],
    he: ["מדבר", "מדברת", "לדבר", "דיבור", "מילים", "מילה", "משפט", "משפטים", "שפה", "שפות", "עברית", "אנגלית", "ערבית", "רוסית", "צרפתית", "דו-לשוני", "דו-לשונית", "דו־לשוני", "דו־לשונית", "מבין", "מבינה", "הבנה", "מסביר", "מסבירה", "אוצר מילים", "מגמגם", "מגמגמת", "גמגום", "הגייה"],
  },
  {
    id: "strengths",
    en: ["love", "loves", "loved", "favourite", "favorite", "favourites", "favorites", "enjoys", "good at", "great at", "proud", "talent", "patient", "funny", "creative", "curious", "builds", "building", "draws", "drawing"],
    he: ["אוהב", "אוהבת", "אוהבים", "מת על", "מתה על", "נהנה", "נהנית", "אהוב", "אהובה", "גאה", "כישרון", "סבלני", "סבלנית", "מצחיק", "מצחיקה", "יצירתי", "יצירתית", "סקרן", "סקרנית", "בונה", "מצייר", "מציירת", "ציור"],
  },
];

const PARTICLES = new Set(["ו", "ה", "ב", "ל", "מ", "ש", "כ"]);
const isPhrase = (w: string) => /[\s\-־]/.test(w);
const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const EN_RES: ReadonlyMap<AspectId, RegExp> = new Map(KEYWORDS.map((row) => [
  row.id,
  new RegExp(`\\b(?:${row.en.map((w) => escape(w).replace(/[\s-]+/g, "[\\s-]+")).join("|")})\\b`, "i"),
]));

/** The Hebrew word with up to two leading particles removed (the word itself first). */
function heForms(token: string): string[] {
  const out = [token];
  let rest = token;
  for (let i = 0; i < 2 && rest.length > 2 && PARTICLES.has(rest[0]); i++) {
    rest = rest.slice(1);
    out.push(rest);
  }
  return out;
}

/** The area a line of the parent's words names, or null. */
export function aspectOfWords(words: string): AspectId | null {
  const text = (words || "").trim();
  if (!text) return null;
  const tokens = text.split(/[^א-תװ-״A-Za-z0-9]+/).filter(Boolean);
  const heTokens = tokens.filter((tok) => /[א-ת]/.test(tok));
  for (const row of KEYWORDS) {
    if (EN_RES.get(row.id)!.test(text)) return row.id;
    if (heTokens.length === 0) continue;
    for (const w of row.he) {
      if (isPhrase(w)) {
        if (text.includes(w)) return row.id;
      } else if (heTokens.some((tok) => heForms(tok).includes(w))) {
        return row.id;
      }
    }
    if (row.heExact?.some((w) => heTokens.includes(w))) return row.id;
  }
  return null;
}

/** The area a domain maps to (body, hands and moving map to none). */
export function aspectOfDomain(domain: unknown): AspectId | null {
  return isDomainId(domain) ? DOMAIN_ASPECT[domain] ?? null : null;
}

// ── The per-area state ───────────────────────────────────────────────────────

export interface AspectFact {
  /** The parent's words (memory already in parent words). */
  words: string;
  /** ISO day it was told, or null (shown "In your words" with no date). */
  date: string | null;
  /** profile: a profile field · describe: kept from the guided conversation · memory: kept memory. */
  source: "profile" | "describe" | "memory";
  /** The profile field the words came from ("Still true?" after 90 days). */
  factField?: FactField;
  memoryId?: string;
}

export interface AspectLanguages {
  home: string | null;
  second: string | null;
  others: string[];
  date: string | null;
}

export interface AspectState {
  id: AspectId;
  known: AspectFact | null;
  /** "lang" only: which language is the home one, the second, and the others heard. */
  languages: AspectLanguages | null;
  /** The newest proposal waiting for the parent's Confirm or No. */
  pending: MemoryReviewItem | null;
}

type AboutProfile = Partial<Pick<ChildProfile,
  "strengths" | "interests" | "challenges" | "focusAreas" | "parentPreferences" | "describedItems" |
  "languages" | "schoolContext" | "factsAsOf" | "interestsUpdatedAt" | "onboardingCompletedAt">>;

export interface AboutInputs {
  profile: AboutProfile | null | undefined;
  /** Approved memory, already through the parent-words scrub. */
  approved?: readonly MemoryReviewItem[];
  /** Pending proposals, already through the parent-words scrub. */
  pending?: readonly MemoryReviewItem[];
  /** Memory text → the words a parent reads (toParentWords); identity by default. */
  words?: (fact: string) => string;
}

const validAt = (value: unknown): value is string => typeof value === "string" && value.trim() !== "" && Number.isFinite(Date.parse(value));
const firstAt = (...values: unknown[]): string | null => (values.find(validAt) as string | undefined) ?? null;
const atMs = (iso: string | null): number => (iso ? Date.parse(iso) : -Infinity);

/** Later candidates win ties, so the last-added line of equal date is shown. */
function newer(current: AspectFact | null, next: AspectFact): AspectFact {
  if (!current) return next;
  return atMs(next.date) >= atMs(current.date) ? next : current;
}

export function buildAspects({ profile, approved = [], pending = [], words = (fact) => fact }: AboutInputs): AspectState[] {
  const known = new Map<AspectId, AspectFact>();
  const offer = (id: AspectId | null, fact: AspectFact) => {
    if (!id || !fact.words.trim()) return;
    known.set(id, newer(known.get(id) ?? null, fact));
  };
  const p = profile ?? {};
  const onboarded = p.onboardingCompletedAt;
  const ledger = Array.isArray(p.describedItems) ? p.describedItems : [];
  const asOf = p.factsAsOf ?? {};

  for (const item of keptItemsFromProfile(p)) {
    const record = item.source === "describe" ? ledger.find((d) => d && d.id === item.id) : undefined;
    const ledgerAt = record ? firstAt(record.confirmedAt, record.since) : null;
    if (item.kind === "strength" || item.kind === "interest") {
      const fieldAt = item.kind === "strength" ? asOf.strengths : p.interestsUpdatedAt;
      offer("strengths", {
        words: item.words,
        date: ledgerAt ?? firstAt(fieldAt, onboarded),
        source: record ? "describe" : "profile",
        ...(!record && item.kind === "strength" ? { factField: "strengths" as const } : {}),
      });
    } else if (item.kind === "worry") {
      offer(aspectOfWords(item.words) ?? aspectOfDomain(item.domainId), {
        words: item.words,
        date: ledgerAt ?? firstAt(asOf.challenges, onboarded),
        source: record ? "describe" : "profile",
        ...(!record ? { factField: "challenges" as const } : {}),
      });
    }
  }
  for (const focus of Array.isArray(p.focusAreas) ? p.focusAreas : []) {
    if (!focus || typeof focus.words !== "string") continue;
    offer(aspectOfWords(focus.words) ?? aspectOfDomain(focus.domainId), {
      words: focus.words,
      date: firstAt(focus.confirmedAt, focus.since),
      source: "describe",
    });
  }
  const school = typeof p.schoolContext === "string" ? p.schoolContext.trim() : "";
  if (school) offer("school", { words: school, date: firstAt(asOf.schoolContext, onboarded), source: "profile", factField: "schoolContext" });

  const placeMemory = (m: MemoryReviewItem): { id: AspectId | null; text: string } => {
    const text = words(m.fact ?? "").trim();
    if (!text) return { id: null, text };
    const topic = memoryTopicOf({ fact: text, domains: m.domains });
    return { id: aspectOfWords(text) ?? (topic === "other" ? null : aspectOfDomain(topic)), text };
  };
  for (const m of approved) {
    const { id, text } = placeMemory(m);
    offer(id, { words: text, date: firstAt(m.createdAt), source: "memory", memoryId: m.memoryId });
  }

  const waiting = new Map<AspectId, MemoryReviewItem>();
  for (const m of pending) {
    const { id } = placeMemory(m);
    if (!id) continue;
    const current = waiting.get(id);
    if (!current || atMs(firstAt(m.createdAt)) >= atMs(firstAt(current.createdAt))) waiting.set(id, m);
  }

  const langs = (Array.isArray(p.languages) ? p.languages : []).map((l) => (typeof l === "string" ? l.trim() : "")).filter(Boolean);
  const languages: AspectLanguages | null = langs.length === 0 ? null : {
    home: langs[0] ?? null,
    second: langs[1] ?? null,
    others: langs.slice(2),
    date: firstAt(asOf.languages, onboarded),
  };

  return ASPECT_IDS.map((id) => ({
    id,
    known: known.get(id) ?? null,
    languages: id === "lang" ? languages : null,
    pending: waiting.get(id) ?? null,
  }));
}

/** An area is told when it holds the parent's words (or, for "lang", the languages). */
export const isTold = (state: AspectState): boolean => state.known !== null || state.languages !== null;

/** Every line shown on a told area carries its day. */
export const isDated = (state: AspectState): boolean =>
  (state.known ? state.known.date !== null : true) && (state.languages ? state.languages.date !== null : true);

/** The count line's inputs: how many areas are told, and whether each told one is dated. */
export function toldSummary(states: readonly AspectState[]): { told: number; dated: boolean } {
  const told = states.filter(isTold);
  return { told: told.length, dated: told.every(isDated) };
}

/** A proposal is waiting that no area shows (it names no area, or its area
 *  shows a newer one): it waits on #/memory, and the memory door says so in a
 *  sentence — never a number or a badge. `pending` is the scrubbed list, the
 *  same one #/memory shows. */
export function waitingOffPage(states: readonly AspectState[], pending: readonly Pick<MemoryReviewItem, "memoryId">[] = []): boolean {
  const shown = new Set(states.map((s) => s.pending?.memoryId).filter(Boolean));
  return pending.some((m) => !shown.has(m.memoryId));
}

/** The receipt of a Confirm / No, bound to the proposal it answered. */
export interface AspectReceipt { kind: "kept" | "leftOut" | "failed"; memoryId: string }

/** How long a receipt stays before it clears itself. */
export const RECEIPT_MS = 6000;

/** A receipt shows beside the proposal it answered, or alone once that
 *  proposal left the area; a different proposal in the area hides it. */
export function receiptShows(receipt: AspectReceipt | null, pending: Pick<MemoryReviewItem, "memoryId"> | null): receipt is AspectReceipt {
  return receipt !== null && (pending === null || pending.memoryId === receipt.memoryId);
}
