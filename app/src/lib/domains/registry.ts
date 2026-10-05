/**
 * B-GROWTH-26 — ONE developmental domain registry (spine phase 0, Guy D1 + D2,
 * 1 Oct 2026).
 *
 * Arbor grew four private domain vocabularies — `DevelopmentalDomainId` (the
 * milestone catalogue + framework.json), `ScreenDomainId` (Development Check),
 * `PracticeDomain` (kid practice signals) and `PlayDomain` (Daily Play) — plus
 * the behaviour types, and four ad-hoc maps between them. This file is the one
 * taxonomy they all resolve to: eight parent-facing domains, in the order the
 * spine table lists them (`ARBOR-DEEP-ANALYSIS-DEVELOPMENTAL-SPINE` §2).
 *
 * Rules:
 *  - Parent-facing NAMES live in `lib/i18nElevation/domains.ts` (EN + HE) and
 *    are reached through `labelKey` — never a literal here, never a component's
 *    private dictionary (guarded by `noPrivateVocab.guard.test.ts`).
 *  - `professions` is OUTPUT METADATA ONLY (D2: professions are lenses). It is
 *    never rendered outside Care, where the parent chooses whom they prepare for.
 *  - Read-side lookup only: stored data keeps its own ids (no re-keying).
 *  - Pure: no React, no i18n runtime — `t` is injected where a label is built.
 */
import type { DevelopmentalDomainId, PracticeDomain } from "../../types";
import type { ScreenDomainId } from "../screening";
import type { PlayDomain } from "../../playbank/content";
import type { CanonicalBehaviorType } from "../../content/behaviorTaxonomy";
import { en as DOMAIN_NAMES_EN } from "../i18nElevation/domains";

export type DomainId =
  | "talking"
  | "moving"
  | "hands"
  | "thinking"
  | "playing"
  | "feelings"
  | "body"
  | "family";

/** Professions who own a domain (output lenses only — spine §5, D2). */
export type Profession =
  | "slp"
  | "audiology"
  | "pt"
  | "ot"
  | "pediatrician"
  | "dietitian"
  | "sleep_specialist"
  | "developmental_psychologist"
  | "educational_psychologist"
  | "child_psychologist"
  | "behavioral_therapist"
  | "teacher"
  | "social_worker"
  | "parent_coach";

export interface DomainDef {
  id: DomainId;
  /** Parent-facing name, `lib/i18nElevation/domains.ts` (EN + HE). */
  labelKey: string;
  /** Lower-case form for use inside a sentence ("because {area} came up"). */
  inlineKey: string;
  /** Output metadata — never rendered outside Care (D2). */
  professions: readonly Profession[];
  /** Observable sub-areas the record tracks (spine §2). Metadata, not copy. */
  subAreas: readonly string[];
  /** framework.json domain ids this domain draws on. */
  frameworkRefs: readonly DevelopmentalDomainId[];
  /** The PRIMARY counterpart in each legacy vocabulary, when one exists. Used
   *  only by `fromDomain`/`translate` to keep legacy consumers working. */
  practice?: PracticeDomain;
  play?: PlayDomain;
}

const d = (def: Omit<DomainDef, "labelKey" | "inlineKey">): DomainDef => ({
  ...def,
  labelKey: `elev.domains.${def.id}`,
  inlineKey: `elev.domains.${def.id}.inline`,
});

/** The eight domains, in registry order (spine §2 table order). */
export const DOMAINS: readonly DomainDef[] = [
  d({
    id: "talking",
    professions: ["slp", "audiology"],
    subAreas: ["receptive", "expressive", "speech_sounds", "social_communication", "bilingual_exposure", "hearing_history", "stuttering"],
    frameworkRefs: ["language_communication"],
    practice: "language",
    play: "language",
  }),
  d({
    id: "moving",
    professions: ["pt", "pediatrician"],
    subAreas: ["gross_motor", "posture", "coordination", "physical_activity"],
    frameworkRefs: ["sensory_motor_patterns"],
    play: "motor",
  }),
  d({
    id: "hands",
    professions: ["ot"],
    subAreas: ["fine_motor", "drawing_writing", "sensory_responses", "self_care_skills"],
    frameworkRefs: ["sensory_motor_patterns", "independence_adaptive_skills"],
    play: "motor",
  }),
  d({
    id: "thinking",
    professions: ["educational_psychologist", "developmental_psychologist", "teacher"],
    subAreas: ["problem_solving", "attention", "executive_function", "pre_academic", "academic", "memory"],
    frameworkRefs: ["cognition_executive_function"],
    practice: "cognition",
    play: "cognitive",
  }),
  d({
    id: "playing",
    professions: ["developmental_psychologist", "teacher"],
    subAreas: ["joint_attention", "play_stages", "peer_relations", "empathy"],
    frameworkRefs: ["social_development"],
    practice: "social",
    play: "social",
  }),
  d({
    id: "feelings",
    professions: ["child_psychologist", "behavioral_therapist"],
    subAreas: ["regulation", "attachment", "anxiety", "behaviour_types", "transitions", "sibling_conflict"],
    frameworkRefs: ["attachment_regulation"],
    practice: "emotional",
    play: "regulation",
  }),
  d({
    id: "body",
    professions: ["pediatrician", "dietitian", "sleep_specialist"],
    subAreas: ["growth_measurements", "sleep", "feeding_nutrition", "illness", "vision_hearing_checks", "preterm_correction"],
    frameworkRefs: ["health_sleep_feeding"],
  }),
  d({
    id: "family",
    professions: ["social_worker", "parent_coach"],
    subAreas: ["parental_stress", "routines", "school_context", "life_events", "screen_time"],
    frameworkRefs: ["ecosystem_stressors"],
  }),
];

/** The ONE domain count (#/science, the professional line, the pulse tiles). */
export const DOMAIN_COUNT = DOMAINS.length;

export const DOMAIN_IDS: readonly DomainId[] = DOMAINS.map((x) => x.id);

const BY_ID = new Map<DomainId, DomainDef>(DOMAINS.map((x) => [x.id, x]));

export function domainDef(id: DomainId): DomainDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`unknown domain ${id}`);
  return def;
}

export function isDomainId(v: unknown): v is DomainId {
  return typeof v === "string" && BY_ID.has(v as DomainId);
}

/** Registry position (0-based) — the one sort order for domain lists. */
export function domainOrder(id: DomainId): number {
  return DOMAIN_IDS.indexOf(id);
}

/* ── The four vocabularies + behaviour types → registry domains ───────────── */

export type Vocab = "developmental" | "screen" | "practice" | "play" | "behavior";

/** framework.json order — the milestone catalogue's domain list (Milestones
 *  Map, add-milestone select). Pinned against framework.json by the test. */
export const DEVELOPMENTAL_DOMAIN_IDS: readonly DevelopmentalDomainId[] = [
  "attachment_regulation",
  "language_communication",
  "cognition_executive_function",
  "social_development",
  "independence_adaptive_skills",
  "sensory_motor_patterns",
  "ecosystem_stressors",
  "health_sleep_feeding",
];

const DEVELOPMENTAL: Record<DevelopmentalDomainId, readonly DomainId[]> = {
  attachment_regulation: ["feelings"],
  language_communication: ["talking"],
  cognition_executive_function: ["thinking"],
  social_development: ["playing"],
  independence_adaptive_skills: ["hands"],
  // the PT/OT fork: half the motor lump is gross motor, half fine motor + senses
  sensory_motor_patterns: ["moving", "hands"],
  ecosystem_stressors: ["family"],
  health_sleep_feeding: ["body"],
};

const SCREEN: Record<ScreenDomainId, readonly DomainId[]> = {
  attachment_regulation: ["feelings"],
  language_communication: ["talking"],
  cognition_executive_function: ["thinking"],
  social_development: ["playing"],
  independence_adaptive_skills: ["hands"],
  sensory_motor_patterns: ["moving", "hands"],
};

const PRACTICE: Record<PracticeDomain, readonly DomainId[]> = {
  language: ["talking"],
  speech: ["talking"],
  cognition: ["thinking"],
  social: ["playing"],
  emotional: ["feelings"],
};

/** Practice ids that sit in a sub-area of their domain (rendered as
 *  "{domain} · {sub-area}" so two practice rows never read identically). */
const PRACTICE_SUBAREA: Partial<Record<PracticeDomain, string>> = {
  speech: "speech_sounds",
};

const PLAY: Record<PlayDomain, readonly DomainId[]> = {
  regulation: ["feelings"],
  language: ["talking"],
  motor: ["moving"], // default 2; fine-motor activities → 3 (FINE_MOTOR_ACTIVITY_IDS)
  cognitive: ["thinking"],
  social: ["playing"],
};

/** Daily Play `motor` activities that build hands, not gross movement (spine §2
 *  "motor → 2 or 3 by activity"). Every id is pinned to a real motor activity
 *  in the playbank by registry.test.ts. */
export const FINE_MOTOR_ACTIVITY_IDS: ReadonlySet<string> = new Set([
  "motor-grasp-scarf",
  "motor-hand-to-hand-pass",
  "motor-soft-finger-food-pincer",
  "motor-chunky-crayon-scribble",
  "motor-stack-and-topple",
  "motor-cup-pour-transfer",
  "motor-sticker-peel-place",
  "motor-peg-drop",
  "motor-play-dough-squish",
  "motor-scissor-snip",
  "motor-thread-the-pasta",
  "motor-tong-transfer",
  "motor-draw-a-person",
  "motor-hole-punch-art",
  "motor-letter-shape-copy",
  "motor-coin-stack-flip",
  "motor-origami-fold",
  "motor-newspaper-crumple",
  "ext-big-floor-mural",
]);

const BEHAVIOR: Record<CanonicalBehaviorType, readonly DomainId[]> = {
  "Transition Refusal": ["feelings"],
  "Sensory Overload": ["feelings", "hands"],
  "Screentime Dispute": ["feelings"],
  "Sibling Conflict": ["feelings"],
  "Food Refusal": ["feelings", "body"],
  "Sleep Meltdown": ["feelings", "body"],
  Moment: ["feelings"],
};

const TABLES: Record<Vocab, Record<string, readonly DomainId[]>> = {
  developmental: DEVELOPMENTAL,
  screen: SCREEN,
  practice: PRACTICE,
  play: PLAY,
  behavior: BEHAVIOR,
};

/** Every id each legacy vocabulary declares (the exhaustive test walks these). */
export const VOCAB_IDS: Record<Vocab, readonly string[]> = {
  developmental: Object.keys(DEVELOPMENTAL),
  screen: Object.keys(SCREEN),
  practice: Object.keys(PRACTICE),
  play: Object.keys(PLAY),
  behavior: Object.keys(BEHAVIOR),
};

/**
 * The registry domains a legacy id belongs to (≥1 for every declared id; [] for
 * an unknown/custom id). `activityId` splits PlayDomain `motor` by activity.
 * Returns a fresh array.
 */
export function toDomains(vocab: Vocab, id: string, opts?: { activityId?: string }): DomainId[] {
  if (vocab === "play" && id === "motor" && opts?.activityId && FINE_MOTOR_ACTIVITY_IDS.has(opts.activityId)) {
    return ["hands"];
  }
  const hit = Object.prototype.hasOwnProperty.call(TABLES[vocab], id) ? TABLES[vocab][id] : undefined;
  return hit ? [...hit] : [];
}

/** The first (primary) registry domain of a legacy id, or null. */
export function primaryDomain(vocab: Vocab, id: string, opts?: { activityId?: string }): DomainId | null {
  return toDomains(vocab, id, opts)[0] ?? null;
}

/** Distinct registry domains over a list of legacy ids, in registry order. */
export function distinctDomains(vocab: Vocab, ids: readonly string[]): DomainId[] {
  const seen = new Set<DomainId>();
  for (const id of ids) for (const dom of toDomains(vocab, id)) seen.add(dom);
  return DOMAIN_IDS.filter((x) => seen.has(x));
}

/** A registry domain's primary counterpart in the practice / play vocabulary. */
export function fromDomain(domain: DomainId, vocab: "practice"): PracticeDomain | undefined;
export function fromDomain(domain: DomainId, vocab: "play"): PlayDomain | undefined;
export function fromDomain(domain: DomainId, vocab: "practice" | "play"): string | undefined {
  const def = BY_ID.get(domain);
  return vocab === "practice" ? def?.practice : def?.play;
}

/**
 * Legacy-to-legacy lookup THROUGH the registry (replaces the ad-hoc maps):
 * the source id's primary domain, then that domain's counterpart.
 */
export function translate(from: Vocab, id: string, to: "practice"): PracticeDomain | undefined;
export function translate(from: Vocab, id: string, to: "play"): PlayDomain | undefined;
export function translate(from: Vocab, id: string, to: "practice" | "play"): string | undefined {
  const primary = primaryDomain(from, id);
  if (!primary) return undefined;
  return to === "practice" ? fromDomain(primary, "practice") : fromDomain(primary, "play");
}

/* ── Labels (t injected — this module stays framework-free) ───────────────── */

type T = (key: string) => string;

/** The parent-facing name of one registry domain. */
export function domainName(domain: DomainId, t: T): string {
  return t(domainDef(domain).labelKey);
}

/** The lower-case, in-sentence form of one registry domain. */
export function domainInline(domain: DomainId, t: T): string {
  return t(domainDef(domain).inlineKey);
}

/**
 * The parent-facing label of a LEGACY id: its registry domain name(s) joined
 * with " · ", plus a sub-area when the id is one ("Talking & understanding ·
 * speech sounds"). Unknown ids return `fallback` (custom data) or the id.
 */
export function domainLabel(vocab: Vocab, id: string, t: T, fallback?: string): string {
  const doms = toDomains(vocab, id);
  if (doms.length === 0) return fallback ?? id;
  const base = doms.map((x) => domainName(x, t)).join(" · ");
  const sub = vocab === "practice" ? PRACTICE_SUBAREA[id as PracticeDomain] : undefined;
  return sub ? `${base} · ${t(`elev.domains.sub.${sub}`)}` : base;
}

/** B-SHELL-28: ONE name per row — the PRIMARY registry domain of a legacy id
 *  (the first of toDomains), never the " · " cross-tag. For lists that already
 *  show each domain as its own row (the Milestones development map), where
 *  "Moving · Hands, senses & self-care" sat beside "Hands, senses & self-care". */
export function primaryDomainLabel(vocab: Vocab, id: string, t: T, fallback?: string): string {
  const doms = toDomains(vocab, id);
  return doms.length === 0 ? fallback ?? id : domainName(doms[0], t);
}

/** The ENGLISH label of a legacy id — for data modules with no reader language
 *  (watch rows, the clinician export). Rendered surfaces use `domainLabel`. */
export function domainLabelEn(vocab: Vocab, id: string, fallback?: string): string {
  return domainLabel(vocab, id, (k) => DOMAIN_NAMES_EN[k] ?? k, fallback);
}
