/* Consult packet — the warm handoff.
 *
 * Assembles a structured, parent-readable summary of the child's longitudinal
 * record so a professional opens the conversation already in context (vs the
 * cold start every competitor begins from). Pure + deterministic: the parent
 * chooses what to include (redaction, Safety L3), and nothing leaves the device
 * until they explicitly export. Non-diagnostic by construction — facts and
 * parent observations only, never a label or assessment.
 */

import { ClinicalLanguageError, findClinicalDiagnosisTerm } from "../lib/clinicalScan";
import { DOMAIN_LABEL } from "../lib/screening";
import { bandForAgeMonths, milestoneAgeWindow } from "../lib/milestoneData";
import { ageLabel } from "../lib/childAge";

export interface PacketInputProfile {
  name: string;
  age: number;
  /** RUN-01: months-precise age when known (lib/childAge). Falls back to
   *  `age * 12` — drives the age-windowed milestone denominator. */
  ageMonths?: number;
  languages: string[];
  schoolContext?: string;
  strengths?: string[];
  challenges?: string[];
}
export interface PacketInputLog {
  behaviorType: string;
  intensity: number;
  timestamp: string | number;
  trigger?: string;
  response?: string;
  resolved?: boolean;
}
export interface PacketInputMilestone {
  domain: string;
  title: string;
  checked: boolean;
  /** RUN-01: the checklist age anchor in months (CDC band). Absent on
   *  legacy/custom items — those always count toward the denominator. */
  ageMonths?: number;
  /** UND-4 (AR-CAP-08): the parent's actual response — preserved end-to-end.
   *  Absent on legacy items; derived from `checked` in that case. */
  status?: "yes" | "not_sure" | "not_yet";
  /** When the parent recorded the observation (ISO). */
  observedAt?: string;
}
export interface PacketInputPlan {
  title: string;
  issue?: string;
  /** When the plan was created (ISO or ms) — feeds the CARE-7 delta counts. */
  createdAt?: string | number;
}
export interface PacketInputMemory { fact: string; status: string }

/** LC-20 — a phrase the parent logged in Language Lab (the registered `langObs`
 *  sink). Feeds the SLP preset's own section; no other audience receives it. */
export interface PacketInputLangObs {
  phrase: string;
  language?: string;
  /** ISO date the parent recorded it. */
  at?: string | number;
}

/** LC-20 — a parent-logged physical measurement (the `growthEntries` sink).
 *  Feeds the pediatrician preset's own section. Raw numbers as the parent
 *  entered them — never a percentile, centile band or growth verdict. */
export interface PacketInputGrowthEntry {
  date: string;
  heightCm?: number;
  weightKg?: number;
}

export interface PacketItem { id: string; text: string }
export interface PacketSection { id: string; title: string; note?: string; items: PacketItem[] }
export interface ConsultPacket {
  childLabel: string;
  generatedAt: string;
  sections: PacketSection[];
}

const DAY = 86_400_000;
function toMs(ts: string | number): number {
  return typeof ts === "number" ? ts : new Date(ts).getTime();
}

export interface BuildPacketInput {
  profile: PacketInputProfile;
  logs: PacketInputLog[];
  milestones: PacketInputMilestone[];
  plans: PacketInputPlan[];
  memory: PacketInputMemory[];
  nowMs: number;
  windowDays?: number;
  /** CARE-7: when this audience last received an export (ISO or ms). Present
   *  ⇒ the packet gains a computed, counts-only "Since the last export" delta
   *  section. Absent (no prior export) ⇒ no delta section — fail quiet. */
  lastExportedAt?: string | number;
  /** LC-20: the parent's one-line reason for the visit. When present it is the
   *  FIRST section of every packet, so the clinician does not open by asking
   *  the question the parent already answered. The parent's own words. */
  reason?: string;
  /** LC-12 + LC-20: the questions the parent prepared in Appointments. They
   *  ride into the packet so the prep work reaches the room. */
  questions?: string[];
  /** LC-20: phrases from Language Lab — the SLP preset's own evidence. */
  langObs?: PacketInputLangObs[];
  /** LC-20: parent-logged measurements — the pediatrician preset's own
   *  evidence. Numbers as entered; never a percentile or growth verdict. */
  growthEntries?: PacketInputGrowthEntry[];
}

/** Effective parent response for a milestone: the explicit wave-2 observation
 *  status when present, else derived from the legacy `checked` flag. */
const effectiveObservation = (m: PacketInputMilestone): "yes" | "not_sure" | "not_yet" =>
  m.status ?? (m.checked ? "yes" : "not_yet");

/** ISO date (YYYY-MM-DD) or null when the timestamp is absent/invalid. */
const isoDay = (ts?: string | number): string | null => {
  if (ts == null || ts === "") return null;
  const t = toMs(ts);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
};

/* RUN-01 — a packet that leaves the app must read like a human wrote it.
 *
 *  · Domain keys go through the SAME human label map the Development /
 *    Screening surfaces render ("Thinking & attention", never
 *    "cognition_executive_function"). Non-canonical domains (custom items)
 *    fall back to a de-snaked, capitalised form so an identifier never leaks.
 *  · The milestone denominator is AGE-WINDOWED: the child's current CDC band
 *    plus the one before it (the checklists a well-child visit would look
 *    at). A 5-year-old is never measured against the 2-month checklist.
 *    NOTE for lane G: `milestoneInAgeWindow` is the small local helper the
 *    brief allows; lane G adds the shared one on `lib/milestoneData.ts` and
 *    this call site should switch to it. */

/** Human label for a developmental-domain id (Development's own map). */
export function humanDomainLabel(domain: string): string {
  const known = (DOMAIN_LABEL as Record<string, string>)[domain];
  if (known) return known;
  const plain = domain.replace(/_/g, " ").trim();
  return plain ? plain.charAt(0).toUpperCase() + plain.slice(1) : domain;
}

/** Is this milestone inside the child's age window (current band or the one
 *  immediately before it)? Items with no age anchor always count. */
export function milestoneInAgeWindow(milestoneAgeMonths: number | undefined, childAgeMonths: number): boolean {
  // Lane G: ONE window definition app-wide (lib/milestoneData.milestoneAgeWindow):
  // current CDC band + the one before it; unanchored items always count.
  return milestoneAgeWindow(childAgeMonths).includes(milestoneAgeMonths);
}

/** Age in months the packet windows against: explicit months, else years × 12. */
const childAgeMonthsOf = (profile: PacketInputProfile): number =>
  typeof profile.ageMonths === "number" && Number.isFinite(profile.ageMonths) ? profile.ageMonths : Math.max(0, profile.age) * 12;

/** Assemble the packet from the child's record. Empty sources yield no section. */
export function buildConsultPacket(input: BuildPacketInput): ConsultPacket {
  const { profile, logs, milestones, plans, memory, nowMs } = input;
  const windowDays = input.windowDays ?? 30;
  const since = nowMs - windowDays * DAY;
  const recent = logs.filter((l) => toMs(l.timestamp) >= since);

  const sections: PacketSection[] = [];

  // 0) LC-20 — WHY THE PARENT IS COMING. Every preset used to open with
  //    "About", so a clinician read four dated, structured sections and still
  //    had to ask the first question. When the parent writes a line, it opens
  //    the packet. Their own words, unedited, never a paraphrase.
  const reason = (input.reason ?? "").trim();
  if (reason) {
    sections.push({
      id: "reason",
      title: "What I'd like help with",
      note: "In the parent's own words.",
      items: [{ id: "reason-line", text: reason }],
    });
  }

  // 1) Who the child is.
  const aboutItems: PacketItem[] = [
    { id: "about-basics", text: `${profile.name}, ${ageLabel(profile)}${profile.languages.length ? `, speaks ${profile.languages.join(" and ")}` : ""}.` },
  ];
  if (profile.schoolContext) aboutItems.push({ id: "about-school", text: `Setting: ${profile.schoolContext}.` });
  if (profile.strengths?.length) aboutItems.push({ id: "about-strengths", text: `Strengths: ${profile.strengths.join(", ")}.` });
  if (profile.challenges?.length) aboutItems.push({ id: "about-focus", text: `Current focus: ${profile.challenges.join(", ")}.` });
  sections.push({ id: "about", title: `About ${profile.name}`, items: aboutItems });

  // 2) What's been happening — top recent concerns by frequency.
  if (recent.length) {
    const counts = new Map<string, { n: number; maxIntensity: number }>();
    for (const l of recent) {
      const c = counts.get(l.behaviorType) ?? { n: 0, maxIntensity: 0 };
      c.n += 1; c.maxIntensity = Math.max(c.maxIntensity, l.intensity);
      counts.set(l.behaviorType, c);
    }
    const top = [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3);
    const items: PacketItem[] = top.map(([type, c], i) => ({
      id: `pattern-${i}`,
      text: `${type}: ${c.n} time${c.n === 1 ? "" : "s"} in the last ${windowDays} days${c.maxIntensity >= 4 ? ", sometimes intense" : ""}.`,
    }));
    sections.push({
      id: "patterns",
      title: `What we've been seeing (last ${windowDays} days)`,
      // Deliberately scan-clean wording (CARE-2): the fail-closed clinical-term
      // scan runs on non-clinician egress, so the reassurance note itself must
      // not contain a scanned term.
      note: "Parent-logged moments — observations only, never an assessment.",
      items,
    });
  }

  // 3) Development snapshot — milestone coverage in the parent's OWN response
  //    groups (UND-4 / AR-CAP-08: the packet preserves observed / not sure,
  //    with observation dates — for a provider, "parent is unsure" is a useful
  //    signal). RUN-01: the packet NEVER lists what the parent has NOT seen —
  //    an unmarked item is "never asked", not "not observed", and a list of
  //    them reads as a deficit sheet to a professional. So: the section
  //    exists only once the parent has recorded at least one observation;
  //    it carries noticed counts (age-windowed) + the parent's own responses;
  //    domain ids render through the human label map. Counts and factual
  //    titles only — never a percentage, score, or verdict.
  const observed = milestones.filter((m) => effectiveObservation(m) === "yes");
  const notSure = milestones.filter((m) => effectiveObservation(m) === "not_sure");
  if (observed.length || notSure.length) {
    const childMonths = childAgeMonthsOf(profile);
    const inWindow = milestones.filter((m) => milestoneInAgeWindow(m.ageMonths, childMonths));
    const observedInWindow = inWindow.filter((m) => effectiveObservation(m) === "yes");
    const MAX_LISTED = 6;
    const groupLine = (id: string, label: string, group: PacketInputMilestone[]): PacketItem | null => {
      if (group.length === 0) return null;
      const listed = group.slice(0, MAX_LISTED).map((m) => {
        const date = isoDay(m.observedAt);
        return `${m.title} (${humanDomainLabel(m.domain)}${date ? `, ${date}` : ""})`;
      });
      const more = group.length > MAX_LISTED ? `; and ${group.length - MAX_LISTED} more` : "";
      return { id, text: `${label} (${group.length}): ${listed.join("; ")}${more}.` };
    };
    const byDomain = new Map<string, { done: number; total: number }>();
    for (const m of inWindow) {
      const d = byDomain.get(m.domain) ?? { done: 0, total: 0 };
      d.total += 1; if (effectiveObservation(m) === "yes") d.done += 1;
      byDomain.set(m.domain, d);
    }
    const windowLabel = bandForAgeMonths(childMonths).label;
    const items: PacketItem[] = [
      {
        id: "dev-overall",
        text: `${observedInWindow.length} of ${inWindow.length} milestones on the ${windowLabel} checklists noticed so far` +
          (observed.length !== observedInWindow.length ? ` (${observed.length} noticed in total).` : "."),
      },
      ...[
        groupLine("dev-observed", "Observed", observed),
        groupLine("dev-not-sure", "Not sure yet", notSure),
      ].filter((it): it is PacketItem => it !== null),
      ...[...byDomain.entries()]
        .filter(([, d]) => d.total > 0)
        .map(([domain, d], i) => ({ id: `dev-${i}`, text: `${humanDomainLabel(domain)}: ${d.done} of ${d.total} noticed.` })),
    ];
    sections.push({ id: "development", title: "Development snapshot", items });
  }

  // 4) What's been tried — active plans (shows the family is already working on it).
  if (plans.length) {
    const items: PacketItem[] = plans.slice(0, 4).map((p, i) => ({
      id: `tried-${i}`,
      text: p.issue ? `${p.title} — for ${p.issue}.` : p.title,
    }));
    sections.push({ id: "tried", title: "What we've already tried", items });
  }

  // 5) What Arbor remembers — approved longitudinal facts (the moat).
  const approved = memory.filter((m) => m.status === "approved");
  if (approved.length) {
    const items: PacketItem[] = approved.slice(0, 8).map((m, i) => ({ id: `mem-${i}`, text: m.fact }));
    sections.push({
      id: "memory",
      title: "Context worth knowing",
      note: "Approved notes from your history with Arbor.",
      items,
    });
  }

  // 5b) LC-20 — SLP evidence: the phrases the parent actually logged. This
  //     section exists ONLY in the SLP preset's ceiling, which is what finally
  //     makes "SLP Summary" a different document from "Pediatrician Summary".
  //     Parent-recorded phrases, dated — no scoring, no articulation verdict.
  if (input.langObs?.length) {
    const items: PacketItem[] = input.langObs.slice(0, 12).map((o, i) => {
      const day = isoDay(o.at);
      const lang = o.language ? ` [${o.language}]` : "";
      return { id: `lang-${i}`, text: `${o.phrase}${lang}${day ? ` (${day})` : ""}` };
    });
    sections.push({
      id: "language-observations",
      title: "Phrases we have heard",
      note: "Parent-recorded phrases, as heard at home.",
      items,
    });
  }

  // 5c) LC-20 — pediatrician evidence: the measurements the parent logged, as
  //     entered. NEVER a percentile, centile band, or growth verdict; the
  //     clinician plots these against their own charts.
  if (input.growthEntries?.length) {
    const items: PacketItem[] = [...input.growthEntries]
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
      .slice(0, 8)
      .map((g, i) => {
        const parts = [
          g.heightCm != null ? `${g.heightCm} cm` : null,
          g.weightKg != null ? `${g.weightKg} kg` : null,
        ].filter(Boolean);
        return { id: `growth-${i}`, text: `${isoDay(g.date) ?? g.date}: ${parts.join(", ")}` };
      })
      .filter((it) => !/: $/.test(it.text));
    if (items.length) {
      sections.push({
        id: "growth-measurements",
        title: "Measurements we have taken",
        note: "Parent-recorded measurements, as entered at home.",
        items,
      });
    }
  }

  // 5d) LC-20 — behavioural evidence: what the parent noticed came BEFORE the
  //     hard moments, in their own words, with counts. Only the behavioral
  //     health preset's ceiling includes it.
  const triggerCounts = new Map<string, number>();
  for (const l of recent) {
    const trigger = (l.trigger ?? "").trim();
    if (trigger) triggerCounts.set(trigger, (triggerCounts.get(trigger) ?? 0) + 1);
  }
  if (triggerCounts.size) {
    const items: PacketItem[] = [...triggerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([trigger, n], i) => ({
        id: `trigger-${i}`,
        text: `"${trigger}" — noted ${n} time${n === 1 ? "" : "s"}.`,
      }));
    sections.push({
      id: "triggers",
      title: "What we noticed came first",
      note: "The parent's own words for what preceded a hard moment — counts, not causes.",
      items,
    });
  }

  // 5e) LC-12 + LC-20 — the questions the parent prepared in Appointments.
  //     Prep work that used to stop at the Appointments screen now reaches the
  //     room. Every audience gets them: they are the parent's questions.
  const questions = (input.questions ?? []).map((q) => q.trim()).filter(Boolean);
  if (questions.length) {
    sections.push({
      id: "questions",
      title: "Questions I want to ask",
      items: questions.slice(0, 10).map((q, i) => ({ id: `question-${i}`, text: q })),
    });
  }

  // 6) Since the last export (CARE-7) — a computed, counts-only delta that
  //    appears ONLY when a prior export to this audience exists. It rides the
  //    same fail-closed ceiling guards as every other section; no authored
  //    clinical content lives here.
  if (input.lastExportedAt != null) {
    const lastMs = toMs(input.lastExportedAt);
    if (Number.isFinite(lastMs) && lastMs > 0 && lastMs <= nowMs) {
      const newLogs = logs.filter((l) => {
        const t = toMs(l.timestamp);
        return Number.isFinite(t) && t > lastMs;
      }).length;
      const newPlans = plans.filter((p) => {
        if (p.createdAt == null) return false;
        const t = toMs(p.createdAt);
        return Number.isFinite(t) && t > lastMs;
      }).length;
      const newlyNoticed = milestones.filter((m) => {
        if (effectiveObservation(m) !== "yes" || !m.observedAt) return false;
        const t = toMs(m.observedAt);
        return Number.isFinite(t) && t > lastMs;
      }).length;
      const s = (n: number) => (n === 1 ? "" : "s");
      sections.push({
        id: "since-last-visit",
        title: `Since the last export (${isoDay(lastMs)})`,
        note: "What was added since this summary was last prepared for this audience — counts only.",
        items: [
          { id: "delta-logs", text: `${newLogs} new moment${s(newLogs)} logged.` },
          { id: "delta-plans", text: `${newPlans} action plan${s(newPlans)} added.` },
          { id: "delta-milestones", text: `${newlyNoticed} milestone${s(newlyNoticed)} newly noticed.` },
        ],
      });
    }
  }

  return {
    childLabel: profile.name,
    generatedAt: new Date(nowMs).toISOString().slice(0, 10),
    sections,
  };
}

/** Render the packet to shareable Markdown, omitting any redacted item ids and
 *  any section the parent emptied. */
export function serializePacket(packet: ConsultPacket, excludedIds: Set<string> = new Set()): string {
  const lines: string[] = [
    `# ${packet.childLabel} — context for our conversation`,
    `_Prepared ${packet.generatedAt} via Arbor. Parent-selected; non-diagnostic._`,
    "",
  ];
  for (const section of packet.sections) {
    const items = section.items.filter((it) => !excludedIds.has(it.id));
    if (items.length === 0) continue;
    lines.push(`## ${section.title}`);
    if (section.note) lines.push(`_${section.note}_`);
    for (const it of items) lines.push(`- ${it.text}`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

/** AIX-S3(a): append a parent-reviewed note (e.g. the Arbor Vision handoff
 *  note) to a serialized packet under its own heading. Pure + total: an empty
 *  or whitespace note returns the packet unchanged, so callers can pass the
 *  composer's live value directly. The note is parent-editable text — it rides
 *  only into exports the parent explicitly triggers. */
export function appendParentNote(packetMarkdown: string, note: string, heading: string): string {
  const trimmed = note.trim();
  if (!trimmed) return packetMarkdown;
  return `${packetMarkdown.trimEnd()}\n\n## ${heading}\n\n${trimmed}\n`;
}

/** Count of includable items (for the UI's "N details selected"). */
export function countIncluded(packet: ConsultPacket, excludedIds: Set<string>): number {
  return packet.sections.reduce(
    (n, s) => n + s.items.filter((it) => !excludedIds.has(it.id)).length,
    0
  );
}

/** LC-06: a packet with nothing beyond the profile's "about" section has
 *  nothing to hand a professional — the consult surface shows its empty state
 *  (log a moment first) instead of an export bar for a one-line packet. The
 *  "about" section is always emitted, so `sections.length === 0` is never
 *  true; this is the honest emptiness test. */
export function isConsultPacketEmpty(packet: ConsultPacket): boolean {
  return packet.sections.every((s) => s.id === "about");
}

/* Audience presets (IA W4.1 + CARE-7) — one packet builder, five audiences,
 * each with a DEFINED data ceiling:
 *
 *  - teacher (non-clinician): capped at the School-Brief curated ceiling —
 *    profile-level context + what the family already tries. NO log-derived
 *    patterns, NO milestone coverage, NO memory-ledger facts, NO log-derived
 *    delta counts (the packet never carries raw behavior-log fields for ANY
 *    audience; for a teacher even the derived sections stay behind the
 *    ceiling). The shared fail-closed clinical-term scan
 *    (`src/lib/clinicalScan.ts`) runs on every teacher build AND serialization.
 *  - therapist / pediatrician / slp / behavioral_health (clinicians):
 *    log-derived patterns + approved memory facts + the computed
 *    since-last-export delta are IN ceiling. EXEMPT from the term scan by
 *    policy — "speech delay" is legitimate shorthand in an SLP or
 *    pediatrician summary.
 *
 * No preset, clinician or not, may export "riskLevel", "milestonesPercent",
 * or a percentage readiness figure — those tokens appear in NO export. */

export type ConsultAudience = "teacher" | "therapist" | "pediatrician" | "slp" | "behavioral_health";

export interface ConsultPreset {
  audience: ConsultAudience;
  /** Section ids (from `buildConsultPacket`) this audience may receive. */
  sections: readonly string[];
  dataCeiling: {
    /** Frequency/intensity patterns derived from the behavior log. */
    logDerivedPatterns: boolean;
    /** Parent-approved longitudinal memory facts. */
    approvedMemoryFacts: boolean;
  };
  /** Fail-closed clinical-diagnosis-term scan (non-clinician audiences only). */
  clinicalTermScan: boolean;
}

/** LC-20: the parent's reason for the visit and their prepared questions open
 *  and close EVERY packet — they are the parent's own words, not child data
 *  derived by Arbor, so no audience ceiling excludes them. */
const PARENT_VOICE_SECTIONS = ["reason", "questions"] as const;

/** The shared clinician ceiling (CARE-7): same base sections, same data
 *  ceiling, term-scan exempt — one policy, no forks. Each clinician audience
 *  then adds the ONE evidence section its own discipline actually reads
 *  (LC-20: four "professional" reports used to be byte-identical documents
 *  that differed only in their title). */
const CLINICIAN_SECTIONS = ["about", "patterns", "development", "tried", "memory", "since-last-visit"] as const;
const CLINICIAN_CEILING = { logDerivedPatterns: true, approvedMemoryFacts: true } as const;
const clinicianPreset = (audience: ConsultAudience, extraSections: readonly string[] = []): ConsultPreset => ({
  audience,
  sections: [...PARENT_VOICE_SECTIONS, ...CLINICIAN_SECTIONS, ...extraSections],
  dataCeiling: { ...CLINICIAN_CEILING },
  clinicalTermScan: false,
});

export const CONSULT_PRESETS: Record<ConsultAudience, ConsultPreset> = {
  teacher: {
    audience: "teacher",
    sections: [...PARENT_VOICE_SECTIONS, "about", "tried"],
    dataCeiling: { logDerivedPatterns: false, approvedMemoryFacts: false },
    clinicalTermScan: true,
  },
  // The generalist ceiling — everything shared, no discipline-specific evidence.
  therapist: clinicianPreset("therapist"),
  // Physical measurements the parent logged, as entered (never a percentile).
  pediatrician: clinicianPreset("pediatrician", ["growth-measurements"]),
  // The phrases the parent actually heard at home.
  slp: clinicianPreset("slp", ["language-observations"]),
  // What the parent noticed came first, in their own words, with counts.
  behavioral_health: clinicianPreset("behavioral_health", ["triggers"]),
};

/** Tokens that appear in NO export, for ANY audience (clinician or not). */
export const FORBIDDEN_EXPORT_TOKENS = ["riskLevel", "milestonesPercent"] as const;

/** Clinician-ceiling egress guard for clinician-facing exports that live
 *  OUTSIDE the consult packet (the Copilot practice summary, the monitoring
 *  printable — IA W4.5). Same policy as the clinician presets: term-scan-EXEMPT,
 *  but ceiling-bound — the forbidden tokens fail closed, and so does any
 *  percentage figure, because exports carry counts, never percentages. */
export function assertClinicianExportCeiling(text: string): void {
  for (const token of FORBIDDEN_EXPORT_TOKENS) {
    if (text.includes(token)) {
      throw new ClinicalLanguageError(token, `Export blocked: forbidden token "${token}" must not appear in any export.`);
    }
  }
  const pct = /\d+(?:\.\d+)?\s*%/.exec(text);
  if (pct) {
    throw new ClinicalLanguageError(pct[0], `Export blocked: percentage figure "${pct[0]}" — exports carry counts, never percentages.`);
  }
}

/** Flatten a packet to plain text for the ceiling guards. */
function packetToText(packet: ConsultPacket): string {
  return packet.sections
    .flatMap((s) => [s.title, s.note ?? "", ...s.items.map((it) => it.text)])
    .join("\n");
}

/** Cap a packet to the preset's section ceiling. */
function capToPreset(preset: ConsultPreset, packet: ConsultPacket): ConsultPacket {
  const allowed = new Set(preset.sections);
  return { ...packet, sections: packet.sections.filter((s) => allowed.has(s.id)) };
}

/** Fail-closed egress guards: forbidden tokens block EVERY audience; the
 *  clinical-diagnosis-term scan blocks non-clinician audiences only. */
function assertWithinCeiling(preset: ConsultPreset, text: string): void {
  for (const token of FORBIDDEN_EXPORT_TOKENS) {
    if (text.includes(token)) {
      throw new ClinicalLanguageError(token, `Consult packet blocked: forbidden token "${token}" must not appear in any export.`);
    }
  }
  if (preset.clinicalTermScan) {
    const violation = findClinicalDiagnosisTerm(text);
    if (violation) {
      throw new ClinicalLanguageError(violation, `Consult packet blocked: clinical-diagnosis term "${violation}" is not allowed in a ${preset.audience} packet.`);
    }
  }
}

/** Build the packet capped to the audience preset's data ceiling. Fail-closed:
 *  a non-clinician (teacher) packet throws on any clinical-diagnosis term. */
export function buildPresetPacket(audience: ConsultAudience, input: BuildPacketInput): ConsultPacket {
  const preset = CONSULT_PRESETS[audience];
  const packet = capToPreset(preset, buildConsultPacket(input));
  assertWithinCeiling(preset, packetToText(packet));
  return packet;
}

/** Serialize a preset packet — re-caps the sections and re-runs the guards at
 *  the egress seam, so a redaction/edit path can never route around the
 *  build-time scan. */
export function serializePresetPacket(
  audience: ConsultAudience,
  packet: ConsultPacket,
  excludedIds: Set<string> = new Set()
): string {
  const preset = CONSULT_PRESETS[audience];
  const md = serializePacket(capToPreset(preset, packet), excludedIds);
  assertWithinCeiling(preset, md);
  return md;
}

/* ── CARE-2 — recipient shared view ──────────────────────────────────────────
 * The read-only packet a share RECIPIENT (co-parent / viewer / professional)
 * may see. This is the ONLY egress for recipient-facing child data: it builds
 * through `buildConsultPacket`, caps sections to exactly what the grant's
 * stable scope IDs (lib/shareScopes.ts) unlock, and re-runs the same
 * fail-closed guards (`assertWithinCeiling`: forbidden tokens for everyone,
 * clinical-diagnosis term scan for non-clinician recipients) on the final
 * text. Raw subcollection documents never leave the server — only these
 * derived, counts-only section lines do.
 */

/** Stable share-scope ID → the packet sections it unlocks. FAILS CLOSED: a
 *  scope not in this map (e.g. an unmigrated legacy string) unlocks nothing.
 *  The report_* scopes mirror their audience preset ceilings exactly. */
export const SHARED_SCOPE_SECTIONS: Record<string, readonly string[]> = {
  story_timeline: ["patterns"],
  weekly_insight: ["patterns", "development"],
  behavior_patterns: ["patterns"],
  milestones: ["development"],
  report_teacher: CONSULT_PRESETS.teacher.sections,
  report_therapist: CONSULT_PRESETS.therapist.sections,
  report_pediatrician: CONSULT_PRESETS.pediatrician.sections,
  report_slp: CONSULT_PRESETS.slp.sections,
  report_behavioral_health: CONSULT_PRESETS.behavioral_health.sections,
};

/** Build the recipient's read-only packet: exactly the sections the granted
 *  scopes unlock, guard-checked at this egress seam. Non-clinician recipients
 *  (co_parent / viewer) ride the non-clinician ceiling — the fail-closed
 *  clinical-diagnosis term scan runs, mirroring the teacher preset policy.
 *  Professionals ride the clinician ceiling (term-scan exempt by the same
 *  policy as therapist/pediatrician presets). The forbidden-token scan runs
 *  for EVERY recipient. Throws `ClinicalLanguageError` (fail closed) rather
 *  than ever emitting guarded content. */
export function buildSharedScopePacket(
  scopes: readonly string[],
  recipientIsClinician: boolean,
  input: BuildPacketInput
): ConsultPacket {
  const allowed = new Set<string>();
  for (const scope of scopes) {
    for (const sectionId of SHARED_SCOPE_SECTIONS[scope] ?? []) allowed.add(sectionId);
  }
  const packet = buildConsultPacket(input);
  const capped: ConsultPacket = { ...packet, sections: packet.sections.filter((s) => allowed.has(s.id)) };
  const guardPreset: ConsultPreset = recipientIsClinician
    ? CONSULT_PRESETS.therapist
    : { audience: "teacher", sections: [...allowed], dataCeiling: CONSULT_PRESETS.teacher.dataCeiling, clinicalTermScan: true };
  assertWithinCeiling(guardPreset, packetToText(capped));
  return capped;
}

/** Print-shell section shape — matches `ReportDoc.sections` in
 *  `lib/reportExport` without importing it (the print shell depends on no
 *  consult types, and this module stays pure). */
export interface PresetPrintSection { heading: string; body: string[] }

/** Render a preset packet as print-shell sections for `openPrintableReport`
 *  (IA W4.2 — the AskSpecialist / Reports PDF path). Same egress contract as
 *  `serializePresetPacket`: re-caps to the audience ceiling, honours parent
 *  redaction (excluded item ids drop, emptied sections vanish), and re-runs
 *  the fail-closed guards on the final text. */
export function presetPacketToPrintSections(
  audience: ConsultAudience,
  packet: ConsultPacket,
  excludedIds: Set<string> = new Set()
): PresetPrintSection[] {
  const preset = CONSULT_PRESETS[audience];
  const sections: PresetPrintSection[] = [];
  for (const section of capToPreset(preset, packet).sections) {
    const items = section.items.filter((it) => !excludedIds.has(it.id));
    if (items.length === 0) continue;
    sections.push({
      heading: section.title,
      body: [...(section.note ? [section.note] : []), ...items.map((it) => it.text)],
    });
  }
  assertWithinCeiling(preset, sections.flatMap((s) => [s.heading, ...s.body]).join("\n"));
  return sections;
}

/* ── LC-08 — the ONE export seam for Copy / Download / Send ─────────────────
 * The consult surface's most-used verbs used to build their text through the
 * unguarded `serializePacket` — no audience, no ceiling, no scan — so a
 * teacher reached through "Send to a professional" received memory facts and
 * log-derived patterns the teacher preset forbids, and the free-text parent
 * note was never scanned. Components may not import `serializePacket` (a
 * source-scan guard enforces it); they call this instead:
 *
 *  - clinician → the clinician preset (therapist ceiling — all clinician
 *    presets share one policy), term-scan exempt, forbidden tokens + %
 *    fail closed;
 *  - teacher   → the teacher preset: curated ceiling, AND the parent note is
 *    scanned for clinical-diagnosis terms BEFORE it joins (fail closed);
 *  - self      → the parent's own records: everything they selected, still
 *    behind the forbidden-token / percentage ceiling (no export carries a
 *    riskLevel or a %). */

export type ExportAudience = "clinician" | "teacher" | "self";
export const EXPORT_AUDIENCES: readonly ExportAudience[] = ["clinician", "teacher", "self"];
export const DEFAULT_EXPORT_AUDIENCE: ExportAudience = "clinician";

const PRESET_FOR_EXPORT_AUDIENCE: Record<Exclude<ExportAudience, "self">, ConsultAudience> = {
  clinician: "therapist",
  teacher: "teacher",
};

/** Serialize a packet for a chosen audience with the parent's note appended
 *  under `noteHeading`. Throws `ClinicalLanguageError` (fail closed — nothing
 *  is returned) when the audience's ceiling or scan is violated. */
export function serializeForExport(
  audience: ExportAudience,
  packet: ConsultPacket,
  excludedIds: Set<string> = new Set(),
  note: string = "",
  noteHeading: string = "Parent note"
): string {
  if (audience === "self") {
    const md = appendParentNote(serializePacket(packet, excludedIds), note, noteHeading);
    assertClinicianExportCeiling(md);
    return md;
  }
  const preset = CONSULT_PRESETS[PRESET_FOR_EXPORT_AUDIENCE[audience]];
  if (preset.clinicalTermScan) {
    const violation = findClinicalDiagnosisTerm(note);
    if (violation) {
      throw new ClinicalLanguageError(
        violation,
        `Export blocked: clinical-diagnosis term "${violation}" in the parent note is not allowed in a ${preset.audience} export.`
      );
    }
  }
  const md = appendParentNote(serializePresetPacket(preset.audience, packet, excludedIds), note, noteHeading);
  assertWithinCeiling(preset, md);
  assertClinicianExportCeiling(md);
  return md;
}
