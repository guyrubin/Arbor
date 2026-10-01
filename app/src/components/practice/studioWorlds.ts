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
  unit: StudioCountUnit;
  count: (d: StudioCountSource) => number;
}

const READING_KINDS = new Set<string>(["phonics", "sight-word", "letter-trace"]);
/** Feelings Lab writes these kinds and only these. */
export const FEELINGS_KINDS = new Set<string>(["emotion-id", "emotion-why", "calm"]);

const eventsOf = (d: StudioCountSource, pred: (kind: string) => boolean) =>
  d.events.items.filter((e) => pred(e.kind)).length;

export const STUDIO_WORLDS: StudioWorld[] = [
  { id: "speech", key: "speech", kidNameKey: "elev.practice.world.kid.speech", msIcon: "mic", tone: "sky", tab: "speech", unit: "tries", count: (d) => d.speech.items.length },
  { id: "word-world", key: "words", kidNameKey: "elev.practice.world.kid.words", msIcon: "menu_book", tone: "sky", tab: "language", tabNameKey: "nav.tab.language", unit: "tries", count: (d) => eventsOf(d, (k) => k === "lang-strategy") },
  { id: "feelings", key: "feelings", kidNameKey: "elev.practice.world.kid.feelings", msIcon: "favorite", tone: "pink", tab: "feelings", unit: "rounds", count: (d) => eventsOf(d, (k) => FEELINGS_KINDS.has(k)) },
  { id: "mimic", key: "mimic", kidNameKey: "elev.practice.world.kid.mimic", msIcon: "mood", tone: "coral", tab: "mimic", unit: "tries", count: (d) => d.mimic.items.length },
  { id: "adventures", key: "adventures", kidNameKey: "elev.practice.world.kid.adventures", msIcon: "map", tone: "yellow", tab: "adventures", unit: "stories", count: (d) => d.adventures.items.length },
  { id: "memory", key: "memory", kidNameKey: "elev.practice.world.kid.memory", msIcon: "psychology", tone: "lav", unit: "rounds", count: (d) => eventsOf(d, (k) => k === "memory") },
  { id: "reading", key: "reading", kidNameKey: "elev.practice.world.kid.reading", msIcon: "auto_stories", tone: "yellow", unit: "tries", count: (d) => eventsOf(d, (k) => READING_KINDS.has(k)) },
  { id: "beat", key: "rhythm", kidNameKey: "elev.practice.world.kid.rhythm", msIcon: "music_note", tone: "coral", unit: "rounds", count: (d) => eventsOf(d, (k) => k === "rhythm") },
  { id: "pose", key: "movement", kidNameKey: "elev.practice.world.kid.movement", msIcon: "accessibility_new", tone: "mint", unit: "rounds", count: (d) => eventsOf(d, (k) => k === "pose") },
  { id: "pattern", key: "logic", kidNameKey: "elev.practice.world.kid.logic", msIcon: "category", tone: "lav", unit: "rounds", count: (d) => eventsOf(d, (k) => k === "pattern") },
];

/** The chip's i18n key for `n` records of a world (`.one` for exactly 1). */
export const studioCountKey = (unit: StudioCountUnit, n: number): string =>
  `practice.studio.count.${unit}${n === 1 ? ".one" : ""}`;
