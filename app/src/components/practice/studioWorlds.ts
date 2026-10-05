/**
 * The ten Practice Studio worlds (parent register) and what each tile counts.
 *
 * B-PLAY-02: the tile chip said "{n} sessions" for every world, while the
 * worlds count different things — speech counts attempts, adventures count
 * results, memory/beat/pose/pattern count rounds — and Feelings counted EVERY
 * practiceEvents row of every kind (memory, rhythm, pattern, phonics…). Each
 * world now counts only its own records and names its own unit. Pure module
 * (types only) so the counts are testable without React.
 */
import type { AdventureResult, MimicSession, PracticeEvent, SpeechAttempt } from "../../types";
import type { ActiveTab } from "../../lib/routes";
import type { PASTEL } from "../../lib/tokens";
import type { DomainId } from "../../lib/domains/registry";

/** The slice of PracticeData a tile count reads. */
export interface StudioCountSource {
  speech: { items: SpeechAttempt[] };
  mimic: { items: MimicSession[] };
  adventures: { items: AdventureResult[] };
  events: { items: PracticeEvent[] };
}

/** What one counted record IS in this world — chooses the chip's i18n key. */
export type StudioCountUnit = "tries" | "rounds" | "stories";

export interface StudioWorld {
  id: string;
  /** i18n key prefix: `practice.world.<id>.name` / `.skill` */
  key: string;
  /** i18n key for the Kid-Mode world name — shared vocabulary between parent
   *  and child (OBJ-PRACTICE-02). */
  kidNameKey: string;
  msIcon: string;
  tone: keyof typeof PASTEL;
  /** Standalone parent-shell route, when one exists; else Kid Mode only. */
  tab?: ActiveTab;
  /** B-KID-06: a world with no Kid Mode seat names the parent tab it opens.
   *  Word World is parent-only in the arcade (HeroArcade `parentOnly`), so its
   *  tile must never promise "In Kid Mode as …" for a world the child cannot see. */
  tabNameKey?: string;
  /** SHIP-FIX r3: the parent tab a world opens INSTEAD of Kid Mode in a UI
   *  language it cannot serve yet (see worksInLanguage). */
  fallbackTabNameKey?: string;
  unit: StudioCountUnit;
  count: (d: StudioCountSource) => number;
  /** B-CAREPRO-20 · spine §7b: the registry domains this world exercises
   *  (primary first). Parent-side read only — the kid register never shows a
   *  domain name. Consult's "At home while you wait" matches on it. */
  domains: readonly DomainId[];
}

const READING_KINDS = new Set<string>(["phonics", "sight-word", "letter-trace"]);
/** Feelings Lab writes these kinds and only these. */
export const FEELINGS_KINDS = new Set<string>(["emotion-id", "emotion-why", "calm"]);

const eventsOf = (d: StudioCountSource, pred: (kind: string) => boolean) =>
  d.events.items.filter((e) => pred(e.kind)).length;

export const STUDIO_WORLDS: StudioWorld[] = [
  { id: "speech", key: "speech", kidNameKey: "elev.practice.world.kid.speech", msIcon: "mic", tone: "sky", tab: "speech", fallbackTabNameKey: "nav.tab.speech", unit: "tries", count: (d) => d.speech.items.length, domains: ["talking"] },
  { id: "word-world", key: "words", kidNameKey: "elev.practice.world.kid.words", msIcon: "menu_book", tone: "sky", tab: "language", tabNameKey: "nav.tab.language", unit: "tries", count: (d) => eventsOf(d, (k) => k === "lang-strategy"), domains: ["talking"] },
  { id: "feelings", key: "feelings", kidNameKey: "elev.practice.world.kid.feelings", msIcon: "favorite", tone: "pink", tab: "feelings", unit: "rounds", count: (d) => eventsOf(d, (k) => FEELINGS_KINDS.has(k)), domains: ["feelings", "playing"] },
  { id: "mimic", key: "mimic", kidNameKey: "elev.practice.world.kid.mimic", msIcon: "mood", tone: "coral", tab: "mimic", unit: "tries", count: (d) => d.mimic.items.length, domains: ["hands", "playing"] },
  { id: "adventures", key: "adventures", kidNameKey: "elev.practice.world.kid.adventures", msIcon: "map", tone: "yellow", tab: "adventures", unit: "stories", count: (d) => d.adventures.items.length, domains: ["thinking", "feelings"] },
  { id: "memory", key: "memory", kidNameKey: "elev.practice.world.kid.memory", msIcon: "psychology", tone: "lav", unit: "rounds", count: (d) => eventsOf(d, (k) => k === "memory"), domains: ["thinking"] },
  { id: "reading", key: "reading", kidNameKey: "elev.practice.world.kid.reading", msIcon: "auto_stories", tone: "yellow", unit: "tries", count: (d) => eventsOf(d, (k) => READING_KINDS.has(k)), domains: ["thinking"] },
  { id: "beat", key: "rhythm", kidNameKey: "elev.practice.world.kid.rhythm", msIcon: "music_note", tone: "coral", unit: "rounds", count: (d) => eventsOf(d, (k) => k === "rhythm"), domains: ["moving"] },
  { id: "pose", key: "movement", kidNameKey: "elev.practice.world.kid.movement", msIcon: "accessibility_new", tone: "mint", unit: "rounds", count: (d) => eventsOf(d, (k) => k === "pose"), domains: ["moving"] },
  { id: "pattern", key: "logic", kidNameKey: "elev.practice.world.kid.logic", msIcon: "category", tone: "lav", unit: "rounds", count: (d) => eventsOf(d, (k) => k === "pattern"), domains: ["thinking"] },
];

/** B-KID-11: a tile opens its world in Kid Mode unless the world has no Kid
 *  Mode seat (Word World is parentOnly in HeroArcade — it alone names a parent tab). */
export const opensInKidMode = (world: StudioWorld): boolean => !world.tabNameKey;

/** Sound Lab's drill is English-only today; every other world works in both. */
export const worksInLanguage = (world: StudioWorld, lang: "en" | "he"): boolean =>
  !(lang === "he" && world.id === "speech");

/** SHIP-FIX (W2-SHELLPLAY r3 P1): the start-world stamp sits on the first
 *  world that both works in the UI language AND opens a world the child plays
 *  (Word World is a parent tab). EN: Sound Lab · HE: Feelings Lab. */
export const stampWorldId = (lang: "en" | "he"): string =>
  (STUDIO_WORLDS.find((w) => worksInLanguage(w, lang) && opensInKidMode(w)) ?? STUDIO_WORLDS[0]).id;

/** The grid order for a UI language: the stamped world is ALWAYS tile 1 (so the
 *  move sits at the same height in EN and HE), every other world keeps its
 *  registry order, and a world that cannot keep its promise in this language
 *  goes last. EN order is the registry order unchanged. */
export const orderedStudioWorlds = (lang: "en" | "he"): StudioWorld[] => {
  const stamp = stampWorldId(lang);
  const rest = STUDIO_WORLDS.filter((w) => w.id !== stamp);
  return [
    ...STUDIO_WORLDS.filter((w) => w.id === stamp),
    ...rest.filter((w) => worksInLanguage(w, lang)),
    ...rest.filter((w) => !worksInLanguage(w, lang)),
  ];
};

/** The chip's i18n key for `n` records of a world (`.one` for exactly 1). */
export const studioCountKey = (unit: StudioCountUnit, n: number): string =>
  `practice.studio.count.${unit}${n === 1 ? ".one" : ""}`;

const stampMs = (stamp: unknown): number | null => {
  if (stamp == null || stamp === "") return null;
  const ms = typeof stamp === "number" ? stamp : typeof stamp === "string" ? Date.parse(stamp) : NaN;
  return Number.isFinite(ms) ? ms : null;
};
const since = <T extends { timestamp?: unknown }>(rows: T[], sinceMs: number): T[] =>
  rows.filter((r) => {
    const ms = stampMs(r.timestamp);
    return ms != null && ms >= sinceMs;
  });

/**
 * W2-SHELLPLAY critic r2 — ONE counter for the Practice page. The tiles and
 * the door sentence both read this window (the latest Kid Mode session, else
 * the last 7 days): each tile counts its own records in its own unit, and the
 * door's number is the SUM of the tile chips. A ledger row no world claims
 * (a mission, a vocab-naming event, a mood check-in) is in neither — the door
 * can never say more than the tiles show (guard: practiceDoors.copy.test).
 */
export function studioSourceSince(d: StudioCountSource, sinceMs: number): StudioCountSource {
  return {
    speech: { items: since(d.speech.items, sinceMs) },
    mimic: { items: since(d.mimic.items, sinceMs) },
    adventures: { items: since(d.adventures.items, sinceMs) },
    events: { items: since(d.events.items, sinceMs) },
  };
}

/** Each world's chip count over the window, and their sum (the door total). */
export function studioCountsSince(d: StudioCountSource, sinceMs: number): { byWorld: Record<string, number>; total: number } {
  const windowed = studioSourceSince(d, sinceMs);
  const byWorld: Record<string, number> = {};
  let total = 0;
  for (const w of STUDIO_WORLDS) {
    const n = w.count(windowed);
    byWorld[w.id] = n;
    total += n;
  }
  return { byWorld, total };
}
