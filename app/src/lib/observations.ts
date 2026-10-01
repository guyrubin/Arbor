/**
 * B-GROWTH-28 — the Observation READ MODEL over the existing collections
 * (spine §3, §4.2, phase 1).
 *
 * One shape for every dated thing a parent (or a kid-practice session) put on
 * the child's record, each tagged with ≥1 domain of the one registry
 * (`lib/domains/registry.ts`). Built from the same sources `useTimeline` reads
 * plus `growthEntries`, `goalObservations`, `langObs`, `keepsakes`,
 * `screenings` and parent-scored `speechAttempts`.
 *
 * READ-ONLY: no collection is migrated, renamed or written here (spine §9
 * migration risk). A source record whose domain cannot be resolved is LEFT
 * OUT — never guessed into a domain.
 *
 * CLINICAL FIREWALL: `summariseByDomain` returns integers and ISO dates only —
 * counts over 4 and 12 weeks and the latest dates. No rate, no delta between
 * periods, no percentage, no score (guarded by observations.firewall.test.ts).
 * Practice values carry what was practised, never whether it was "right".
 */
import type {
  AdventureResult,
  BehaviorLog,
  ChildProfile,
  MimicSession,
  Milestone,
  MissionRecord,
  PlayLog,
  PracticeEvent,
  SpeechAttempt,
} from "../types";
import type { GrowthEntry } from "../growth/growthEntries";
import type { LangObservation } from "../growth/vocabAgg";
import type { FirstKeepsake } from "./firstsKeepsake";
import type { GoalObservation } from "../practice/dailyPlan";
import type { ScreeningResult } from "./screening";
import { correctedAgeMonths, ageMonthsFromProfile } from "./childAge";
import { DOMAIN_IDS, toDomains, type DomainId } from "./domains/registry";

export type ObservationKind =
  | "moment"
  | "milestone"
  | "measurement"
  | "concern"
  | "practice"
  | "professional_note"
  | "parent_reflection";

export type ObservationSource =
  | "parent_typed"
  | "parent_voice"
  | "ai_proposed_parent_confirmed"
  | "kid_practice"
  | "professional_entered"
  | "document_extracted";

/** Which existing collection the observation was read from. */
export type ObservationOrigin =
  | "behaviorLogs"
  | "milestones"
  | "keepsakes"
  | "growthEntries"
  | "langObs"
  | "goalObservations"
  | "screenings"
  | "playLogs"
  | "speechAttempts"
  | "practiceEvents"
  | "mimicSessions"
  | "adventureResults"
  | "missionRecords"
  | "memory";

/** Typed per kind; descriptive facts only. */
export type ObservationValue =
  | { type: "moment"; behaviorType: string; context?: string }
  | { type: "milestone"; milestoneId: string; title: string }
  | { type: "keepsake"; milestoneId: string; note: string }
  | { type: "measurement"; heightCm?: number; weightKg?: number; headCircumferenceCm?: number }
  | { type: "word"; language: string; phrase: string }
  | { type: "goal_note"; goalId: string; text: string }
  | { type: "check"; bandId: string }
  | { type: "play"; activityId: string; title: string }
  | { type: "practice"; activity: string }
  | { type: "fact"; fact: string };

export interface Observation {
  /** `${origin}:${source record id}` — stable, one per source record. */
  id: string;
  childId: string;
  /** ISO timestamp / date the thing happened (or was noticed). */
  at: string;
  /** ≥1 registry domain, registry order. */
  domains: DomainId[];
  subArea?: string;
  kind: ObservationKind;
  value: ObservationValue;
  source: ObservationSource;
  origin: ObservationOrigin;
  /** conversationProposalId / goal id / practice record id, when one exists. */
  provenance?: string;
  /** The child's age when it happened, in months (preterm-corrected under 24 m). */
  ageAtObservationMonths: number | null;
  pretermCorrected: boolean;
}

/** Records the read model folds. Every list is optional (absent = not loaded). */
export interface ObservationSources {
  behaviorLogs?: BehaviorLog[];
  milestones?: Milestone[];
  keepsakes?: FirstKeepsake[];
  growthEntries?: GrowthEntry[];
  langObs?: LangObservation[];
  goalObservations?: GoalObservation[];
  screenings?: (ScreeningResult & { id: string })[];
  playLogs?: PlayLog[];
  speechAttempts?: SpeechAttempt[];
  practiceEvents?: PracticeEvent[];
  mimicSessions?: MimicSession[];
  adventureResults?: AdventureResult[];
  missionRecords?: MissionRecord[];
  /** Approved memory facts that carry domains (B-GROWTH-29); untagged facts are left out. */
  memoryFacts?: { id: string; fact: string; at: string; domains?: string[] }[];
}

export type ObservationChild = Pick<ChildProfile, "id"> & Partial<ChildProfile>;

const validDate = (s: string | undefined | null): s is string => !!s && Number.isFinite(Date.parse(s));

function ageAt(child: ObservationChild, at: string): { months: number | null; corrected: boolean } {
  const when = new Date(at);
  const profile = child as ChildProfile;
  const chrono = ageMonthsFromProfile(profile, when);
  if (chrono === null) return { months: null, corrected: false };
  const corrected = correctedAgeMonths(profile, when);
  return { months: corrected ?? chrono, corrected: corrected !== null && corrected !== chrono };
}

const ordered = (doms: DomainId[]): DomainId[] => DOMAIN_IDS.filter((d) => doms.includes(d));

/**
 * Fold the sources into observations, newest first. One observation per
 * source record that has a date and ≥1 resolvable domain.
 */
export function toObservations(sources: ObservationSources, child: ObservationChild): Observation[] {
  const out: Observation[] = [];
  const push = (
    origin: ObservationOrigin,
    recordId: string,
    at: string | undefined,
    domains: DomainId[],
    rest: Pick<Observation, "kind" | "value" | "source"> & { subArea?: string; provenance?: string },
  ) => {
    if (!validDate(at) || domains.length === 0) return;
    const { months, corrected } = ageAt(child, at);
    out.push({
      id: `${origin}:${recordId}`,
      childId: child.id,
      at,
      domains: ordered(domains),
      origin,
      ageAtObservationMonths: months,
      pretermCorrected: corrected,
      ...rest,
    });
  };

  for (const l of sources.behaviorLogs ?? []) {
    // every behaviour type lands in feelings & behaviour (spine §2); free-text
    // types the taxonomy does not know still do
    const doms = toDomains("behavior", l.behaviorType);
    push("behaviorLogs", l.id, l.timestamp, doms.length ? doms : ["feelings"], {
      kind: "moment",
      value: { type: "moment", behaviorType: l.behaviorType, ...(l.context ? { context: l.context } : {}) },
      source: l.conversationProposalId ? "ai_proposed_parent_confirmed" : "parent_typed",
      ...(l.conversationProposalId ? { provenance: l.conversationProposalId } : {}),
    });
  }

  const milestoneById = new Map((sources.milestones ?? []).map((m) => [m.id, m]));
  for (const m of sources.milestones ?? []) {
    // only what the parent NOTICED is on the record; "not yet" is not a fact
    // about the child that the record counts
    if (!m.checked) continue;
    push("milestones", m.id, m.observationUpdatedAt, toDomains("developmental", m.domain), {
      kind: "milestone",
      value: { type: "milestone", milestoneId: m.id, title: m.title },
      source: "parent_typed",
    });
  }

  for (const k of sources.keepsakes ?? []) {
    const m = milestoneById.get(k.milestoneId);
    push("keepsakes", k.milestoneId, k.noticedOn, m ? toDomains("developmental", m.domain) : [], {
      kind: "parent_reflection",
      value: { type: "keepsake", milestoneId: k.milestoneId, note: k.note },
      source: "parent_typed",
      provenance: k.milestoneId,
    });
  }

  for (const g of sources.growthEntries ?? []) {
    const value: ObservationValue = { type: "measurement" };
    if (typeof g.heightCm === "number") value.heightCm = g.heightCm;
    if (typeof g.weightKg === "number") value.weightKg = g.weightKg;
    if (typeof g.headCircumferenceCm === "number") value.headCircumferenceCm = g.headCircumferenceCm;
    push("growthEntries", g.id, g.date, ["body"], {
      kind: "measurement", value, source: "parent_typed", subArea: "growth_measurements",
    });
  }

  for (const w of sources.langObs ?? []) {
    push("langObs", w.id, w.timestamp, ["talking"], {
      kind: "moment",
      value: { type: "word", language: w.language, phrase: w.phrase },
      source: "parent_typed",
      subArea: "expressive",
    });
  }

  for (const o of sources.goalObservations ?? []) {
    push("goalObservations", o.id, o.timestamp, toDomains("play", o.capabilityNodeId), {
      kind: "parent_reflection",
      value: { type: "goal_note", goalId: o.goalId, text: o.observationText },
      source: "parent_typed",
      provenance: o.goalId,
    });
  }

  for (const s of sources.screenings ?? []) {
    // the parent's own answers; the areas they said they would like to talk
    // about are a concern, the rest a reflection — never a band or a verdict
    const watch = s.watchAreas.map((d) => d.domain as string);
    const doms = s.elevated && watch.length
      ? toDomains("screen", watch[0]).concat(...watch.slice(1).map((d) => toDomains("screen", d)))
      : s.domains.flatMap((d) => toDomains("screen", d.domain));
    push("screenings", s.id, s.answeredAt, [...new Set(doms)], {
      kind: s.elevated && watch.length ? "concern" : "parent_reflection",
      value: { type: "check", bandId: s.bandId },
      source: "parent_typed",
    });
  }

  for (const p of sources.playLogs ?? []) {
    push("playLogs", p.id, p.timestamp, toDomains("play", p.domain, { activityId: p.activityId }), {
      kind: "practice",
      value: { type: "play", activityId: p.activityId, title: p.title },
      source: "parent_typed",
    });
  }

  for (const a of sources.speechAttempts ?? []) {
    // parent-scored only (spine §3): the recogniser path is not the parent's record
    if (a.method !== "parent") continue;
    push("speechAttempts", a.id, a.timestamp, ["talking"], {
      kind: "practice",
      value: { type: "practice", activity: `speech:${a.sound}` },
      source: "parent_typed",
      subArea: "speech_sounds",
    });
  }

  for (const e of sources.practiceEvents ?? []) {
    push("practiceEvents", e.id, e.timestamp, toDomains("practice", e.domain), {
      kind: "practice", value: { type: "practice", activity: e.kind }, source: "kid_practice", provenance: e.id,
    });
  }

  for (const s of sources.mimicSessions ?? []) {
    // Mimic Studio → hands + playing with others (spine §7b)
    push("mimicSessions", s.id, s.timestamp, ["hands", "playing"], {
      kind: "practice", value: { type: "practice", activity: `mimic:${s.packId}` }, source: "kid_practice", provenance: s.id,
    });
  }

  for (const r of sources.adventureResults ?? []) {
    push("adventureResults", r.id, r.timestamp, ["thinking"], {
      kind: "practice", value: { type: "practice", activity: `adventure:${r.skill}` }, source: "kid_practice", provenance: r.id,
    });
  }

  for (const m of sources.missionRecords ?? []) {
    if (!m.completed) continue;
    push("missionRecords", m.id, m.timestamp, toDomains("practice", m.domain), {
      kind: "practice", value: { type: "practice", activity: `mission:${m.missionId}` }, source: "parent_typed", provenance: m.id,
    });
  }

  for (const f of sources.memoryFacts ?? []) {
    const doms = (f.domains ?? []).filter((d): d is DomainId => (DOMAIN_IDS as readonly string[]).includes(d));
    push("memory", f.id, f.at, doms, {
      kind: "parent_reflection", value: { type: "fact", fact: f.fact }, source: "ai_proposed_parent_confirmed", provenance: f.id,
    });
  }

  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Per-domain counts and dates — integers and ISO strings only. */
export interface DomainSummary {
  domain: DomainId;
  /** Observations in the last 28 days. */
  count4w: number;
  /** Observations in the last 84 days. */
  count12w: number;
  /** ISO timestamp of the newest observation, or null. */
  latestAt: string | null;
  /** The dates of the newest three observations (ISO, newest first). */
  latest: string[];
}

const DAY = 86_400_000;

/**
 * Counts per domain over the last 4 and 12 weeks plus the latest dates.
 * Domains with no observation at all are absent (an empty row is not a fact).
 * Registry order — never sorted by count.
 */
export function summariseByDomain(observations: Observation[], now: Date = new Date()): DomainSummary[] {
  const t = now.getTime();
  const by = new Map<DomainId, Observation[]>();
  for (const o of observations) for (const d of o.domains) {
    const list = by.get(d) ?? [];
    list.push(o);
    by.set(d, list);
  }
  const out: DomainSummary[] = [];
  for (const domain of DOMAIN_IDS) {
    const list = by.get(domain);
    if (!list || list.length === 0) continue;
    const sorted = [...list].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const age = (o: Observation) => t - Date.parse(o.at);
    out.push({
      domain,
      count4w: sorted.filter((o) => age(o) >= 0 && age(o) < 28 * DAY).length,
      count12w: sorted.filter((o) => age(o) >= 0 && age(o) < 84 * DAY).length,
      latestAt: sorted[0]?.at ?? null,
      latest: sorted.slice(0, 3).map((o) => o.at),
    });
  }
  return out;
}
