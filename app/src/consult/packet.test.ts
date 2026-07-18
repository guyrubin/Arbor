import { describe, it, expect } from "vitest";
import {
  buildConsultPacket,
  serializePacket,
  countIncluded,
  buildPresetPacket,
  serializePresetPacket,
  CONSULT_PRESETS,
  FORBIDDEN_EXPORT_TOKENS,
  type BuildPacketInput,
  type ConsultAudience,
  type ConsultPacket,
} from "./packet";
import { ClinicalLanguageError } from "../lib/clinicalScan";

const NOW = new Date("2026-06-15T12:00:00").getTime();
const DAY = 86_400_000;

const base: BuildPacketInput = {
  profile: { name: "Dylan", age: 5, languages: ["Hebrew", "English"], schoolContext: "Bilingual kindergarten", strengths: ["curious"], challenges: ["transitions"] },
  logs: [
    { behaviorType: "Transition Refusal", intensity: 5, timestamp: new Date(NOW - 1 * DAY).toISOString() },
    { behaviorType: "Transition Refusal", intensity: 4, timestamp: new Date(NOW - 3 * DAY).toISOString() },
    { behaviorType: "Sibling Conflict", intensity: 3, timestamp: new Date(NOW - 2 * DAY).toISOString() },
  ],
  milestones: [
    { domain: "Language", title: "Two-word phrases", checked: true },
    { domain: "Motor", title: "Hops on one foot", checked: false },
  ],
  plans: [{ title: "Smoother mornings", issue: "leaving for school" }],
  memory: [
    { fact: "Calms fastest with a countdown.", status: "approved" },
    { fact: "Pending unreviewed note.", status: "pending" },
  ],
  nowMs: NOW,
};

describe("buildConsultPacket", () => {
  it("assembles the expected sections from the record", () => {
    const p = buildConsultPacket(base);
    expect(p.childLabel).toBe("Dylan");
    expect(p.sections.map((s) => s.id)).toEqual(["about", "patterns", "development", "tried", "memory"]);
  });

  it("ranks recent concerns by frequency and flags intensity", () => {
    const p = buildConsultPacket(base);
    const patterns = p.sections.find((s) => s.id === "patterns")!;
    expect(patterns.items[0].text).toMatch(/Transition Refusal: 2 times/);
    expect(patterns.items[0].text).toMatch(/intense/);
  });

  it("only includes approved memory facts (never pending)", () => {
    const p = buildConsultPacket(base);
    const mem = p.sections.find((s) => s.id === "memory")!;
    expect(mem.items).toHaveLength(1);
    expect(mem.items[0].text).toBe("Calms fastest with a countdown.");
  });

  it("excludes logs outside the window from patterns", () => {
    const stale: BuildPacketInput = { ...base, logs: [{ behaviorType: "Old", intensity: 5, timestamp: new Date(NOW - 90 * DAY).toISOString() }] };
    const p = buildConsultPacket(stale);
    expect(p.sections.find((s) => s.id === "patterns")).toBeUndefined();
  });

  it("omits sections with no source data", () => {
    const minimal: BuildPacketInput = { ...base, logs: [], milestones: [], plans: [], memory: [] };
    const p = buildConsultPacket(minimal);
    expect(p.sections.map((s) => s.id)).toEqual(["about"]);
  });
});

describe("serializePacket (redaction)", () => {
  it("renders Markdown with all items by default", () => {
    const p = buildConsultPacket(base);
    const md = serializePacket(p);
    expect(md).toMatch(/# Dylan — context for our conversation/);
    expect(md).toMatch(/Calms fastest with a countdown/);
    expect(md).toMatch(/non-diagnostic/i);
  });

  it("omits redacted items and drops a fully-redacted section", () => {
    const p = buildConsultPacket(base);
    const excluded = new Set(["mem-0"]);
    const md = serializePacket(p, excluded);
    expect(md).not.toMatch(/Calms fastest with a countdown/);
    expect(md).not.toMatch(/Context worth knowing/); // section emptied → dropped
  });

  it("countIncluded reflects redactions", () => {
    const p = buildConsultPacket(base);
    const total = countIncluded(p, new Set());
    const less = countIncluded(p, new Set(["mem-0", "about-basics"]));
    expect(less).toBe(total - 2);
  });
});

/* IA W4.1 — audience presets. These tests ARE the binding gate on the
 * preset data ceilings, mirroring schoolBrief.test.ts: a red test here means
 * the audience-preset serializer is BLOCKED. */

const AUDIENCES: readonly ConsultAudience[] = ["teacher", "therapist", "pediatrician"];
const CLINICIANS: readonly ConsultAudience[] = ["therapist", "pediatrician"];

describe("IA W4.1 — per-preset data ceilings", () => {
  it("teacher preset is capped at the curated ceiling: no log patterns, no milestone coverage, no memory facts", () => {
    const p = buildPresetPacket("teacher", base);
    expect(p.sections.map((s) => s.id)).toEqual(["about", "tried"]);
    expect(CONSULT_PRESETS.teacher.dataCeiling.logDerivedPatterns).toBe(false);
    expect(CONSULT_PRESETS.teacher.dataCeiling.approvedMemoryFacts).toBe(false);
    const md = serializePresetPacket("teacher", p);
    expect(md).not.toMatch(/Transition Refusal/); // behavior-log derived
    expect(md).not.toMatch(/Sibling Conflict/);
    expect(md).not.toMatch(/Calms fastest with a countdown/); // memory ledger
    expect(md).not.toMatch(/milestones/i);
  });

  it("clinician presets keep log-derived patterns + approved memory facts in ceiling", () => {
    for (const audience of CLINICIANS) {
      const p = buildPresetPacket(audience, base);
      expect(p.sections.map((s) => s.id)).toEqual(["about", "patterns", "development", "tried", "memory"]);
      const md = serializePresetPacket(audience, p);
      expect(md).toMatch(/Transition Refusal: 2 times/);
      expect(md).toMatch(/Calms fastest with a countdown/);
      expect(md).not.toMatch(/Pending unreviewed note/); // approved facts only, still
    }
  });

  it("serialization re-caps to the ceiling — an out-of-ceiling section handed to the teacher serializer is dropped", () => {
    const clinician = buildPresetPacket("therapist", base);
    const md = serializePresetPacket("teacher", clinician); // clinician packet through the teacher seam
    expect(md).not.toMatch(/Transition Refusal/);
    expect(md).not.toMatch(/Calms fastest with a countdown/);
  });
});

describe("IA W4.1 — fail-closed clinical-term scan (non-clinicians only)", () => {
  const seeded: BuildPacketInput = {
    ...base,
    profile: { ...base.profile, challenges: ["speech delay"] },
  };

  it("teacher preset THROWS on a seeded diagnosis term (fail closed, no export)", () => {
    expect(() => buildPresetPacket("teacher", seeded)).toThrow(ClinicalLanguageError);
  });

  it("clinician presets pass the SAME input — 'speech delay' is legitimate clinical shorthand", () => {
    for (const audience of CLINICIANS) {
      const md = serializePresetPacket(audience, buildPresetPacket(audience, seeded));
      expect(md).toContain("speech delay");
    }
  });

  it("teacher serialization re-runs the scan at the egress seam (edits cannot route around the build-time scan)", () => {
    const p = buildPresetPacket("teacher", base);
    const edited: ConsultPacket = {
      ...p,
      sections: p.sections.map((s) =>
        s.id === "about" ? { ...s, items: [...s.items, { id: "about-edit", text: "possible ADHD" }] } : s
      ),
    };
    expect(() => serializePresetPacket("teacher", edited)).toThrow(ClinicalLanguageError);
  });
});

describe("IA W4.1 — forbidden tokens appear in NO export (any audience)", () => {
  it("no preset output contains riskLevel, milestonesPercent, or a % readiness figure", () => {
    for (const audience of AUDIENCES) {
      const md = serializePresetPacket(audience, buildPresetPacket(audience, base));
      expect(md).not.toContain("riskLevel");
      expect(md).not.toContain("milestonesPercent");
      expect(md).not.toMatch(/\d+\s*%/); // never a percentage figure — counts only
    }
  });

  it("the forbidden-token guard fails closed for EVERY audience — clinicians included", () => {
    for (const audience of AUDIENCES) {
      for (const token of FORBIDDEN_EXPORT_TOKENS) {
        const p = buildPresetPacket(audience, base);
        const poisoned: ConsultPacket = {
          ...p,
          sections: p.sections.map((s) =>
            s.id === "about" ? { ...s, items: [...s.items, { id: "about-x", text: `${token}: high` }] } : s
          ),
        };
        expect(() => serializePresetPacket(audience, poisoned)).toThrow(token);
      }
    }
  });
});
