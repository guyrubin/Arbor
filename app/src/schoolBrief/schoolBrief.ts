/* AP-056 — School Handoff Brief (parent-controlled, teacher-facing).
 *
 * Owned by arbor-safety. This module is the SAFETY GATE for the School Brief
 * surface: it is pure + deterministic (no React, no network, no storage) so the
 * binding child-data conditions can be proven by unit test, not by inspection.
 *
 * It is DISTINCT from the clinician consult packet (`src/consult/packet.ts`),
 * which it never imports or touches — both coexist. The School Brief is a
 * parent-curated, <=1-page, teacher-facing, NON-DIAGNOSTIC transition aid.
 *
 * The brief is GENERATED via the existing `/generate-handoff` endpoint
 * (audience="teacher"), which already screens for immediate escalation (409)
 * and redacts the child's name/email/phone at the model seam. This module does
 * NOT add a new generation path and does NOT read the raw child record.
 *
 * Six binding conditions enforced here (each has a test in schoolBrief.test.ts):
 *  1. PARENT-APPROVAL-PER-EXPORT — export is BLOCKED until an explicit per-export
 *     approve transition fires on the rendered brief. No auto-send / no default.
 *  2. CURATED-FIELDS-ONLY — the export payload is built ONLY from the curated
 *     allowlist below. The raw memory-ledger / behavior-log record is NEVER a
 *     field source; the builder ignores any raw-record key handed to it.
 *  3. ZERO clinical-diagnosis language — the template + builder reject any brief
 *     carrying diagnosis/disorder/ADHD/autism/delay/deficit-style terms.
 *  5. OUTSIDE-ERASE-REACH NOTICE — the approval step requires the i18n notice key
 *     stating the teacher's copy leaves Arbor's erase reach once shared.
 *  6. NOT a new persistent child-data store — generate-and-present by default; a
 *     cache, if any, is keyed by childId so the existing erase sweep removes it.
 */

import type { SchoolBrief } from "../types";
import { ClinicalLanguageError, findClinicalDiagnosisTerm } from "../lib/clinicalScan";

/* Conditions 2 + 3 field ceilings and the fail-closed clinical-term scan live
 * in the shared PURE module `src/lib/clinicalScan.ts` (extracted IA W4.1 so the
 * consult packet's audience presets run the SAME scanner). Re-exported verbatim
 * here so every existing import of this module is unchanged. This module still
 * never imports or touches the consult packet itself. */
export {
  CURATED_FIELDS,
  RAW_RECORD_KEYS,
  CLINICAL_DIAGNOSIS_TERMS,
  ClinicalLanguageError,
  findClinicalDiagnosisTerm,
} from "../lib/clinicalScan";
export type { CuratedField } from "../lib/clinicalScan";

/** i18n key for the mandatory outside-erase-reach notice (Condition 5). Both EN
 *  and HE dictionaries MUST define it; the approval screen MUST render it. */
export const OUTSIDE_ERASE_REACH_NOTICE_KEY = "schoolBrief.outsideEraseReach";
/** i18n key for the explicit per-export approval CTA (Condition 1). */
export const APPROVE_EXPORT_CTA_KEY = "schoolBrief.approveExport";

/** The export-flow state machine (Condition 1). Export is reachable ONLY from
 *  `approved`, which is reachable ONLY by an explicit parent approve action on a
 *  rendered brief. There is no path from `idle`/`rendered` straight to export. */
export type ExportPhase = "idle" | "rendered" | "approved";

export interface ExportState {
  phase: ExportPhase;
  /** True once the parent has seen the EXACT rendered brief and approved THIS export. */
  approvedAt: string | null;
}

export function initialExportState(): ExportState {
  return { phase: "idle", approvedAt: null };
}

/** A brief has been generated and rendered to the parent. Does NOT approve it. */
export function markRendered(state: ExportState): ExportState {
  // Re-rendering (e.g. regenerate) always RESETS any prior approval: approval is
  // per-export and must be re-given for the brief actually on screen.
  return { phase: "rendered", approvedAt: null };
}

/** Condition 1: explicit per-export parent approval. Only valid from `rendered`. */
export function approveExport(state: ExportState, nowIso: string): ExportState {
  if (state.phase !== "rendered") return state; // cannot approve what isn't rendered
  return { phase: "approved", approvedAt: nowIso };
}

/** Condition 1 (the gate): may an export/share fire right now? Only when an
 *  explicit per-export approval is in effect. */
export function canExport(state: ExportState): boolean {
  return state.phase === "approved" && state.approvedAt !== null;
}

/** The teacher-facing export payload — curated fields only, no raw record. */
export interface SchoolBriefExport {
  title: string;
  date: string;
  overview: string;
  keyStrengths: string[];
  classroomChallenges: string[];
  languageSupportPlan: string[];
  suggestedTeacherStrategies: string[];
}

function cleanStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
}

/**
 * Condition 2 + 3: build the export payload from the curated allowlist ONLY.
 *
 * The brief object handed in is the structured output of `/generate-handoff`
 * (already redacted + escalation-screened server-side). Even if it (or a caller)
 * carries raw memory-ledger / behavior-log keys, this builder NEVER reads them —
 * it copies only `CURATED_FIELDS`. It then runs the clinical-term scan and
 * throws if any diagnosis language slipped through (fail closed, do not export).
 */
export function buildSchoolBriefExport(
  brief: Partial<SchoolBrief> | Record<string, unknown>,
  opts: { title: string; date: string }
): SchoolBriefExport {
  const b = brief as Record<string, unknown>;
  const out: SchoolBriefExport = {
    title: opts.title,
    date: opts.date,
    overview: typeof b.overview === "string" ? b.overview : "",
    keyStrengths: cleanStrings(b.keyStrengths),
    classroomChallenges: cleanStrings(b.classroomChallenges),
    languageSupportPlan: cleanStrings(b.languageSupportPlan),
    suggestedTeacherStrategies: cleanStrings(b.suggestedTeacherStrategies),
  };
  const violation = findClinicalDiagnosisTerm(exportToText(out));
  if (violation) {
    throw new ClinicalLanguageError(violation);
  }
  return out;
}

/** Flatten the export to plain text for the clinical-term scan + PDF/markdown. */
export function exportToText(ex: SchoolBriefExport): string {
  return [
    ex.title,
    ex.overview,
    ...ex.keyStrengths,
    ...ex.classroomChallenges,
    ...ex.languageSupportPlan,
    ...ex.suggestedTeacherStrategies,
  ].join("\n");
}

/** Render the approved export to shareable Markdown (the PDF/download body).
 *  Curated fields only — mirrors `buildSchoolBriefExport`. */
export function serializeSchoolBrief(ex: SchoolBriefExport, labels: {
  overview: string; strengths: string; challenges: string; language: string; strategies: string;
}): string {
  const lines: string[] = [`# ${ex.title}`, `_${ex.date}_`, ""];
  if (ex.overview) { lines.push(`## ${labels.overview}`, ex.overview, ""); }
  const block = (title: string, items: string[]) => {
    if (!items.length) return;
    lines.push(`## ${title}`);
    for (const it of items) lines.push(`- ${it}`);
    lines.push("");
  };
  block(labels.strengths, ex.keyStrengths);
  block(labels.challenges, ex.classroomChallenges);
  block(labels.language, ex.languageSupportPlan);
  block(labels.strategies, ex.suggestedTeacherStrategies);
  return lines.join("\n").trim() + "\n";
}
