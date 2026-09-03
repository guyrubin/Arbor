import { describe, it, expect } from "vitest";
import {
  appendParentNote,
  buildConsultPacket,
  serializePacket,
  countIncluded,
  buildPresetPacket,
  serializePresetPacket,
  presetPacketToPrintSections,
  CONSULT_PRESETS,
  FORBIDDEN_EXPORT_TOKENS,
  assertClinicianExportCeiling,
  isConsultPacketEmpty,
  serializeForExport,
  humanDomainLabel,
  milestoneInAgeWindow,
  EXPORT_AUDIENCES,
  type BuildPacketInput,
  type ConsultAudience,
  type ConsultPacket,
} from "./packet";
import { ClinicalLanguageError } from "../lib/clinicalScan";
import { ALL_MILESTONES, MILESTONE_AGE_BANDS } from "../lib/milestoneData";

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
  it("formats infant and mixed-year ages from a minimal export profile", () => {
    for (const [ageMonths, label] of [[9, "9 months"], [15, "1 year 3 months"], [60, "5 years"]] as const) {
      const packet = buildConsultPacket({
        ...base,
        profile: { name: "Tali", age: Math.floor(ageMonths / 12), ageMonths, languages: [] },
      });
      expect(packet.sections.find((section) => section.id === "about")?.items[0].text)
        .toBe(`Tali, ${label}.`);
    }
  });

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

/* AIX-S3(a) — the Vision handoff note joins the packet as a parent-reviewed
 * note under its own heading; an empty note changes nothing. */
describe("AIX-S3 — appendParentNote (Vision handoff → consult composer)", () => {
  const packetMd = serializePacket(buildConsultPacket(base));

  it("appends a trimmed note under the given heading", () => {
    const md = appendParentNote(packetMd, "  School report notes better focus after breaks.  ", "Parent note");
    expect(md).toContain("## Parent note");
    expect(md).toContain("School report notes better focus after breaks.");
    expect(md.startsWith(packetMd.trimEnd())).toBe(true);
    expect(md.endsWith("\n")).toBe(true);
  });

  it("returns the packet unchanged for an empty or whitespace note", () => {
    expect(appendParentNote(packetMd, "", "Parent note")).toBe(packetMd);
    expect(appendParentNote(packetMd, "   \n ", "Parent note")).toBe(packetMd);
  });

  it("keeps the packet's own content intact (note is additive only)", () => {
    const md = appendParentNote(packetMd, "A note.", "Parent note");
    expect(md).toMatch(/# Dylan — context for our conversation/);
    expect(md).toMatch(/Calms fastest with a countdown/);
  });
});

/* IA W4.1 — audience presets. These tests ARE the binding gate on the
 * preset data ceilings, mirroring schoolBrief.test.ts: a red test here means
 * the audience-preset serializer is BLOCKED. */

const AUDIENCES: readonly ConsultAudience[] = ["teacher", "therapist", "pediatrician", "slp", "behavioral_health"];
const CLINICIANS: readonly ConsultAudience[] = ["therapist", "pediatrician", "slp", "behavioral_health"];

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

/* UND-4 (AR-CAP-08) — the packet preserves the parent's actual response:
 * observed / not sure / not yet, each its own group WITH observation dates. */

describe("UND-4 — development snapshot preserves observed / not sure / not yet with dates", () => {
  const withStatuses: BuildPacketInput = {
    ...base,
    milestones: [
      { domain: "Language", title: "Two-word phrases", checked: true, status: "yes", observedAt: "2026-05-20T09:00:00.000Z" },
      { domain: "Motor", title: "Hops on one foot", checked: false, status: "not_sure", observedAt: "2026-06-01T10:00:00.000Z" },
      { domain: "Social", title: "Takes turns in games", checked: false, status: "not_yet", observedAt: "2026-06-03T08:00:00.000Z" },
      // Legacy item with no explicit status: derived from `checked`.
      { domain: "Language", title: "Follows two-step directions", checked: false },
    ],
  };

  it("a 'not sure' milestone appears as its OWN category with its date — and not-yet items are NEVER listed (RUN-01)", () => {
    for (const audience of CLINICIANS) {
      const md = serializePresetPacket(audience, buildPresetPacket(audience, withStatuses));
      expect(md).toMatch(/Not sure yet \(1\): Hops on one foot \(Motor, 2026-06-01\)/);
      expect(md).toMatch(/Observed \(1\): Two-word phrases \(Language, 2026-05-20\)/);
      // RUN-01 (wave T): the pre-fix "Not yet observed (2): …" deficit list is gone —
      // an unmarked item is "never asked", not "not observed".
      expect(md).not.toMatch(/Not yet observed/);
      expect(md).not.toContain("Takes turns in games");
    }
  });

  it("legacy milestones without a status derive from `checked` (checked → observed; unchecked → never listed)", () => {
    const p = buildConsultPacket(base); // base fixture has no status fields
    const dev = p.sections.find((s) => s.id === "development")!;
    const text = dev.items.map((it) => it.text).join("\n");
    expect(text).toMatch(/Observed \(1\): Two-word phrases/);
    expect(text).not.toMatch(/Not yet observed/); // RUN-01: updated from the pre-fix "Not yet observed (1): Hops on one foot"
    expect(text).not.toContain("Hops on one foot");
    expect(text).not.toMatch(/Not sure yet/); // no unfounded uncertainty claim
  });

  it("the grouped snapshot stays counts-only: no percentage, score, or verdict wording", () => {
    for (const audience of CLINICIANS) {
      const md = serializePresetPacket(audience, buildPresetPacket(audience, withStatuses));
      expect(md).not.toMatch(/\d+(\.\d+)?\s*%/);
      expect(md).not.toMatch(/on[\s-]?track|behind|delayed|score/i);
    }
  });
});

/* CARE-7 — SLP + behavioral-health presets reuse the ONE clinician ceiling,
 * and the computed "Since the last export" delta appears only with a prior
 * export on record. */

describe("CARE-7 — SLP + behavioral-health presets mirror the clinician ceiling exactly", () => {
  it("both new presets carry the same sections, data ceiling, and term-scan policy as the therapist preset", () => {
    for (const audience of ["slp", "behavioral_health"] as const) {
      const preset = CONSULT_PRESETS[audience];
      expect([...preset.sections]).toEqual([...CONSULT_PRESETS.therapist.sections]);
      expect(preset.dataCeiling).toEqual(CONSULT_PRESETS.therapist.dataCeiling);
      expect(preset.clinicalTermScan).toBe(false);
    }
  });

  it("new presets build the full clinician packet (patterns + memory in ceiling)", () => {
    for (const audience of ["slp", "behavioral_health"] as const) {
      const p = buildPresetPacket(audience, base);
      expect(p.sections.map((s) => s.id)).toEqual(["about", "patterns", "development", "tried", "memory"]);
    }
  });
});

describe("CARE-7 — 'Since the last export' delta (counts only, prior-export gated)", () => {
  const withDelta: BuildPacketInput = {
    ...base,
    milestones: [
      { domain: "Language", title: "Two-word phrases", checked: true, status: "yes", observedAt: new Date(NOW - 2 * DAY).toISOString() },
      { domain: "Motor", title: "Hops on one foot", checked: true, status: "yes", observedAt: new Date(NOW - 20 * DAY).toISOString() },
    ],
    plans: [
      { title: "Smoother mornings", issue: "leaving for school", createdAt: NOW - 1 * DAY },
      { title: "Older plan", issue: "bedtime", createdAt: NOW - 30 * DAY },
    ],
    lastExportedAt: new Date(NOW - 7 * DAY).toISOString(),
  };

  it("NO prior export → NO delta section (for any audience)", () => {
    for (const audience of AUDIENCES) {
      const p = buildPresetPacket(audience, base); // base has no lastExportedAt
      expect(p.sections.some((s) => s.id === "since-last-visit")).toBe(false);
    }
  });

  it("prior export → clinician packets gain the delta with correct counts and no percentages", () => {
    for (const audience of CLINICIANS) {
      const p = buildPresetPacket(audience, withDelta);
      const delta = p.sections.find((s) => s.id === "since-last-visit")!;
      expect(delta).toBeDefined();
      expect(delta.title).toContain(new Date(NOW - 7 * DAY).toISOString().slice(0, 10));
      const text = delta.items.map((it) => it.text).join("\n");
      expect(text).toMatch(/3 new moments logged\./);        // all base logs are within 7 days
      expect(text).toMatch(/1 action plan added\./);          // only the 1-day-old plan
      expect(text).toMatch(/1 milestone newly noticed\./);    // only the 2-day-old observation
      expect(text).not.toMatch(/\d+(\.\d+)?\s*%/);
    }
  });

  it("teacher stays behind the curated ceiling — the log-derived delta NEVER reaches a teacher export", () => {
    const p = buildPresetPacket("teacher", withDelta);
    expect(p.sections.map((s) => s.id)).toEqual(["about", "tried"]);
    const md = serializePresetPacket("teacher", p);
    expect(md).not.toMatch(/Since the last export/);
    expect(md).not.toMatch(/new moment/);
  });

  it("the delta rides the fail-closed egress guards like every other section", () => {
    for (const audience of CLINICIANS) {
      const p = buildPresetPacket(audience, withDelta);
      const poisoned: ConsultPacket = {
        ...p,
        sections: p.sections.map((s) =>
          s.id === "since-last-visit" ? { ...s, items: [...s.items, { id: "delta-x", text: "milestonesPercent: 80" }] } : s
        ),
      };
      expect(() => serializePresetPacket(audience, poisoned)).toThrow("milestonesPercent");
    }
  });
});

/* IA W4.5 — the clinician ceiling for clinician-facing exports OUTSIDE the
 * consult packet (Copilot practice summary, monitoring printable). */

describe("IA W4.5 — assertClinicianExportCeiling (non-packet clinician surfaces)", () => {
  it("passes counts-only clinician text", () => {
    expect(() =>
      assertClinicianExportCeiling("/s/ landed about 7 of the last 10 practice tries, 14 total")
    ).not.toThrow();
  });

  it("fails closed on the forbidden tokens", () => {
    for (const token of FORBIDDEN_EXPORT_TOKENS) {
      expect(() => assertClinicianExportCeiling(`${token}: high`)).toThrow(token);
    }
  });

  it("fails closed on ANY percentage figure — exports carry counts, never percentages", () => {
    expect(() => assertClinicianExportCeiling("recent home-practice accuracy 62%")).toThrow(ClinicalLanguageError);
    expect(() => assertClinicianExportCeiling("readiness 33.3 %")).toThrow(ClinicalLanguageError);
  });
});

/* IA W4.2 — the print-shell path (AskSpecialist Export-as-PDF + Reports).
 * Same egress contract as the Markdown serializer: ceiling, redaction, guards. */

describe("IA W4.2 — presetPacketToPrintSections (the PDF export path)", () => {
  it("teacher print export carries NO raw behavior-log data: no top trigger, no average intensity, no raw log responses/triggers", () => {
    const logged: BuildPacketInput = {
      ...base,
      logs: base.logs.map((l) => ({ ...l, trigger: "Screen turned off", response: "Countdown from five" })),
    };
    const sections = presetPacketToPrintSections("teacher", buildPresetPacket("teacher", logged));
    const text = sections.flatMap((s) => [s.heading, ...s.body]).join("\n");
    expect(sections.map((s) => s.heading)).toEqual(["About Dylan", "What we've already tried"]);
    expect(text).not.toMatch(/Transition Refusal/); // topTrigger / most-logged
    expect(text).not.toMatch(/Sibling Conflict/);
    expect(text).not.toMatch(/intensity/i);         // avgIntensity
    expect(text).not.toMatch(/Countdown from five/); // raw log response
    expect(text).not.toMatch(/Screen turned off/);   // raw log trigger
    expect(text).not.toMatch(/\d+\s*%/);             // counts only, never a percentage
  });

  it("parent redaction survives into the print path — excluded items drop and emptied sections vanish", () => {
    const p = buildPresetPacket("therapist", base);
    const sections = presetPacketToPrintSections("therapist", p, new Set(["mem-0"]));
    const text = sections.flatMap((s) => [s.heading, ...s.body]).join("\n");
    expect(text).not.toMatch(/Calms fastest with a countdown/);
    expect(sections.some((s) => s.heading === "Context worth knowing")).toBe(false);
  });

  it("re-runs the fail-closed guards at the print egress seam (edits cannot route around the build-time scan)", () => {
    const p = buildPresetPacket("teacher", base);
    const edited: ConsultPacket = {
      ...p,
      sections: p.sections.map((s) =>
        s.id === "about" ? { ...s, items: [...s.items, { id: "about-edit", text: "possible ADHD" }] } : s
      ),
    };
    expect(() => presetPacketToPrintSections("teacher", edited)).toThrow(ClinicalLanguageError);
  });
});

/* ── Wave T lane C ─────────────────────────────────────────────────────────── */

describe("LC-06 — isConsultPacketEmpty (the empty state can actually mount)", () => {
  it("profile-only input yields only the about section, and that IS empty", () => {
    const p = buildConsultPacket({ ...base, logs: [], milestones: [], plans: [], memory: [] });
    expect(p.sections.map((s) => s.id)).toEqual(["about"]);
    expect(isConsultPacketEmpty(p)).toBe(true);
  });

  it("day-0 seeded checklists (every milestone unmarked) are still empty — no observation, no section", () => {
    const seeded = ALL_MILESTONES.map((m) => ({ domain: m.domain, title: m.title, checked: false, ageMonths: m.ageMonths }));
    const p = buildConsultPacket({ ...base, logs: [], milestones: seeded, plans: [], memory: [] });
    expect(isConsultPacketEmpty(p)).toBe(true);
  });

  it("NEGATIVE CONTROL: the pre-fix test `sections.length === 0` never fires, even for a profile-only packet", () => {
    const p = buildConsultPacket({ ...base, logs: [], milestones: [], plans: [], memory: [] });
    expect(p.sections.length === 0).toBe(false);
  });

  it("one logged moment makes the packet non-empty", () => {
    const p = buildConsultPacket({ ...base, milestones: [], plans: [], memory: [] });
    expect(isConsultPacketEmpty(p)).toBe(false);
  });
});

describe("RUN-01 — the development snapshot never reads as a deficit list", () => {
  /** Age-5 profile, the real CDC/ASHA/Arbor library, ONE observation in the 4-year band. */
  const seeded = ALL_MILESTONES.map((m) => ({
    domain: m.domain, title: m.title, checked: false, ageMonths: m.ageMonths,
  }));
  const fourYearItem = ALL_MILESTONES.find((m) => m.ageMonths === 48)!;
  const ageFive: BuildPacketInput = {
    ...base,
    profile: { ...base.profile, age: 5, ageMonths: 60 },
    milestones: seeded.map((m) =>
      m.title === fourYearItem.title ? { ...m, checked: true, status: "yes" as const, observedAt: "2026-06-10T09:00:00.000Z" } : m
    ),
  };
  const text = () => serializePresetPacket("pediatrician", buildPresetPacket("pediatrician", ageFive));
  const infantTitles = ALL_MILESTONES.filter((m) => typeof m.ageMonths === "number" && m.ageMonths <= 12).map((m) => m.title);

  it("emits no raw snake_case domain keys, no `key: n/m` fractions, and no 'Not yet observed' list", () => {
    const md = text();
    expect(md).not.toMatch(/[a-z]+_[a-z]+: \d+\/\d+/);
    expect(md).not.toMatch(/[a-z]+_[a-z]+/);
    expect(md).not.toMatch(/Not yet observed/i);
    expect(md).not.toMatch(/\d+\/\d+/);
  });

  it("names no milestone from the 0–12-month band for a 5-year-old", () => {
    const md = text();
    expect(infantTitles.length).toBeGreaterThan(20); // sanity: the library is real
    for (const title of infantTitles) expect(md, `infant milestone leaked: ${title}`).not.toContain(title);
  });

  it("windows the denominator to the 4- and 5-year checklists and uses Development's human labels", () => {
    const md = text();
    const inWindow = ALL_MILESTONES.filter((m) => typeof m.ageMonths === "number" && m.ageMonths >= 48 && m.ageMonths < 72);
    expect(md).toContain(`1 of ${inWindow.length} milestones on the 5 years checklists noticed so far.`);
    expect(md).toContain("Thinking & attention:");
    expect(md).toContain(`Observed (1): ${fourYearItem.title} (${humanDomainLabel(fourYearItem.domain)}, 2026-06-10)`);
    expect(md).not.toContain(`of ${ALL_MILESTONES.length} `);
  });

  it("NEGATIVE CONTROL: the pre-fix shape (all-library denominator + snake_case fractions) trips the guard regexes", () => {
    const preFix = `cognition_executive_function: 0/31.\nNot yet observed (133): Calms when comforted; Smiles at people.`;
    expect(preFix).toMatch(/[a-z]+_[a-z]+: \d+\/\d+/);
    expect(preFix).toMatch(/Not yet observed/);
  });

  it("milestoneInAgeWindow: current band + the one before; unanchored items always count", () => {
    expect(milestoneInAgeWindow(60, 60)).toBe(true);
    expect(milestoneInAgeWindow(48, 60)).toBe(true);
    expect(milestoneInAgeWindow(36, 60)).toBe(false);
    expect(milestoneInAgeWindow(2, 60)).toBe(false);
    expect(milestoneInAgeWindow(72, 60)).toBe(false); // never ahead-of-band
    expect(milestoneInAgeWindow(undefined, 60)).toBe(true);
    expect(MILESTONE_AGE_BANDS.length).toBeGreaterThan(5);
  });

  it("humanDomainLabel never returns an identifier", () => {
    expect(humanDomainLabel("cognition_executive_function")).toBe("Thinking & attention");
    expect(humanDomainLabel("custom_thing")).toBe("Custom thing");
    expect(humanDomainLabel("Motor")).toBe("Motor");
  });
});

describe("LC-08 — serializeForExport: one seam, audience-capped, note scanned", () => {
  const noteHeading = "Parent note";

  it("teacher output excludes memory facts and log-derived patterns", () => {
    const md = serializeForExport("teacher", buildConsultPacket(base), new Set(), "Loves trains.", noteHeading);
    expect(md).not.toMatch(/Calms fastest with a countdown/);
    expect(md).not.toMatch(/Transition Refusal/);
    expect(md).not.toMatch(/Sibling Conflict/);
    expect(md).not.toMatch(/Development snapshot/);
    expect(md).toContain("Smoother mornings");
    expect(md).toContain("## Parent note");
    expect(md).toContain("Loves trains.");
  });

  it("a note containing a clinical term FAILS CLOSED for a teacher, passes for a clinician and for the parent's own records", () => {
    const note = "The school suggested a speech delay assessment.";
    const packet = buildConsultPacket(base);
    expect(() => serializeForExport("teacher", packet, new Set(), note, noteHeading)).toThrow(ClinicalLanguageError);
    expect(serializeForExport("clinician", packet, new Set(), note, noteHeading)).toContain(note);
    expect(serializeForExport("self", packet, new Set(), note, noteHeading)).toContain(note);
  });

  it("clinician output keeps patterns + approved memory; parent-own records keep everything selected", () => {
    const packet = buildConsultPacket(base);
    const clin = serializeForExport("clinician", packet);
    expect(clin).toMatch(/Transition Refusal: 2 times/);
    expect(clin).toMatch(/Calms fastest with a countdown/);
    const self = serializeForExport("self", packet, new Set(["mem-0"]));
    expect(self).toMatch(/Transition Refusal/);
    expect(self).not.toMatch(/Calms fastest with a countdown/); // redaction honoured
  });

  it("a percentage or forbidden token in the note fails closed for EVERY audience", () => {
    const packet = buildConsultPacket(base);
    for (const audience of EXPORT_AUDIENCES) {
      expect(() => serializeForExport(audience, packet, new Set(), "Progress 80% overall.", noteHeading), audience).toThrow(ClinicalLanguageError);
      expect(() => serializeForExport(audience, packet, new Set(), "riskLevel: Low", noteHeading), audience).toThrow(ClinicalLanguageError);
    }
  });

  it("NEGATIVE CONTROL: the pre-fix path (serializePacket + appendParentNote) hands a teacher the memory facts", () => {
    const preFix = appendParentNote(serializePacket(buildConsultPacket(base)), "any note", noteHeading);
    expect(preFix).toMatch(/Calms fastest with a countdown/);
  });
});
