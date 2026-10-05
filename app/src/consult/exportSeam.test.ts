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

/* ── B-CAREPRO-28 — every Consult egress uses the chosen professional preset;
 * one PDF per audience; the 10-item menu and the .md download are gone.
 * Before: Copy/Download/mail for "a clinician" always serialized the therapist
 * preset, so the SLP phrases and the pediatrician's measurements reached only
 * a separate PDF menu. Now the audience IS the preset, and Copy (text) and
 * Save as PDF (print sections) are built from the same packet, the same
 * redaction and the same note — so they carry the same words. */
import { isProfessionalReportType, type ReportType } from "../lib/reportExport";
import {
  buildConsultPacket,
  exportPrintSections,
  serializeForExport,
  EXPORT_AUDIENCES,
  DEFAULT_EXPORT_AUDIENCE,
  normalizeExportAudience,
  type BuildPacketInput,
  type ConsultPacket,
  type ExportAudience,
} from "./packet";

const ALL_REPORT_TYPES: ReportType[] = [
  "weekly", "teacher", "therapist", "pediatrician", "slp", "behavioral_health", "snapshot", "behavior", "language", "growth",
];

const NOW = Date.UTC(2026, 9, 2);
const DAY = 86_400_000;
const FIXTURE: BuildPacketInput = {
  profile: { name: "Dylan", age: 5, languages: ["Hebrew"], schoolContext: "Gan", strengths: ["curious"], challenges: ["transitions"] },
  logs: [
    { behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date(NOW - 2 * DAY).toISOString(), trigger: "Leaving the park" },
  ],
  milestones: [{ domain: "communication", title: "Says two-word phrases", checked: true, status: "yes", observedAt: new Date(NOW - 5 * DAY).toISOString() }],
  plans: [{ title: "Five-minute warning" }],
  memory: [{ fact: "Calms with a countdown", status: "approved" }],
  nowMs: NOW,
  reason: "Talking at gan",
  langObs: [{ phrase: "more juice", language: "en", at: new Date(NOW - 3 * DAY).toISOString() }],
  growthEntries: [{ date: "2026-09-20", heightCm: 108, weightKg: 18 }],
};

/** The words a document carries: headings and lines, without Markdown marks. */
function copyLines(md: string): string[] {
  return md
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").replace(/^-\s*/, "").replace(/^_(.*)_$/, "$1").trim())
    .filter(Boolean);
}
function pdfLines(packet: ConsultPacket, audience: ExportAudience, excluded = new Set<string>(), note = ""): string[] {
  return exportPrintSections(audience, packet, excluded, note, "Parent note").flatMap((s) => [s.heading, ...s.body]);
}

describe("B-CAREPRO-28 — one preset per audience across Copy and PDF", () => {
  const packet = buildConsultPacket(FIXTURE);
  const clinicianAudiences = EXPORT_AUDIENCES.filter((a) => a !== "teacher" && a !== "self");

  it("the audience step is the six choices, pediatrician first; legacy 'clinician' reads as therapist", () => {
    expect([...EXPORT_AUDIENCES]).toEqual(["pediatrician", "slp", "behavioral_health", "therapist", "teacher", "self"]);
    expect(DEFAULT_EXPORT_AUDIENCE).toBe("pediatrician");
    expect(normalizeExportAudience("clinician")).toBe("therapist");
    expect(normalizeExportAudience("nurse")).toBeNull();
  });

  it("copy text == PDF sections for each preset (and for my records), with and without redaction and a note", () => {
    for (const audience of [...clinicianAudiences, "self" as const]) {
      for (const excluded of [new Set<string>(), new Set(["about-focus", "mem-0"])]) {
        for (const note of ["", "Please ask about the countdown."]) {
          const md = serializeForExport(audience, packet, excluded, note, "Parent note");
          // The Markdown carries a document title + prepared line the print
          // shell renders itself; everything after them must match line for line.
          const copy = copyLines(md).slice(2);
          expect(copy, `${audience}`).toEqual(pdfLines(packet, audience, excluded, note));
        }
      }
    }
  });

  it("SLP → the copy carries the language-observations section; pediatrician → measurements; neither leaks into the other", () => {
    const slp = serializeForExport("slp", packet);
    const ped = serializeForExport("pediatrician", packet);
    expect(slp).toContain("Phrases we have heard");
    expect(slp).toContain("more juice");
    expect(slp).not.toContain("Measurements we have taken");
    expect(ped).toContain("Measurements we have taken");
    expect(ped).toContain("108 cm");
    expect(ped).not.toContain("Phrases we have heard");
    // behaviour/psychology carries the parent's own trigger words
    expect(serializeForExport("behavioral_health", packet)).toContain("Leaving the park");
    // NEGATIVE CONTROL: the pre-B-28 clinician copy (therapist ceiling) had neither section.
    const therapist = serializeForExport("therapist", packet);
    expect(therapist).not.toContain("Phrases we have heard");
    expect(therapist).not.toContain("Measurements we have taken");
  });

  it("every PDF honours the include-toggles the parent just reviewed", () => {
    for (const audience of [...clinicianAudiences, "self" as const]) {
      const kept = pdfLines(packet, audience).join("\n");
      expect(kept, `${audience} fixture lacks the focus line`).toContain("Current focus");
      const redacted = pdfLines(packet, audience, new Set(["about-focus"])).join("\n");
      expect(redacted, `${audience} printed an excluded row`).not.toContain("Current focus");
    }
  });

  it("the Consult screen: one PDF button, no .md Download, no menu", () => {
    const ask = readFileSync(path.join(COMPONENTS, "sections", "AskSpecialist.tsx"), "utf8").replace(/\r\n/g, "\n");
    const seam = readFileSync(path.join(COMPONENTS, "sections", "Reports.tsx"), "utf8");
    expect(ask).toContain('data-testid="consult-pdf"');
    expect((ask.match(/data-testid="consult-pdf"/g) ?? []).length).toBe(1);
    expect(ask).toMatch(/onClick=\{savePdf\} disabled=\{noneSelected\}/);
    for (const gone of ['type: "text/markdown"', "a.download", "role=\"menu\"", "menuReports", "CONSULT_MENU_REPORTS", "consult.download", "consult.exportPdf"]) {
      expect(ask, gone).not.toContain(gone);
    }
    expect(seam).not.toContain("CONSULT_MENU_REPORTS");
    // the last preset is remembered on the device under the same key
    expect(ask).toContain('const AUDIENCE_STORAGE_KEY = "arbor.consultExportAudience";');
    // the parent-record documents are never on the Consult screen
    const parentTypes = ALL_REPORT_TYPES.filter((t) => !isProfessionalReportType(t));
    expect(parentTypes).toEqual(["weekly", "snapshot", "behavior", "language", "growth"]);
  });
});

/* B-CAREPRO-23 — #/reports is "Your full record": no professional preset is
 * exportable from the page; the only professional path is the Consult door
 * (redaction, reason, questions, reviewed gate). */
describe("B-CAREPRO-23 — Reports.tsx never calls exportReport with a professional type", () => {
  const reportsSrc = readFileSync(path.join(COMPONENTS, "sections", "Reports.tsx"), "utf8").replace(/\r\n/g, "\n");
  const page = reportsSrc.slice(reportsSrc.indexOf("export default function Reports"));

  it("the page renders PARENT_RECORD_REPORTS (5 cards) and nothing from the professional list", () => {
    expect(page.length).toBeGreaterThan(1500);
    expect(reportsSrc).toMatch(/export const PARENT_RECORD_REPORTS = REPORTS\.filter\(\n\s*\(r\)[^=]*=> !isProfessionalReportType\(r\.type\)\n\);/);
    // W2-CAREPRO c2 r1: the lead saves the combined record; all five are rows.
    expect(page).toContain("{PARENT_RECORD_REPORTS.map((r) => (");
    expect(page).not.toMatch(/\{REPORTS\.map\(|CONSULT_MENU_REPORTS/);
    const parentTypes = ALL_REPORT_TYPES.filter((t) => !isProfessionalReportType(t));
    expect(parentTypes).toEqual(["weekly", "snapshot", "behavior", "language", "growth"]);
  });

  it("every exportReport call on the page takes a parent-record card's type — no literal, no professional", () => {
    const calls = [...page.matchAll(/exportReport\(([^)]*)\)/g)].map((m) => m[1].trim());
    // W2-CAREPRO c2 r1: the lead's one Save button builds the combined
    // parent record ("record" → buildFullRecord, parent documents only) + the quiet rows.
    expect(calls).toEqual(['"record"', "r.type"]);
    expect(reportsSrc).toContain('type === "record" ? buildFullRecord(ctx, uiLang) : buildReport(type, ctx, uiLang)');
    // the r it reads is the PARENT_RECORD_REPORTS iteration variable
    const loop = page.slice(page.indexOf("{PARENT_RECORD_REPORTS.map((r) => ("));
    expect(loop.indexOf("exportReport(r.type)")).toBeGreaterThan(0);
    for (const pro of ["teacher", "therapist", "pediatrician", "slp", "behavioral_health"]) {
      expect(page).not.toContain(`exportReport("${pro}"`);
    }
    // NEGATIVE CONTROL: the pre-change page iterated the full list.
    const pre = `{REPORTS.map((r) => (<button onClick={() => exportReport(r.type)}>PDF</button>))}`;
    expect(/\{REPORTS\.map\(/.test(pre)).toBe(true);
  });

  it("W2-CAREPRO r1: the stamp sits on ONE button, never a wrapper; the Consult door is outside it", () => {
    const stamps = [...page.matchAll(/data-primary-move="export-report"/g)];
    expect(stamps.length).toBe(1);
    // the element carrying the stamp is a <button>, and no display:contents wrapper carries it
    const before = page.slice(0, stamps[0].index);
    expect(before.lastIndexOf("<button")).toBeGreaterThan(before.lastIndexOf("<div"));
    expect(page).not.toMatch(/data-primary-move="export-report"[^>]*display: "contents"/);
    // the stamped button comes before the door, and the door is not inside it
    const stampAt = stamps[0].index!;
    const closeAt = page.indexOf("</button>", stampAt);
    expect(page.indexOf('data-testid="reports-consult-door"')).toBeGreaterThan(closeAt);
    // one layer of chrome: no card class inside the SectionCard
    expect(page).not.toContain("cardCls");
    // NEGATIVE CONTROL: the pre-change wrapper shape is caught
    const pre = `<div data-module="reports-catalogue" data-primary-move="export-report" style={{ display: "contents" }}>`;
    expect(/data-primary-move="export-report"[^>]*display: "contents"/.test(pre)).toBe(true);
  });

  it("one door to Consult, through the prefill seam; no teacher card", () => {
    const door = /data-testid="reports-consult-door"/.exec(page);
    expect(door).toBeTruthy();
    // B-CAREPRO-28: the door names no audience; Consult's step 1 does.
    expect(page).toMatch(/const openConsult = \(\) => \{\n\s*requestConsultPrefill\(\{\}\);\n\s*setActiveTab\("consult"\);/);
    expect(page).not.toContain("reports-teacher-one-door");
    expect(page).not.toContain('r.type === "teacher"');
  });
});
