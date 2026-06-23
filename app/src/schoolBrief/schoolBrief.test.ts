/**
 * AP-056 — School Handoff Brief safety gate (arbor-safety).
 *
 * These tests ARE the binding gate. Each maps to one of the six binding child-data
 * conditions on this CHILD-DATA-EGRESS item. A red test here = the item is BLOCKED.
 */

import { describe, it, expect } from "vitest";
import {
  CURATED_FIELDS,
  RAW_RECORD_KEYS,
  CLINICAL_DIAGNOSIS_TERMS,
  OUTSIDE_ERASE_REACH_NOTICE_KEY,
  APPROVE_EXPORT_CTA_KEY,
  initialExportState,
  markRendered,
  approveExport,
  canExport,
  buildSchoolBriefExport,
  exportToText,
  serializeSchoolBrief,
  findClinicalDiagnosisTerm,
  ClinicalLanguageError,
} from "./schoolBrief";
import { en, he } from "../lib/i18n";
import * as schoolBriefMod from "./schoolBrief";
import { buildConsultPacket, serializePacket } from "../consult/packet";

const LABELS = { overview: "Overview", strengths: "Strengths", challenges: "Challenges", language: "Language", strategies: "Strategies" };

// A clean, board-cleared teacher brief (curated fields only).
const cleanBrief = {
  title: "Sam — school handoff",
  date: "2026-06-23",
  overview: "Sam settles best with a quiet, predictable start to the morning.",
  keyStrengths: ["Loves drawing", "Warms up to one trusted adult quickly"],
  classroomChallenges: ["Big transitions feel hard without a warning"],
  languageSupportPlan: ["Speaks Hebrew at home, English at school — a bridge word helps"],
  suggestedTeacherStrategies: ["Give a two-minute heads-up before transitions"],
};

describe("AP-056 Condition 1 — PARENT-APPROVAL-PER-EXPORT (no export before explicit approval)", () => {
  it("blocks export in the initial (idle) state", () => {
    expect(canExport(initialExportState())).toBe(false);
  });

  it("blocks export after the brief is merely RENDERED (seen but not approved)", () => {
    const s = markRendered(initialExportState());
    expect(s.phase).toBe("rendered");
    expect(canExport(s)).toBe(false); // no auto-export, no share-by-default
  });

  it("enables export ONLY after the explicit per-export approve action", () => {
    const rendered = markRendered(initialExportState());
    const approved = approveExport(rendered, "2026-06-23T10:00:00.000Z");
    expect(approved.phase).toBe("approved");
    expect(approved.approvedAt).toBe("2026-06-23T10:00:00.000Z");
    expect(canExport(approved)).toBe(true);
  });

  it("cannot approve straight from idle — there must be a rendered brief on screen", () => {
    const approved = approveExport(initialExportState(), "2026-06-23T10:00:00.000Z");
    expect(approved.phase).toBe("idle");
    expect(canExport(approved)).toBe(false);
  });

  it("re-rendering (regenerate) RESETS approval — approval is per-export, not sticky", () => {
    let s = markRendered(initialExportState());
    s = approveExport(s, "2026-06-23T10:00:00.000Z");
    expect(canExport(s)).toBe(true);
    s = markRendered(s); // parent regenerated → must re-approve the new copy
    expect(canExport(s)).toBe(false);
    expect(s.approvedAt).toBeNull();
  });
});

describe("AP-056 Condition 2 — CURATED-FIELDS-ONLY (raw record is never a backdoor)", () => {
  it("exports exactly the curated allowlist and nothing else", () => {
    const ex = buildSchoolBriefExport(cleanBrief, { title: cleanBrief.title, date: cleanBrief.date });
    const allowedKeys = new Set(["title", "date", ...CURATED_FIELDS]);
    for (const key of Object.keys(ex)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });

  it("IGNORES raw memory-ledger / behavior-log fields handed to the builder", () => {
    const poisoned = {
      ...cleanBrief,
      // every raw-record key the builder must refuse to read:
      behaviorType: "meltdown", intensity: 5, trigger: "transition", response: "screamed",
      notes: "RAW PRIVATE NOTE — must not leak", timestamp: 123, resolved: false,
      logs: [{ behaviorType: "bite", notes: "secret" }],
      behaviorLogs: [{ notes: "also secret" }],
      memory: [{ fact: "RAW LEDGER FACT — must not leak", status: "approved" }],
      memoryEvents: [{ fact: "leak me" }],
      memoryLedger: [{ fact: "leak me too" }],
      approvedMemoryItems: [{ fact: "do not export" }],
      context: "home", durationMinutes: 30, fact: "x", status: "approved",
    };
    const ex = buildSchoolBriefExport(poisoned as any, { title: cleanBrief.title, date: cleanBrief.date });
    const text = JSON.stringify(ex);
    // none of the raw values surfaced anywhere in the payload
    expect(text).not.toContain("RAW PRIVATE NOTE");
    expect(text).not.toContain("RAW LEDGER FACT");
    expect(text).not.toContain("leak me");
    expect(text).not.toContain("do not export");
    expect(text).not.toContain("meltdown");
    expect(text).not.toContain("screamed");
    // and no raw-record KEY exists on the export object
    for (const rawKey of RAW_RECORD_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(ex, rawKey)).toBe(false);
    }
  });

  it("does NOT carry the generator's crisisEscalationTrigger into the teacher export", () => {
    const withTrigger = { ...cleanBrief, crisisEscalationTrigger: "If X then call Y" } as any;
    const ex = buildSchoolBriefExport(withTrigger, { title: cleanBrief.title, date: cleanBrief.date });
    expect(Object.prototype.hasOwnProperty.call(ex, "crisisEscalationTrigger")).toBe(false);
    expect(JSON.stringify(ex)).not.toContain("call Y");
  });
});

describe("AP-056 Condition 3 — ZERO clinical-diagnosis language in the brief", () => {
  it("detects each banned clinical-diagnosis term (word-boundary, case-insensitive)", () => {
    expect(findClinicalDiagnosisTerm("This is a clear ADHD diagnosis")).toBeTruthy();
    expect(findClinicalDiagnosisTerm("possible autism")).toBe("autism");
    expect(findClinicalDiagnosisTerm("a speech DELAY")).toBe("delay");
    expect(findClinicalDiagnosisTerm("an attention deficit")).toBe("deficit");
    expect(findClinicalDiagnosisTerm("sensory disorder noted")).toBe("disorder");
  });

  it("does NOT false-positive on warm, non-diagnostic transition language", () => {
    expect(findClinicalDiagnosisTerm(exportToText(buildSchoolBriefExport(cleanBrief, { title: cleanBrief.title, date: cleanBrief.date })))).toBeNull();
  });

  it("FAILS CLOSED — the builder throws and refuses to export a brief with diagnosis language", () => {
    const diagnostic = { ...cleanBrief, overview: "Sam likely has ADHD and a developmental delay." };
    expect(() => buildSchoolBriefExport(diagnostic, { title: diagnostic.title, date: diagnostic.date }))
      .toThrow(ClinicalLanguageError);
  });

  it("every banned term is actually wired into the scanner", () => {
    for (const term of CLINICAL_DIAGNOSIS_TERMS) {
      expect(findClinicalDiagnosisTerm(`context ${term} context`)).toBeTruthy();
    }
  });
});

describe("AP-056 Condition 5 — OUTSIDE-ERASE-REACH notice present (EN + HE)", () => {
  it("the notice key exists in both dictionaries and warns the copy is outside Arbor's reach", () => {
    expect(en[OUTSIDE_ERASE_REACH_NOTICE_KEY]).toBeTruthy();
    expect(he[OUTSIDE_ERASE_REACH_NOTICE_KEY]).toBeTruthy();
    // EN must state the teacher's copy is theirs / Arbor can't delete it.
    const enNotice = en[OUTSIDE_ERASE_REACH_NOTICE_KEY].toLowerCase();
    expect(enNotice).toContain("teacher");
    expect(enNotice.includes("can't delete") || enNotice.includes("cannot delete")).toBe(true);
  });

  it("the explicit approve-export CTA exists in both dictionaries", () => {
    expect(en[APPROVE_EXPORT_CTA_KEY]).toBeTruthy();
    expect(he[APPROVE_EXPORT_CTA_KEY]).toBeTruthy();
  });
});

describe("AP-056 — clinician consult packet COEXISTS, untouched and distinct", () => {
  it("the School Brief module does NOT import or re-export the consult packet builder", () => {
    // The two surfaces are separate. The School Brief module must not flatten,
    // wrap, or re-export the consult packet (which would risk merging them).
    expect((schoolBriefMod as any).buildConsultPacket).toBeUndefined();
    expect((schoolBriefMod as any).serializePacket).toBeUndefined();
  });

  it("the consult packet still builds its own sections from the raw record (independent path)", () => {
    const packet = buildConsultPacket({
      profile: { name: "Sam", age: 5, languages: ["Hebrew", "English"] },
      logs: [{ behaviorType: "transition", intensity: 3, timestamp: Date.now() }],
      milestones: [{ domain: "language", title: "Two-word phrases", checked: true }],
      plans: [{ title: "Morning routine" }],
      memory: [{ fact: "Loves dinosaurs", status: "approved" }],
      nowMs: Date.now(),
    });
    // The consult packet INTENTIONALLY surfaces the longitudinal record to a
    // clinician — proving it is a different contract from the curated teacher brief.
    const md = serializePacket(packet);
    expect(md).toContain("Sam");
    expect(packet.sections.length).toBeGreaterThan(0);
  });
});

describe("AP-056 — serialized PDF/markdown body stays curated + non-diagnostic", () => {
  it("serializes only curated content and never leaks raw notes", () => {
    const ex = buildSchoolBriefExport(
      { ...cleanBrief, notes: "RAW PRIVATE NOTE", memory: [{ fact: "LEDGER" }] } as any,
      { title: cleanBrief.title, date: cleanBrief.date }
    );
    const md = serializeSchoolBrief(ex, LABELS);
    expect(md).not.toContain("RAW PRIVATE NOTE");
    expect(md).not.toContain("LEDGER");
    expect(md).toContain(cleanBrief.title);
    expect(findClinicalDiagnosisTerm(md)).toBeNull();
  });
});
