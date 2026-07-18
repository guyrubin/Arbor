import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  buildPresetPacket,
  serializePresetPacket,
  presetPacketToPrintSections,
  CONSULT_PRESETS,
  FORBIDDEN_EXPORT_TOKENS,
  type BuildPacketInput,
  type ConsultAudience,
} from "../consult/packet";
import { findClinicalDiagnosisTerm, RAW_RECORD_KEYS } from "./clinicalScan";
import {
  buildReport,
  type ParentReportType,
  type ReportContext,
  type ReportDoc,
} from "./reportExport";

/**
 * Wave-4 clinical-firewall test (IA W4.6, 2026-07-18).
 *
 * Locks the Care-wave invariants the way clinicalFirewall.wave3.test.ts locks
 * the Wave-3 demotions:
 *
 *  (a) every NON-clinician audience preset output passes the shared clinical
 *      scan (`findClinicalDiagnosisTerm`) and carries no RAW_RECORD_KEYS
 *      content — neither the raw field names nor the raw field VALUES;
 *  (b) the forbidden tokens (`riskLevel`, `milestonesPercent`) appear in NO
 *      serializer output — every audience preset, both egress shapes
 *      (Markdown + print sections), AND every remaining parent-record report
 *      type, even though the profile itself still carries `riskLevel`;
 *  (c) single-serializer seam — a SOURCE-BASED scan (as in the Wave-3 guard)
 *      proving no component reaches the professional-audience export path
 *      except through the consult preset serializer hosted in Reports.tsx.
 *
 * (d) of the wave — school-brief behavior identical — is schoolBrief.test.ts
 * itself, which stays untouched.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}

/** Strip line comments and block comments so the lint only sees code. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");
}

const NOW = new Date("2026-07-01T12:00:00").getTime();
const DAY = 86_400_000;

/* Distinctive markers on every raw-record field a log/memory row can carry —
 * if ANY of them survives into a non-clinician export, the ceiling leaked. */
const RAW_VALUE_MARKERS = ["RAW-LOG", "RAW-TRIGGER", "RAW-RESPONSE", "RAW-MEMORY"] as const;

const RICH: BuildPacketInput = {
  profile: {
    name: "Noa",
    age: 4,
    languages: ["Hebrew", "English"],
    schoolContext: "Bilingual preschool",
    strengths: ["warm with animals"],
    challenges: ["big transitions"],
  },
  logs: [
    { behaviorType: "RAW-LOG Transition Refusal", intensity: 5, timestamp: new Date(NOW - 1 * DAY).toISOString(), trigger: "RAW-TRIGGER screen turned off", response: "RAW-RESPONSE counted down from five", resolved: true },
    { behaviorType: "RAW-LOG Transition Refusal", intensity: 4, timestamp: new Date(NOW - 3 * DAY).toISOString(), trigger: "RAW-TRIGGER leaving the park", response: "RAW-RESPONSE named the feeling" },
    { behaviorType: "RAW-LOG Sibling Conflict", intensity: 3, timestamp: new Date(NOW - 2 * DAY).toISOString() },
  ],
  milestones: [
    { domain: "Language", title: "Two-word phrases", checked: true },
    { domain: "Motor", title: "Hops on one foot", checked: false },
  ],
  plans: [{ title: "Smoother mornings", issue: "leaving the house" }],
  memory: [{ fact: "RAW-MEMORY calms fastest with a countdown", status: "approved" }],
  nowMs: NOW,
};

const AUDIENCES = Object.keys(CONSULT_PRESETS) as ConsultAudience[];
const NON_CLINICIANS = AUDIENCES.filter((a) => CONSULT_PRESETS[a].clinicalTermScan);

/** Both egress shapes of a preset, flattened to text. */
function presetOutputs(audience: ConsultAudience): { label: string; text: string }[] {
  const packet = buildPresetPacket(audience, RICH);
  return [
    { label: `${audience} serializePresetPacket`, text: serializePresetPacket(audience, packet) },
    {
      label: `${audience} presetPacketToPrintSections`,
      text: presetPacketToPrintSections(audience, packet)
        .flatMap((s) => [s.heading, ...s.body])
        .join("\n"),
    },
  ];
}

describe("Wave-4 (a) — non-clinician preset outputs pass the shared clinical scan and carry no raw-record content", () => {
  it("there IS at least one non-clinician audience under the term scan (the ceiling cannot be silently unwired)", () => {
    expect(NON_CLINICIANS).toContain("teacher");
  });

  for (const audience of NON_CLINICIANS) {
    describe(`${audience} preset`, () => {
      const outputs = presetOutputs(audience);

      it("passes findClinicalDiagnosisTerm on every egress shape", () => {
        for (const { label, text } of outputs) {
          expect(findClinicalDiagnosisTerm(text), `${label} contains a clinical-diagnosis term`).toBeNull();
        }
      });

      it("leaks NO raw-record field values (behavior-log / memory-ledger markers)", () => {
        for (const { label, text } of outputs) {
          for (const marker of RAW_VALUE_MARKERS) {
            expect(text, `${label} leaks raw-record value "${marker}"`).not.toContain(marker);
          }
        }
      });

      it("leaks NO raw-record field names in structural form (`key:` / `\"key\"`)", () => {
        for (const { label, text } of outputs) {
          for (const key of RAW_RECORD_KEYS) {
            const structural = new RegExp(`"${key}"|\\b${key}\\s*:`);
            expect(text, `${label} leaks raw-record key "${key}"`).not.toMatch(structural);
          }
        }
      });
    });
  }
});

/* (b) — the forbidden tokens appear in NO serializer output. The parent-record
 * context deliberately carries `riskLevel: "High"` on the profile: the field
 * exists on ChildProfile, and the guard proves no builder ever serializes it. */

const PARENT_REPORT_TYPES = Object.keys({
  weekly: 1,
  snapshot: 1,
  behavior: 1,
  language: 1,
  growth: 1,
} satisfies Record<ParentReportType, 1>) as ParentReportType[];

const PARENT_CTX: ReportContext = {
  child: {
    id: "c1",
    name: "Noa",
    age: 4,
    languages: ["Hebrew", "English"],
    schoolContext: "Bilingual preschool",
    strengths: ["warm with animals"],
    challenges: ["big transitions", "new English words"],
    riskLevel: "High",
  },
  logs: [
    { id: "l1", timestamp: new Date(Date.now() - 1 * DAY).toISOString(), behaviorType: "Transition Refusal", intensity: 4, durationMinutes: 10, trigger: "Screen off", response: "Countdown from five", resolved: true },
    { id: "l2", timestamp: new Date(Date.now() - 2 * DAY).toISOString(), behaviorType: "Sibling Conflict", intensity: 3, durationMinutes: 5, trigger: "Shared toy", response: "Named the feeling" },
  ],
  plans: [
    {
      id: "p1",
      title: "Smoother mornings",
      issue: "leaving the house",
      phases: [
        { name: "Start", description: "Warm-up", steps: [{ text: "Two-minute warning", completed: true }, { text: "Visual schedule", completed: false }] },
      ],
      scripts: [],
      successIndicators: [],
    },
  ],
  checkedMilestones: 6,
  totalMilestones: 10,
};

function flattenDoc(doc: ReportDoc): string {
  return [
    doc.title,
    doc.subtitle ?? "",
    ...doc.sections.flatMap((s) => [s.heading, ...(Array.isArray(s.body) ? s.body : [s.body])]),
  ].join("\n");
}

describe("Wave-4 (b) — riskLevel / milestonesPercent appear in NO serializer output", () => {
  it("no audience preset output contains a forbidden token (both egress shapes)", () => {
    for (const audience of AUDIENCES) {
      for (const { label, text } of presetOutputs(audience)) {
        for (const token of FORBIDDEN_EXPORT_TOKENS) {
          expect(text, `${label} contains forbidden token "${token}"`).not.toContain(token);
        }
      }
    }
  });

  it("no parent-record report type contains a forbidden token — even with riskLevel set on the profile", () => {
    for (const type of PARENT_REPORT_TYPES) {
      const text = flattenDoc(buildReport(type, PARENT_CTX));
      for (const token of FORBIDDEN_EXPORT_TOKENS) {
        expect(text, `parent report "${type}" contains forbidden token "${token}"`).not.toContain(token);
      }
    }
  });

  it("no parent-record report type emits a percentage figure — counts, never percentages", () => {
    for (const type of PARENT_REPORT_TYPES) {
      const text = flattenDoc(buildReport(type, PARENT_CTX));
      expect(text, `parent report "${type}" emits a percentage figure`).not.toMatch(/\d+(?:\.\d+)?\s*%/);
    }
  });
});

/* (c) — single-serializer seam. SOURCE-BASED, like the Wave-3 guard: a future
 * re-wiring that routes a professional export around the preset serializer is
 * caught at CI time, not in review. */

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

const COMPONENT_FILES = walk(path.join(SRC_ROOT, "components")).map((f) => ({
  rel: path.relative(SRC_ROOT, f).replace(/\\/g, "/"),
  code: stripComments(fs.readFileSync(f, "utf8")),
}));

// The ONE component hosting the professional-audience export seam (useReportExport).
const PRESET_SEAM = "components/sections/Reports.tsx";
// Raw print SHELL (openPrintableReport) consumers: the seam itself, plus the
// monitoring printable whose doc builder is clinician-ceiling-bound in
// lib/monitoring.ts (IA W4.5). Nothing else may open a printable directly.
const PRINT_SHELL_ALLOWLIST = new Set([PRESET_SEAM, "components/sections/Screening.tsx"]);

describe("Wave-4 (c) — single-serializer seam (static source scan over src/components)", () => {
  it("the scan actually sees the seam files (guard is not scanning an empty tree)", () => {
    const rels = COMPONENT_FILES.map((f) => f.rel);
    expect(rels).toContain(PRESET_SEAM);
    expect(rels).toContain("components/sections/AskSpecialist.tsx");
  });

  it("buildReport (parent-records builder) is referenced by NO component except the Reports seam", () => {
    for (const { rel, code } of COMPONENT_FILES) {
      if (rel === PRESET_SEAM) continue;
      expect(code, `${rel} references buildReport outside the preset seam`).not.toMatch(/\bbuildReport\b/);
    }
    // And the seam itself still uses it (a rename must not hollow this guard).
    expect(COMPONENT_FILES.find((f) => f.rel === PRESET_SEAM)!.code).toMatch(/\bbuildReport\b/);
  });

  it("the preset serializer (buildPresetPacket / presetPacketToPrintSections) is imported by NO component except the Reports seam", () => {
    for (const { rel, code } of COMPONENT_FILES) {
      if (rel === PRESET_SEAM) continue;
      expect(code, `${rel} bypasses the seam with a direct preset-serializer call`).not.toMatch(
        /\b(buildPresetPacket|presetPacketToPrintSections)\b/
      );
    }
  });

  it("openPrintableReport (raw print shell) is reachable only from the allowlisted, ceiling-bound seams", () => {
    for (const { rel, code } of COMPONENT_FILES) {
      if (PRINT_SHELL_ALLOWLIST.has(rel)) continue;
      expect(code, `${rel} opens a printable outside the allowlisted seams`).not.toMatch(/\bopenPrintableReport\b/);
    }
    // Screening's printable must come from the ceiling-bound monitoring builder.
    const screening = COMPONENT_FILES.find((f) => f.rel === "components/sections/Screening.tsx")!.code;
    expect(screening).toMatch(/\bbuildMonitoringReportDoc\b/);
  });

  it("AskSpecialist reaches professional exports ONLY through the seam's useReportExport — never lib/reportExport directly", () => {
    const ask = COMPONENT_FILES.find((f) => f.rel === "components/sections/AskSpecialist.tsx")!.code;
    expect(ask, "AskSpecialist imports lib/reportExport directly").not.toMatch(/from\s+["'][^"']*reportExport["']/);
    expect(ask, "AskSpecialist no longer routes exports through useReportExport").toMatch(/\buseReportExport\b/);
  });

  it("the Reports seam gates on isProfessionalReportType and routes professionals through the consult preset serializer", () => {
    const seam = COMPONENT_FILES.find((f) => f.rel === PRESET_SEAM)!.code;
    expect(seam).toMatch(/\bisProfessionalReportType\b/);
    expect(seam).toMatch(/\bbuildPresetPacket\b/);
    expect(seam).toMatch(/\bpresetPacketToPrintSections\b/);
    expect(seam).toMatch(/from\s+["'][^"']*consult\/packet["']/);
  });
});
