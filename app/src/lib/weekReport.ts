import type { ActionLoopEntry } from "../actionLoop/model";
import { DOMAIN_IDS, type DomainId } from "./domains/registry";
import type { Observation } from "./observations";
import { KID_ORIGINS, PARENT_SOURCES } from "./weekGlance";

/**
 * v3 F-NOW-3 — the Weekly report's LINES, beside lib/weekGlance's counts.
 *
 * lib/weekGlance gives the numbers (tiles, the day strip); this file gives
 * what the tiles' sub-lines, the What helped card, the words card and the By
 * area rows say about one report week. Pure: no React, no clock, no store.
 *
 * The week is bounded on both sides, [startMs, endMs]: the current week ends
 * now, a past week ends at the last instant its report id still holds
 * (WeeklyTab computes both through recapWeekId). A record counts when it falls
 * inside those bounds.
 *
 * Clinical firewall: every number here is a COUNT of what the parent kept, a
 * step outcome the parent recorded, or a Kid Mode session. No share, no
 * denominator, no score, no trend; a step that did not help is "not this
 * time", never a verdict about the child.
 */

/** At most three steps in the What helped card (RecapStoryCards' bound). */
export const WEEK_STEPS_MAX = 3;
/** At most three of the child's words in the words card. */
export const WEEK_WORDS_MAX = 3;
/** Longest word chip before it is clipped. */
export const WEEK_WORD_MAX_CHARS = 60;

/** The four stored places of a moment (BehaviorLog.context), lower-cased. */
export const PLACE_ORDER = ["home", "school", "transit", "public"] as const;
export type WeekPlace = (typeof PLACE_ORDER)[number];

export type WeekStepLine = {
  /** The step as the parent took it (whitespace collapsed). */
  step: string;
  /** Times the parent marked it "helped" this week. */
  helped: number;
  /** Times the parent marked it "somewhat" or "not today": read "not this time". */
  notThisTime: number;
  /** Local midnight of each day it helped, oldest first, once per day. */
  helpedDays: number[];
  /** The newest outcome's instant (the card's order). */
  latest: number;
};

export type WeekAreaRecord = { kind: "word"; phrase: string } | { kind: "moment"; behaviorType: string };

export type WeekAreaLine = {
  domain: DomainId;
  /** The parent's records in this area this week: moments, milestones and kept words. */
  n: number;
  /** The week's milestones in this area, newest first. */
  milestones: { id: string; title: string }[];
  /** The newest record in the area that is not a milestone, or null. */
  latest: WeekAreaRecord | null;
};

export type WeekReportLines = {
  /** The parent's moments by stored place, most first, at most two; a place with none is absent. */
  places: { place: WeekPlace; n: number }[];
  /** The steps the parent rated this week, newest first, at most three. */
  steps: WeekStepLine[];
  /** The week's milestones by area, most first, at most two. */
  milestoneAreas: { domain: DomainId; n: number }[];
  /** The Kid Mode world played most this week (its registry worldId), or null. */
  kidWorld: { worldId: string; n: number } | null;
  /** The child's words kept this week, newest first, at most three, each once. */
  words: string[];
  /** One row per registry area, in registry order: every area, empty or not. */
  areas: WeekAreaLine[];
};

type StepRow = Pick<ActionLoopEntry, "recommendation" | "status" | "outcome" | "outcomeAt">;

/**
 * A Kid Mode practice event's world (the kid world registry's worldId), the
 * same mapping Kid Mode's greeting uses (kidmode/kidGreeting EVENT_WORLD).
 * An event kind with no world of its own reads no name.
 */
const EVENT_WORLD: Readonly<Record<string, string>> = {
  "emotion-id": "feelings",
  "emotion-why": "feelings",
  calm: "feelings",
  memory: "memory",
  rhythm: "beat",
  pose: "pose",
  pattern: "pattern",
  phonics: "reading",
  "sight-word": "reading",
  "letter-trace": "reading",
};

/** The kid world a Kid Mode record belongs to, or null (missions, unmapped kinds, parent records). */
export function kidWorldOf(item: Observation): string | null {
  if (!KID_ORIGINS.has(item.origin) || item.value.type !== "practice") return null;
  if (item.origin === "mimicSessions") return "mimic";
  if (item.origin === "adventureResults") return "adventures";
  if (item.origin === "practiceEvents") return EVENT_WORLD[item.value.activity] ?? null;
  return null;
}

const localMidnight = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/**
 * The What helped rows: the steps the parent rated inside the week, grouped by
 * the step's text (RecapStoryCards' weekStepRows rule, with the week's end as
 * an upper bound), newest first, at most three.
 */
export function weekStepLines(actionLoop: readonly StepRow[], startMs: number, endMs: number): WeekStepLine[] {
  const groups = new Map<string, WeekStepLine>();
  for (const row of actionLoop) {
    const at = Date.parse(row.outcomeAt ?? "");
    if (row.status !== "completed" || !row.outcome || !Number.isFinite(at) || at < startMs || at > endMs) continue;
    const step = (row.recommendation ?? "").replace(/\s+/g, " ").trim();
    if (!step) continue;
    const line = groups.get(step) ?? { step, helped: 0, notThisTime: 0, helpedDays: [], latest: Number.NEGATIVE_INFINITY };
    if (row.outcome === "helped") {
      line.helped += 1;
      const day = localMidnight(at);
      if (!line.helpedDays.includes(day)) line.helpedDays.push(day);
    } else {
      line.notThisTime += 1;
    }
    line.latest = Math.max(line.latest, at);
    groups.set(step, line);
  }
  return [...groups.values()]
    .sort((a, b) => b.latest - a.latest)
    .slice(0, WEEK_STEPS_MAX)
    .map((line) => ({ ...line, helpedDays: [...line.helpedDays].sort((a, b) => a - b) }));
}

/** The step that helped most this week (ties: the newest), or null when none helped. */
export function topHelpedStep(steps: readonly WeekStepLine[]): WeekStepLine | null {
  let best: WeekStepLine | null = null;
  for (const line of steps) {
    if (line.helped === 0) continue;
    if (!best || line.helped > best.helped || (line.helped === best.helped && line.latest > best.latest)) best = line;
  }
  return best;
}

const isParentMoment = (item: Observation): boolean => item.kind === "moment" && PARENT_SOURCES.has(item.source) && item.value.type === "moment";
const isMilestone = (item: Observation): boolean => item.kind === "milestone" && item.value.type === "milestone";
const isWord = (item: Observation): boolean => item.value.type === "word";

/** Most first; ties keep the order the keys were given in. */
function ranked<K>(counts: Map<K, number>, order: readonly K[]): { key: K; n: number }[] {
  return order
    .map((key) => ({ key, n: counts.get(key) ?? 0 }))
    .filter((entry) => entry.n > 0)
    .sort((a, b) => b.n - a.n);
}

export function weekReportLines({ observations, actionLoop, startMs, endMs }: {
  observations: readonly Observation[];
  actionLoop: readonly StepRow[];
  startMs: number;
  endMs: number;
}): WeekReportLines {
  const inWeek = (iso: string): number | null => {
    const ms = Date.parse(iso ?? "");
    return Number.isFinite(ms) && ms >= startMs && ms <= endMs ? ms : null;
  };
  const week = observations
    .map((item) => ({ item, ms: inWeek(item.at) }))
    .filter((entry): entry is { item: Observation; ms: number } => entry.ms !== null)
    .sort((a, b) => b.ms - a.ms);

  const placeCounts = new Map<WeekPlace, number>();
  const milestoneCounts = new Map<DomainId, number>();
  const worldCounts = new Map<string, number>();
  const worldOrder: string[] = [];
  const words: string[] = [];
  const seenWords = new Set<string>();

  for (const { item } of week) {
    if (isParentMoment(item) && item.value.type === "moment") {
      const place = String(item.value.context ?? "").trim().toLowerCase();
      const known = PLACE_ORDER.find((p) => p === place);
      if (known) placeCounts.set(known, (placeCounts.get(known) ?? 0) + 1);
    }
    if (isMilestone(item)) for (const domain of item.domains) milestoneCounts.set(domain, (milestoneCounts.get(domain) ?? 0) + 1);
    const world = kidWorldOf(item);
    if (world) {
      if (!worldCounts.has(world)) worldOrder.push(world);
      worldCounts.set(world, (worldCounts.get(world) ?? 0) + 1);
    }
    if (item.value.type === "word" && words.length < WEEK_WORDS_MAX) {
      const phrase = item.value.phrase.replace(/\s+/g, " ").trim();
      const key = phrase.toLocaleLowerCase();
      if (phrase && !seenWords.has(key)) {
        seenWords.add(key);
        words.push(clip(phrase, WEEK_WORD_MAX_CHARS));
      }
    }
  }

  const areas: WeekAreaLine[] = DOMAIN_IDS.map((domain) => {
    const records = week.filter(({ item }) => item.domains.includes(domain) && (isParentMoment(item) || isMilestone(item) || isWord(item)));
    const milestones = records
      .filter(({ item }) => isMilestone(item))
      .map(({ item }) => (item.value.type === "milestone" ? { id: item.value.milestoneId, title: item.value.title } : null))
      .filter((m): m is { id: string; title: string } => m !== null);
    const other = records.find(({ item }) => !isMilestone(item))?.item;
    let latest: WeekAreaRecord | null = null;
    if (other?.value.type === "word") latest = { kind: "word", phrase: clip(other.value.phrase.replace(/\s+/g, " ").trim(), WEEK_WORD_MAX_CHARS) };
    else if (other?.value.type === "moment") latest = { kind: "moment", behaviorType: other.value.behaviorType };
    return { domain, n: records.length, milestones, latest };
  });

  const topWorld = ranked(worldCounts, worldOrder)[0];
  return {
    places: ranked(placeCounts, PLACE_ORDER).slice(0, 2).map(({ key, n }) => ({ place: key, n })),
    steps: weekStepLines(actionLoop, startMs, endMs),
    milestoneAreas: ranked(milestoneCounts, DOMAIN_IDS).slice(0, 2).map(({ key, n }) => ({ domain: key, n })),
    kidWorld: topWorld ? { worldId: topWorld.key, n: topWorld.n } : null,
    words,
    areas,
  };
}
