/**
 * Developmental monitoring layer (ASQ-3 / CDC "Learn the Signs. Act Early."-style
 * SURVEILLANCE — Mission M8).
 *
 * This is a PURE, framework-free module. It folds the child's own data
 * (milestones already tracked in the app + everyday behavior logs) into calm,
 * non-diagnostic "monitoring-zone" / watch signals and a parent-readable note.
 *
 * HARD, NON-NEGOTIABLE FRAMING (do not "improve" this away):
 *  - This is developmental MONITORING (surveillance), never screening-as-test and
 *    NEVER a diagnosis, score, probability, risk percentage, or condition name.
 *  - Output is only ever "on track" vs "worth discussing with your provider".
 *  - Every note ends in a gentle "discuss with your provider" call, because a
 *    conversation never hurts and parents know their child best.
 *
 * It deliberately reuses the same six developmental domains as the rest of Arbor
 * and the existing `screening.ts` domain set, and is consumed by the parent
 * register (the Screening / Development surface) and the existing report
 * exporter in `reportExport.ts`.
 */
import type { BehaviorLog, Milestone, DevelopmentalDomainId } from "../types";
import { assertClinicianExportCeiling } from "../consult/packet";

/** The six monitored developmental domains (the ecosystem domain is contextual,
 *  not a child-skill domain, so it is intentionally excluded from monitoring). */
export type MonitoredDomainId = Exclude<DevelopmentalDomainId, "ecosystem_stressors">;

export const MONITORED_DOMAIN_LABEL: Record<MonitoredDomainId, string> = {
  attachment_regulation: "Attachment & regulation",
  language_communication: "Language & communication",
  cognition_executive_function: "Thinking & attention",
  social_development: "Social development",
  independence_adaptive_skills: "Independence & daily skills",
  sensory_motor_patterns: "Sensory & movement",
};

const MONITORED_DOMAINS = Object.keys(MONITORED_DOMAIN_LABEL) as MonitoredDomainId[];

export type WatchLevel = "on_track" | "monitor";

/** Why a domain entered the monitoring zone — kept transparent for the parent. */
export type MonitoringReason = "milestone_overdue" | "behavior_pattern";

export interface DomainSignal {
  domain: MonitoredDomainId;
  label: string;
  level: WatchLevel;
  /** The contributing reasons, present only when level === "monitor". */
  reasons: MonitoringReason[];
  /** Milestones expected by the child's age that the parent has ANSWERED and
   *  not yet observed. Never-answered milestones are absent by construction
   *  (P1-C — see `isMilestoneAnswered`).
   *  UND-4: the parent's actual response survives — `status` distinguishes
   *  "parent is not sure" from "parent has not seen it", and `observedAt`
   *  carries when the parent recorded that response (absent on legacy items). */
  overdueMilestones: { id: string; title: string; ageGroup: string; status: "not_sure" | "not_yet"; observedAt?: string }[];
  /** Count of recent, intense, unresolved everyday moments in this domain. */
  patternMoments: number;
  /** Calm, non-diagnostic, parent-facing note. Always ends in a provider nudge. */
  note: string;
}

export interface MonitoringResult {
  generatedAt: string;
  ageMonths: number;
  domains: DomainSignal[];
  /** Only the domains worth raising with a provider. */
  watchAreas: DomainSignal[];
  /** True when at least one domain is in the monitoring zone. */
  elevated: boolean;
  /** Plain-language one-liner for headers. Never diagnostic. */
  headline: string;
}

export interface MonitoringInput {
  ageYears: number;
  milestones?: Milestone[];
  behaviorLogs?: BehaviorLog[];
  /** Injectable clock for deterministic tests. */
  now?: number;
}

const DAY = 24 * 60 * 60 * 1000;
/** Recent window for behavior-pattern surveillance. */
const PATTERN_WINDOW_DAYS = 28;
/** A moment counts toward a pattern when it is intense and not yet resolved. */
const PATTERN_INTENSITY_MIN = 4;
/** Repeated intense, unresolved moments in one domain before we suggest a chat. */
const PATTERN_COUNT_MIN = 3;
/** Grace period: only flag a milestone "overdue" once the child is clearly past
 *  the band (development varies — we never flag at the edge of a window). */
const OVERDUE_GRACE_MONTHS = 2;

/**
 * Has the parent actually ANSWERED this milestone?
 *
 * FIREWALL-ADJACENT, LOAD-BEARING (P1-C, 2026-08-12 audit — do not "simplify"
 * this back to `!m.checked`). Milestones are seeded unanswered: the whole CDC
 * catalogue arrives with `checked: false` and no observation record. Scoring
 * that identically to "the parent looked and has not seen it yet" turned pure
 * ABSENCE OF DATA into a deficit claim — a brand-new account with zero logs was
 * told "One language & communication skill that's typically seen by now hasn't
 * been noted yet for <child>. Worth mentioning to your pediatrician."
 *
 * Only a recorded parent response counts:
 *   - an explicit "not_yet" / "not_sure" observationStatus, or
 *   - a legacy row that carries an observation timestamp but no status (written
 *     before observationStatus existed — a real response either way).
 * "yes" never reaches here (those rows are `checked` and skipped upstream).
 * Everything else is UNANSWERED and can never produce a watch signal.
 */
export function isMilestoneAnswered(
  m: Pick<Milestone, "observationStatus" | "observationUpdatedAt">,
): boolean {
  if (m.observationStatus === "not_yet" || m.observationStatus === "not_sure") return true;
  if (m.observationStatus != null) return false; // "yes" — handled by `checked`
  return typeof m.observationUpdatedAt === "string" && m.observationUpdatedAt.trim().length > 0;
}

/**
 * Parse the human milestone `ageGroup` label (e.g. "2 months", "18 months",
 * "2 years", "Age 4-5", "3-5y") into an approximate month value representing the
 * AGE BY WHICH the skill is typically expected. Ranges resolve to the upper
 * bound so we never flag a child who is still inside the typical window.
 * Returns null when unparseable (such milestones are skipped, never guessed).
 */
export function ageGroupToMonths(ageGroup: string): number | null {
  if (!ageGroup) return null;
  const s = ageGroup.toLowerCase();

  // Collect all numbers in order; a range like "4-5" yields [4, 5].
  const nums = (s.match(/\d+(\.\d+)?/g) || []).map(Number).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return null;
  const upper = Math.max(...nums);

  if (/month/.test(s)) return upper;
  if (/year|y\b|yr/.test(s)) return Math.round(upper * 12);
  // Bare "Age 4-5" style — Arbor uses these as YEARS by convention.
  return Math.round(upper * 12);
}

const clampMonths = (years: number): number =>
  Math.max(0, Math.round((Number.isFinite(years) ? years : 0) * 12));

const inWindow = (ts: string | undefined, now: number, days: number): boolean => {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return false;
  return t > now - days * DAY && t <= now;
};

/**
 * Map a free-text behavior log to a monitored domain via light keyword cues.
 * Conservative by design: unknown behaviors map to regulation (the broadest,
 * safest catch-all for "something felt hard") so we never invent a specific
 * domain claim the data can't support. Returns null only for empty input.
 */
export function classifyBehaviorDomain(log: Pick<BehaviorLog, "behaviorType" | "trigger" | "notes">): MonitoredDomainId | null {
  const hay = `${log.behaviorType || ""} ${log.trigger || ""} ${log.notes || ""}`.toLowerCase();
  if (!hay.trim()) return null;
  if (/(word|speak|talk|language|babble|sentence|stutter|verbal|communicat)/.test(hay)) return "language_communication";
  if (/(friend|peer|play|share|eye contact|social|alone|withdraw|turn-tak)/.test(hay)) return "social_development";
  if (/(focus|attention|distract|task|instruction|memory|learn|concentrat)/.test(hay)) return "cognition_executive_function";
  if (/(sleep|eat|food|dress|toilet|potty|routine|self-care|independ)/.test(hay)) return "independence_adaptive_skills";
  if (/(sensor|sound|noise|texture|touch|motor|clumsy|balance|movement|light)/.test(hay)) return "sensory_motor_patterns";
  // Default: meltdowns, tantrums, anxiety, clinginess → attachment & regulation.
  return "attachment_regulation";
}

/**
 * UND-1 (localization): these EN note strings feed the clinician printable
 * (buildMonitoringReportDoc) and the notification bell. The parent-facing
 * Development Check surface does NOT render `note` directly — it rebuilds the
 * same templates through i18n keys ("screen.monitor.note.*" in lib/i18n.ts)
 * from the signal's structured facts, so HE parity holds on-screen while this
 * module stays pure and framework-free.
 */
function buildNote(
  childFirst: string,
  domain: MonitoredDomainId,
  reasons: MonitoringReason[],
  overdueCount: number,
  patternMoments: number,
): string {
  const name = childFirst || "Your child";
  const area = MONITORED_DOMAIN_LABEL[domain].toLowerCase();
  const parts: string[] = [];

  if (reasons.includes("milestone_overdue")) {
    parts.push(
      overdueCount === 1
        ? `One ${area} skill that's typically seen by now hasn't been noted yet for ${name}.`
        : `${overdueCount} ${area} skills typically seen by now haven't been noted yet for ${name}.`,
    );
  }
  if (reasons.includes("behavior_pattern")) {
    parts.push(
      `You've logged ${patternMoments} intense, unsettled ${area} moments recently.`,
    );
  }

  // The non-negotiable, non-diagnostic close.
  parts.push(
    "Children develop at their own pace and this isn't a diagnosis — it's simply worth mentioning to your provider at your next visit.",
  );
  return parts.join(" ");
}

/**
 * Derive calm, non-diagnostic monitoring signals from the child's own data.
 *
 * A domain enters the "monitor" zone when EITHER:
 *  - a milestone the parent has ANSWERED "not yet" / "not sure" is clearly past
 *    the child's age band (with a 2-month grace so we never flag at the edge of
 *    a window). Milestones the parent has never responded to are excluded —
 *    see `isMilestoneAnswered`; no answer is not a negative answer — OR
 *  - there is a recent cluster of intense, unresolved everyday moments.
 *
 * Pure: no I/O, no Date.now() unless `now` is omitted.
 */
export function deriveMonitoring(input: MonitoringInput, childFirstName = ""): MonitoringResult {
  const now = input.now ?? Date.now();
  const ageMonths = clampMonths(input.ageYears);
  const milestones = input.milestones ?? [];
  const logs = input.behaviorLogs ?? [];

  // 1) Overdue (past-band, ANSWERED-but-unobserved) milestones grouped by
  //    domain. `isMilestoneAnswered` is the gate that keeps "never asked" out
  //    of the watch signal (P1-C) — absence of an answer is not evidence.
  const overdueByDomain = new Map<MonitoredDomainId, DomainSignal["overdueMilestones"]>();
  for (const m of milestones) {
    if (m.checked) continue;
    if (!isMilestoneAnswered(m)) continue;
    if (m.domain === "ecosystem_stressors") continue;
    const due = ageGroupToMonths(m.ageGroup);
    if (due == null) continue;
    if (ageMonths >= due + OVERDUE_GRACE_MONTHS) {
      const list = overdueByDomain.get(m.domain as MonitoredDomainId) ?? [];
      list.push({
        id: m.id,
        title: m.title,
        ageGroup: m.ageGroup,
        status: m.observationStatus === "not_sure" ? "not_sure" : "not_yet",
        observedAt: m.observationUpdatedAt,
      });
      overdueByDomain.set(m.domain as MonitoredDomainId, list);
    }
  }

  // 2) Recent intense, unresolved behavior moments grouped by domain.
  const patternByDomain = new Map<MonitoredDomainId, number>();
  for (const l of logs) {
    if (!inWindow(l.timestamp, now, PATTERN_WINDOW_DAYS)) continue;
    if (l.resolved) continue;
    if ((l.intensity ?? 0) < PATTERN_INTENSITY_MIN) continue;
    const domain = classifyBehaviorDomain(l);
    if (!domain) continue;
    patternByDomain.set(domain, (patternByDomain.get(domain) ?? 0) + 1);
  }

  const domains: DomainSignal[] = MONITORED_DOMAINS.map((domain) => {
    const overdue = overdueByDomain.get(domain) ?? [];
    const patternMoments = patternByDomain.get(domain) ?? 0;
    const reasons: MonitoringReason[] = [];
    if (overdue.length > 0) reasons.push("milestone_overdue");
    if (patternMoments >= PATTERN_COUNT_MIN) reasons.push("behavior_pattern");
    const level: WatchLevel = reasons.length > 0 ? "monitor" : "on_track";
    return {
      domain,
      label: MONITORED_DOMAIN_LABEL[domain],
      level,
      reasons,
      overdueMilestones: overdue,
      patternMoments,
      note:
        level === "monitor"
          ? buildNote(childFirstName, domain, reasons, overdue.length, patternMoments)
          : `${MONITORED_DOMAIN_LABEL[domain]} looks on track from what you've logged so far.`,
    };
  });

  const watchAreas = domains.filter((d) => d.level === "monitor");
  const name = childFirstName || "Your child";
  const headline = watchAreas.length
    ? watchAreas.length === 1
      ? "One area is worth mentioning to your provider"
      : `${watchAreas.length} areas are worth mentioning to your provider`
    : `${name} looks on track across the areas Arbor is watching`;

  return {
    generatedAt: new Date(now).toISOString(),
    ageMonths,
    domains,
    watchAreas,
    elevated: watchAreas.length > 0,
    headline,
  };
}

/**
 * UND-3 — the "Gentle watch points" card content, derived from the SAME
 * canonical monitoring derivation as every other watch surface. Real domain
 * names + counts only: a domain appears IFF it has unobserved milestones past
 * the child's (corrected) age band, with the count of those milestones.
 * Behavior-pattern-only domains are excluded (the card is about the
 * "not seen yet" milestone column, and a 0-skill count would be a false
 * claim). Empty array = nothing is unobserved → the caller hides the card or
 * shows a neutral line. Never severity/verdict language — the caller renders
 * counts through i18n templates.
 */
export function watchPointsSummary(
  result: MonitoringResult,
  max = 2,
): { domain: MonitoredDomainId; count: number }[] {
  return result.watchAreas
    .filter((d) => d.reasons.includes("milestone_overdue") && d.overdueMilestones.length > 0)
    .sort(
      (a, b) =>
        b.overdueMilestones.length - a.overdueMilestones.length ||
        a.domain.localeCompare(b.domain),
    )
    .slice(0, max)
    .map((d) => ({ domain: d.domain, count: d.overdueMilestones.length }));
}

/**
 * Pick the single highest-signal domain to surface in the "Arbor noticed" card.
 *
 * Priority: a domain with BOTH reasons > milestone_overdue only >
 * behavior_pattern only > on_track (calm encouragement). When multiple domains
 * share the same level, prefers the one with the highest overdue-milestone count
 * (broadest signal), then alphabetic tie-break for determinism.
 *
 * Returns null only when `result.domains` is empty (no data whatsoever).
 */
export function pickHighestWatchSignal(result: MonitoringResult): DomainSignal | null {
  if (result.domains.length === 0) return null;

  const priority = (d: DomainSignal): number => {
    if (d.reasons.includes("milestone_overdue") && d.reasons.includes("behavior_pattern")) return 3;
    if (d.reasons.includes("milestone_overdue")) return 2;
    if (d.reasons.includes("behavior_pattern")) return 1;
    return 0;
  };

  return [...result.domains].sort((a, b) => {
    const pa = priority(a), pb = priority(b);
    if (pa !== pb) return pb - pa;
    // Tie on priority: more overdue milestones first.
    const oa = a.overdueMilestones.length, ob = b.overdueMilestones.length;
    if (oa !== ob) return ob - oa;
    return a.domain.localeCompare(b.domain);
  })[0];
}

/**
 * Map a monitored developmental domain to the nearest Daily-Play concern domain
 * so the "Arbor noticed" card can link to a relevant expert-cited activity when
 * one exists. Returns null for domains with no clear play-domain analog.
 *
 * This is a view-side concern: monitoring.ts is pure and does not import from
 * the playbank, so the mapping lives here as a small exported helper.
 */
export type PlayDomainHint = "regulation" | "language" | "social" | "cognitive" | "motor";

export function monitoredDomainToPlayHint(domain: MonitoredDomainId): PlayDomainHint {
  const map: Record<MonitoredDomainId, PlayDomainHint> = {
    attachment_regulation: "regulation",
    language_communication: "language",
    cognition_executive_function: "cognitive",
    social_development: "social",
    independence_adaptive_skills: "regulation",
    sensory_motor_patterns: "motor",
  };
  return map[domain];
}

/**
 * Shape the monitoring result into the existing `ReportDoc` structure consumed
 * by `openPrintableReport`, so providers get the same branded, non-diagnostic
 * printable as every other Arbor handoff. Kept here (not in reportExport.ts) so
 * the shared exporter file stays untouched and additive-only.
 */
export function buildMonitoringReportDoc(
  result: MonitoringResult,
  childName: string,
  childAgeYears: number,
): { title: string; subtitle: string; sections: { heading: string; body: string | string[] }[] } {
  const sections: { heading: string; body: string | string[] }[] = [
    {
      heading: "What this is",
      body: "A parent-prepared developmental-monitoring summary (surveillance, not screening or diagnosis), built from milestones the parent has tracked and everyday moments they've logged in Arbor.",
    },
    {
      heading: "Areas to discuss",
      body: result.watchAreas.length
        ? result.watchAreas.map((d) => `${d.label}: ${d.note}`)
        : "No areas are currently flagged. Shared for a routine developmental check-in.",
    },
  ];

  // UND-4: preserve the parent's actual response in the provider printable —
  // "not sure" renders as its OWN group with the date the parent recorded it,
  // never collapsed into "not yet". Factual lines only; no verdicts.
  const overdueLine = (label: string, m: DomainSignal["overdueMilestones"][number], marked: string): string => {
    const date = m.observedAt && Number.isFinite(new Date(m.observedAt).getTime()) ? m.observedAt.slice(0, 10) : null;
    return `${label} — “${m.title}” (typically by ${m.ageGroup}${date ? `; parent marked "${marked}" on ${date}` : ""})`;
  };
  const notSure = result.watchAreas.flatMap((d) =>
    d.overdueMilestones.filter((m) => m.status === "not_sure").map((m) => overdueLine(d.label, m, "not sure")),
  );
  if (notSure.length) {
    sections.push({ heading: "Skills the parent is not sure about (past typical window)", body: notSure });
  }
  const overdue = result.watchAreas.flatMap((d) =>
    d.overdueMilestones.filter((m) => m.status !== "not_sure").map((m) => overdueLine(d.label, m, "not yet")),
  );
  if (overdue.length) {
    sections.push({ heading: "Skills not yet observed (past typical window)", body: overdue });
  }

  const patterns = result.watchAreas
    .filter((d) => d.patternMoments > 0)
    .map((d) => `${d.label}: ${d.patternMoments} intense, unresolved moments logged in the last 4 weeks`);
  if (patterns.length) {
    sections.push({ heading: "Recent everyday patterns", body: patterns });
  }

  sections.push({
    heading: "On-track areas",
    body: result.domains.filter((d) => d.level === "on_track").map((d) => d.label),
  });

  sections.push({
    heading: "Non-diagnostic note",
    body: "Arbor is not a medical device and does not diagnose. This monitoring summary reflects parent observations and is shared to support a clinical conversation — never to replace one.",
  });

  // IA W4.5: the monitoring printable is a clinician-facing export — bound to
  // the same clinician ceiling as the consult presets (forbidden tokens,
  // counts-never-percentages). Fail closed: a violating doc exports NOTHING.
  assertClinicianExportCeiling(
    sections.flatMap((s) => [s.heading, ...(Array.isArray(s.body) ? s.body : [s.body])]).join("\n"),
  );

  return {
    title: "Developmental Monitoring Summary",
    subtitle: `${childName}, age ${childAgeYears}`,
    sections,
  };
}
