/* LC-08 — components never build export text through the unguarded
 * `serializePacket`; the ONE seam is `serializeForExport` (audience-capped,
 * note-scanned). Source-scan guard in the cosmeticsFirewall style: every
 * component file is checked, and the checker is proven against a planted
 * pre-fix import (negative control). */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS = path.join(here, "..", "components");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.")) out.push(full);
  }
  return out;
}

/** True when the source imports the bare `serializePacket` symbol from the
 *  consult packet module (not `serializePresetPacket` / `serializeForExport`). */
export function importsBareSerializePacket(src: string): boolean {
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*consult\/packet["']/g)) {
    const names = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim());
    if (names.includes("serializePacket")) return true;
  }
  return /\bserializePacket\s*\(/.test(src);
}

describe("LC-08 — no component imports or calls serializePacket directly", () => {
  const files = walk(COMPONENTS);

  it("scans a real component tree", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("every component file routes through serializeForExport / the preset serializers", () => {
    const offenders = files.filter((f) => importsBareSerializePacket(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(COMPONENTS, f)), "components importing the unguarded serializePacket").toEqual([]);
  });

  it("AskSpecialist builds Copy / Download / Send text through serializeForExport", () => {
    const src = readFileSync(path.join(COMPONENTS, "sections", "AskSpecialist.tsx"), "utf8");
    expect(src).toContain("serializeForExport(");
    expect(src).toMatch(/import\s*\{[^}]*serializeForExport[^}]*\}\s*from\s*["']\.\.\/\.\.\/consult\/packet["']/);
    // The audience selector is a required first step of the export bar.
    expect(src).toContain('role="radiogroup"');
    expect(src).toContain("EXPORT_AUDIENCES");
  });

  it("NEGATIVE CONTROL: the pre-fix import is flagged by the checker", () => {
    const preFix = `import { appendParentNote, buildConsultPacket, serializePacket, countIncluded } from "../../consult/packet";`;
    expect(importsBareSerializePacket(preFix)).toBe(true);
    expect(importsBareSerializePacket(`const md = serializePacket(packet, excluded);`)).toBe(true);
    expect(importsBareSerializePacket(`import { serializePresetPacket, serializeForExport } from "../../consult/packet";`)).toBe(false);
  });
});

/* ── B-CAREPRO-02 — the Consult PDF menu only offers documents that honour the
 * redaction the parent just approved. The five parent-record documents built
 * through `buildReport` (no `excludedIds` parameter at all) printed "Suggested
 * focus", quoted triggers and "What helped" whatever the toggles said, behind a
 * consent checkbox that covered text the parent never saw. */
import { isProfessionalReportType, type ReportType } from "../lib/reportExport";
import { buildPresetPacket, presetPacketToPrintSections, type BuildPacketInput, type ConsultAudience } from "./packet";

const ALL_REPORT_TYPES: ReportType[] = [
  "weekly", "teacher", "therapist", "pediatrician", "slp", "behavioral_health", "snapshot", "behavior", "language", "growth",
];
/** The same predicate AskSpecialist applies to REPORTS (asserted below). */
const consultMenuTypes = ALL_REPORT_TYPES.filter((t) => isProfessionalReportType(t) && t !== "teacher") as ConsultAudience[];

const FIXTURE: BuildPacketInput = {
  profile: { name: "Dylan", age: 5, languages: ["Hebrew"], schoolContext: "Gan", strengths: ["curious"], challenges: ["transitions"] },
  logs: [{ behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date().toISOString() }],
  milestones: [],
  plans: [],
  memory: [],
  nowMs: Date.now(),
};

describe("B-CAREPRO-02 — every Consult menu type honours excludedIds", () => {
  const ask = readFileSync(path.join(COMPONENTS, "sections", "AskSpecialist.tsx"), "utf8").replace(/\r\n/g, "\n");

  it("the menu is the professional-preset subset, keyed (EN + HE), never the full REPORTS list", () => {
    expect(ask).toContain(
      'const CONSULT_MENU_REPORTS = REPORTS.filter((r) => isProfessionalReportType(r.type) && r.type !== "teacher");'
    );
    expect(ask).toContain("{CONSULT_MENU_REPORTS.map((r, idx) => (");
    expect(ask).not.toMatch(/\{REPORTS\.map\(/);
    // the item label is the translated key, not the English literal
    expect(ask).not.toMatch(/\{r\.title\}/);
    expect(consultMenuTypes).toEqual(["therapist", "pediatrician", "slp", "behavioral_health"]);
  });

  it("every Consult menu type honours excludedIds", () => {
    for (const type of consultMenuTypes) {
      const packet = buildPresetPacket(type, FIXTURE);
      const kept = presetPacketToPrintSections(type, packet, new Set()).flatMap((s) => s.body).join("\n");
      // non-vacuity: without the toggle the line IS in the document
      expect(kept, `${type} fixture lacks the focus line`).toContain("Current focus");
      const redacted = presetPacketToPrintSections(type, packet, new Set(["about-focus"])).flatMap((s) => s.body).join("\n");
      expect(redacted, `${type} printed an excluded row`).not.toContain("Current focus");
    }
  });

  it("NEGATIVE CONTROL: the parent-record types would have reached the menu without the filter", () => {
    const unfiltered = ALL_REPORT_TYPES.filter((t) => t !== "teacher");
    expect(unfiltered).toEqual(expect.arrayContaining(["weekly", "snapshot", "behavior", "language", "growth"]));
    for (const t of ["weekly", "snapshot", "behavior", "language", "growth"] as ReportType[]) {
      expect(isProfessionalReportType(t)).toBe(false);
    }
  });
});
