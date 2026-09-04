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
import { readFileSync } from "node:fs";
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

describe("LC-11 · one teacher door", () => {
  it("the Consult menu's teacher item opens the School Brief instead of a rival document", () => {
    const branch = /if \(type === "teacher"\)[\s\S]{0,300}?\n    \}/.exec(consult);
    expect(branch).toBeTruthy();
    expect(branch![0]).toContain('setActiveTab("school-brief")');
    expect(branch![0]).toContain("return;");
    expect(/type === "teacher"/.exec(PRE_CONSULT)).toBeNull();
  });
});
