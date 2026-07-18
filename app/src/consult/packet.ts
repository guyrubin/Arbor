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

export interface PacketInputProfile {
  name: string;
  age: number;
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
export interface PacketInputMilestone { domain: string; title: string; checked: boolean }
export interface PacketInputPlan { title: string; issue?: string }
export interface PacketInputMemory { fact: string; status: string }

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
}

/** Assemble the packet from the child's record. Empty sources yield no section. */
export function buildConsultPacket(input: BuildPacketInput): ConsultPacket {
  const { profile, logs, milestones, plans, memory, nowMs } = input;
  const windowDays = input.windowDays ?? 30;
  const since = nowMs - windowDays * DAY;
  const recent = logs.filter((l) => toMs(l.timestamp) >= since);

  const sections: PacketSection[] = [];

  // 1) Who the child is.
  const aboutItems: PacketItem[] = [
    { id: "about-basics", text: `${profile.name}, age ${profile.age}${profile.languages.length ? `, speaks ${profile.languages.join(" and ")}` : ""}.` },
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
      note: "Parent-logged moments, not a diagnosis.",
      items,
    });
  }

  // 3) Development snapshot — milestone coverage, lightly.
  if (milestones.length) {
    const done = milestones.filter((m) => m.checked).length;
    const byDomain = new Map<string, { done: number; total: number }>();
    for (const m of milestones) {
      const d = byDomain.get(m.domain) ?? { done: 0, total: 0 };
      d.total += 1; if (m.checked) d.done += 1;
      byDomain.set(m.domain, d);
    }
    const items: PacketItem[] = [
      { id: "dev-overall", text: `${done} of ${milestones.length} tracked milestones noticed so far.` },
      ...[...byDomain.entries()].map(([domain, d], i) => ({ id: `dev-${i}`, text: `${domain}: ${d.done}/${d.total}.` })),
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

/** Count of includable items (for the UI's "N details selected"). */
export function countIncluded(packet: ConsultPacket, excludedIds: Set<string>): number {
  return packet.sections.reduce(
    (n, s) => n + s.items.filter((it) => !excludedIds.has(it.id)).length,
    0
  );
}

/* Audience presets (IA W4.1) — one packet builder, three audiences, each with
 * a DEFINED data ceiling:
 *
 *  - teacher (non-clinician): capped at the School-Brief curated ceiling —
 *    profile-level context + what the family already tries. NO log-derived
 *    patterns, NO milestone coverage, NO memory-ledger facts (the packet never
 *    carries raw behavior-log fields for ANY audience; for a teacher even the
 *    derived sections stay behind the ceiling). The shared fail-closed
 *    clinical-term scan (`src/lib/clinicalScan.ts`) runs on every teacher
 *    build AND serialization.
 *  - therapist / pediatrician (clinicians): log-derived patterns + approved
 *    memory facts are IN ceiling. EXEMPT from the term scan by policy —
 *    "speech delay" is legitimate shorthand in a pediatrician summary.
 *
 * No preset, clinician or not, may export "riskLevel", "milestonesPercent",
 * or a percentage readiness figure — those tokens appear in NO export. */

export type ConsultAudience = "teacher" | "therapist" | "pediatrician";

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

export const CONSULT_PRESETS: Record<ConsultAudience, ConsultPreset> = {
  teacher: {
    audience: "teacher",
    sections: ["about", "tried"],
    dataCeiling: { logDerivedPatterns: false, approvedMemoryFacts: false },
    clinicalTermScan: true,
  },
  therapist: {
    audience: "therapist",
    sections: ["about", "patterns", "development", "tried", "memory"],
    dataCeiling: { logDerivedPatterns: true, approvedMemoryFacts: true },
    clinicalTermScan: false,
  },
  pediatrician: {
    audience: "pediatrician",
    sections: ["about", "patterns", "development", "tried", "memory"],
    dataCeiling: { logDerivedPatterns: true, approvedMemoryFacts: true },
    clinicalTermScan: false,
  },
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
