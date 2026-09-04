/**
 * LC-11 mount guard — the School Brief surface.
 *
 * The pure rules (curated ceiling, the parent-only escalation note, print
 * sections) are proven in src/schoolBrief/schoolBrief.test.ts. This file proves
 * the SURFACE uses them: the export is a real document, the escalation note is
 * rendered to the parent, the language reaches the generation seam, and the
 * Consult menu no longer mints a rival teacher document.
 *
 * Scan discipline: \r\n normalised first, extractions asserted toBeTruthy(),
 * and every rule carries a negative control against the pre-change source.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

const brief = read("components/sections/SchoolBrief.tsx");
const consult = read("components/sections/AskSpecialist.tsx");

/** The pre-change export path and generation call, verbatim from the audit. */
const PRE_BRIEF = `
      const data = await api.generateBrief({
        childProfile,
        logs: behaviorLogs,
        milestones,
        audience: "teacher",
      });
      const md = serializeSchoolBrief(ex, sectionLabels);
      const blob = new Blob([md], { type: "text/markdown" });
      const a = document.createElement("a");
      a.download = \`\${firstName}-school-handoff-\${ex.date}.md\`;
      a.click();
`.replace(/\r\n/g, "\n");

/** The pre-change Consult export menu handler. */
const PRE_CONSULT = `
  const runExport = (type: typeof REPORTS[number]["type"]) => {
    setMenuOpen(false);
    menuTriggerRef.current?.focus();
    toast(t("consult.opening"), "info");
    try { exportReport(type, excluded); }
    catch { toast(t("consult.exportError"), "error"); }
  };
`.replace(/\r\n/g, "\n");

describe("LC-11 · the teacher receives a document, not a Markdown file", () => {
  it("the sources were really read", () => {
    expect(brief.length).toBeGreaterThan(2000);
    expect(brief).toContain("export default function SchoolBrief");
    expect(consult).toContain("export default function AskSpecialist");
  });

  it("the approved brief goes through the shared, native-aware print egress", () => {
    expect(/openPrintableReport\(/.exec(brief)).toBeTruthy();
    expect(/schoolBriefToPrintSections\(/.exec(brief)).toBeTruthy();
    expect(/openPrintableReport/.exec(PRE_BRIEF)).toBeNull();
  });

  it("the .md blob download is gone", () => {
    expect(brief).not.toContain('type: "text/markdown"');
    expect(brief).not.toContain("-school-handoff-");
    expect(PRE_BRIEF).toContain('type: "text/markdown"');
  });

  it("the parent's language reaches the generation seam", () => {
    const call = /api\.generateBrief\(\{[\s\S]*?\}\)/.exec(brief);
    expect(call).toBeTruthy();
    expect(call![0]).toMatch(/language:\s*uiLang === "he" \? "he" : "en"/);
    expect(/language:/.exec(PRE_BRIEF)).toBeNull();
  });
});

describe("LC-11 · the escalation note reaches the parent (the serious half)", () => {
  it("the note renders in its own parent-only card", () => {
    expect(/data-testid="school-brief-escalation"/.exec(brief)).toBeTruthy();
    expect(/parentEscalationNote\(draft\)/.exec(brief)).toBeTruthy();
    expect(/data-testid="school-brief-escalation"/.exec(PRE_BRIEF)).toBeNull();
  });

  it("the card is labelled as NOT part of the teacher's copy, and routes to Safety", () => {
    const card = /data-testid="school-brief-escalation"[\s\S]*?<\/section>/.exec(brief);
    expect(card).toBeTruthy();
    expect(card![0]).toContain("elev.learnCare.brief.escalation.title");
    expect(card![0]).toContain("elev.learnCare.brief.escalation.body");
    expect(card![0]).toContain('setActiveTab("safety")');
  });

  it("the export path asserts the note cannot leak (fail closed at the seam)", () => {
    expect(/assertEscalationNoteNotExported\(/.exec(brief)).toBeTruthy();
    expect(/assertEscalationNoteNotExported/.exec(PRE_BRIEF)).toBeNull();
  });
});

/* ── LC-11b — "one teacher document, one door", checked against EVERY door ──
 *
 * This suite used to scan ONE named file (AskSpecialist.tsx) and conclude the
 * claim held. It did not: the Reports page (#/reports is a live route) still
 * rendered a "Teacher Handoff" card whose button ran the preset PDF path —
 * with no per-export approval, no CURATED_FIELDS allowlist, no
 * `assertEscalationNoteNotExported`, no parent review of AI-edited fields. The
 * scan passed while the open door was the UNGATED one.
 *
 * So the rule is now applied to every file that can REACH a teacher export,
 * discovered by walking the tree rather than by naming files. A new component
 * that consumes the export seam without routing the teacher type fails here. */

const reports = read("components/sections/Reports.tsx");

/** Every non-test source file, walked (not listed). */
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const SOURCES = walk(SRC)
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => ({ rel: path.relative(SRC, f).replace(/\\/g, "/"), src: readFileSync(f, "utf8").replace(/\r\n/g, "\n") }));

/** A file can reach a teacher export if it consumes the export seam or builds
 *  a preset packet itself. `consult/packet.ts` DEFINES those functions — it is
 *  the policy module, not a door. */
const TEACHER_REACHERS = SOURCES.filter(
  (f) =>
    f.rel !== "consult/packet.ts" &&
    (/useReportExport\(\)/.test(f.src) || /buildPresetPacket\(/.test(f.src) || /presetPacketToPrintSections\(/.test(f.src))
);

/** The rule every door must satisfy: it recognises the teacher type and sends
 *  it to the School Brief instead of minting a rival teacher document. */
const routesTeacherToSchoolBrief = (src: string): boolean =>
  /type === "teacher"/.test(src) && /setActiveTab\("school-brief"\)/.test(src);

/** The pre-change Reports card: every report type exported unconditionally. */
const PRE_REPORTS_CARD = `
              <button
                onClick={() => exportReport(r.type)}
                className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2.5 py-1.5 transition hover:brightness-95"
                aria-label={\`Export \${r.title} as PDF\`}
              >
                <Icon name="download" size={14} /> PDF
              </button>
`.replace(/\r\n/g, "\n");

/** A plausible NEW component reaching the seam without routing the teacher. */
const HYPOTHETICAL_NEW_DOOR = `
  const exportReport = useReportExport();
  return <button onClick={() => exportReport("teacher")}>Teacher handoff</button>;
`;

describe("LC-11b · one teacher door — every door, not one named file", () => {
  it("the sweep really found the doors (non-vacuity)", () => {
    expect(SOURCES.length).toBeGreaterThan(100);
    const rels = TEACHER_REACHERS.map((f) => f.rel);
    expect(rels).toContain("components/sections/Reports.tsx");
    expect(rels).toContain("components/sections/AskSpecialist.tsx");
    expect(TEACHER_REACHERS.length).toBeGreaterThanOrEqual(2);
  });

  it("EVERY file that can reach a teacher export routes it to the School Brief", () => {
    for (const file of TEACHER_REACHERS) {
      expect(routesTeacherToSchoolBrief(file.src), `${file.rel} can export a teacher document without routing to the School Brief`).toBe(true);
    }
  });

  it("NEGATIVE CONTROL: the pre-change card, and any new door, fail the same rule", () => {
    expect(routesTeacherToSchoolBrief(PRE_CONSULT)).toBe(false);
    expect(routesTeacherToSchoolBrief(PRE_REPORTS_CARD)).toBe(false);
    expect(routesTeacherToSchoolBrief(HYPOTHETICAL_NEW_DOOR)).toBe(false);
  });

  it("the Consult menu's teacher item opens the School Brief instead of a rival document", () => {
    const branch = /if \(type === "teacher"\)[\s\S]{0,300}?\n    \}/.exec(consult);
    expect(branch).toBeTruthy();
    expect(branch![0]).toContain('setActiveTab("school-brief")');
    expect(branch![0]).toContain("return;");
    expect(/type === "teacher"/.exec(PRE_CONSULT)).toBeNull();
  });

  it("the Reports page's Teacher Handoff card opens the School Brief, not the ungated PDF", () => {
    expect(reports.length).toBeGreaterThan(2000);
    expect(reports).toContain("export default function Reports");
    expect(/data-testid="reports-teacher-one-door"/.exec(reports)).toBeTruthy();
    const card = /r\.type === "teacher" \? \([\s\S]{0,900}?\) : \(/.exec(reports);
    expect(card).toBeTruthy();
    expect(card![0]).toContain("openTeacherDoor");
    expect(card![0]).not.toContain("exportReport(r.type)");
    // NEGATIVE CONTROL: the pre-change card had no teacher branch at all.
    expect(/r\.type === "teacher"/.exec(PRE_REPORTS_CARD)).toBeNull();
  });

  it("the export SEAM itself refuses the teacher type, before any packet is built", () => {
    // Defence in depth: the redirect lives in useReportExport, so a caller
    // that forgets it still cannot mint the rival document.
    const hook = reports.slice(reports.indexOf("export function useReportExport"));
    const redirect = hook.indexOf('if (type === "teacher")');
    const build = hook.indexOf("buildPresetPacket(");
    expect(redirect).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(-1);
    expect(redirect).toBeLessThan(build);
    expect(hook.slice(redirect, build)).toContain('setActiveTab("school-brief")');
  });
});
