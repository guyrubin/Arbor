/**
 * The remaining §3c Care rows: LC-22 · LC-16 · LC-28/OBJ-CARE-02 · CR-21 · MOB-20.
 *
 * Each of these is a surface that told the parent about something it could not
 * then do: four family rituals with no way to start one, a "Send to a
 * professional" verb over an empty directory (`ARBOR_PROFESSIONALS = []`), a
 * hub hero that pushed the packet to 1,320 px, a second <h1> in the chrome, and
 * a Settings panel with no version and no way to reach a human.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARBOR_PROFESSIONALS } from "../services/professionals";
import { FAMILY_RITUALS } from "./familyRituals";
import { en as careEn, he as careHe } from "./i18nElevation/careHonesty";
import { en as acctEn, he as acctHe } from "./i18nElevation/accountSettings";
import { translate } from "./i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
/** Prose about a rule must never trip the scan for that rule (this file's own
 *  first run failed on a comment reading "this was a second <h1>"). */
const stripComments = (code: string) =>
  code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (rel: string) => stripComments(readFileSync(path.join(here, "..", rel), "utf8"));
const readRoot = (rel: string) => readFileSync(path.join(here, "..", "..", rel), "utf8");

const CHARTER = read("components/sections/FamilyFormation.tsx");
const CONSULT = read("components/sections/AskSpecialist.tsx");
const CONSULT_TAB = read("components/tabs/ConsultTab.tsx");
const SIDEBAR = read("components/layout/Sidebar.tsx");
const SETTINGS = read("components/layout/SettingsModal.tsx");

describe("LC-22 · a family ritual can be started", () => {
  it("negative control: the rituals carry real first steps, so 'Start' has something to accept", () => {
    expect(FAMILY_RITUALS.length).toBeGreaterThan(0);
    for (const r of FAMILY_RITUALS) {
      expect(r.steps[0]?.trim(), `${r.id} has no first step`).toBeTruthy();
      expect(r.stepsHe[0]?.trim(), `${r.id} has no Hebrew first step`).toBeTruthy();
    }
  });

  it("Start accepts the FIRST step into today, at tiny capacity, with its own provenance", () => {
    expect(CHARTER).toContain('await acceptTodayAction(step, "tiny", "family-ritual", undefined, { awaitServer: true, isCurrent })');
    expect(CHARTER).toContain("const firstStep = (r: FamilyRitual)");
    // Idempotent: a started ritual shows as started rather than double-writing.
    expect(CHARTER).toContain('a.source === "family-ritual" && a.recommendation === firstStep(r)');
    expect(CHARTER).toContain("disabled={startPending() || ritualStarted(r)}");
  });

  it("the accordion announces its own state", () => {
    expect(CHARTER).toContain("aria-expanded={isOpen}");
    expect(CHARTER).toContain("aria-controls={`ritual-${r.id}`}");
    expect(CHARTER).toContain("id={`ritual-${r.id}`}");
  });

  it("the provenance is declared in the action-loop model, not stringly typed", () => {
    const model = read("actionLoop/model.ts");
    expect(model).toContain('"family-ritual"');
  });

  it("the copy ships in both locales (law 7)", () => {
    for (const key of ["elev.learnCare.ritual.start", "elev.learnCare.ritual.started", "elev.learnCare.ritual.added"]) {
      expect(careEn[key], `${key} EN`).toBeTruthy();
      expect(careHe[key], `${key} HE`).toMatch(/[֐-׿]/);
    }
  });
});

describe("LC-16 → B-CAREPRO-19 · no directory verb; the trusted send is the move", () => {
  it("negative control: the directory really is empty", () => {
    expect(ARBOR_PROFESSIONALS).toEqual([]);
  });

  it("the professional verb, the rail and the directory door are gone", () => {
    expect(CONSULT).not.toContain("hasDirectory");
    expect(CONSULT).not.toContain("setSendOpen");
    expect(CONSULT).not.toContain('setActiveTab("find-pro")');
  });

  it("what replaces it is a real move: the SAME audience-capped text, by mail", () => {
    expect(CONSULT).toContain('data-testid="consult-send-trusted"');
    expect(CONSULT).toContain("const sendToTrusted = () => {");
    expect(CONSULT).toContain("if (exportText == null) return;");
    expect(CONSULT).toContain("encodeURIComponent(exportText)");
    expect(careEn["elev.learnCare.trusted.send"]).toBeTruthy();
    expect(careHe["elev.learnCare.trusted.send"]).toMatch(/[\u0590-\u05FF]/);
  });
});

describe("LC-28 / OBJ-CARE-02 · the packet, not the hero", () => {
  it("W2-CAREPRO r1: no hero above the flow — the H1 is the job and step 1 sits under it", () => {
    // The HubHero's CTA only scrolled ~60 px to a row already in view (a decoy
    // primary); B-CAREPRO-36's hero part cuts it.
    expect(CONSULT_TAB).not.toContain("<HubHero");
    expect(CONSULT_TAB).toContain('data-testid="consult-h1"');
    expect(CONSULT_TAB).toContain('t("elev.consult.h1")');
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "elev.consult.h1")).not.toBe("elev.consult.h1");
      expect(translate(lang, "elev.consult.forName", { name: "Dylan" })).toContain("Dylan");
    }
    // NEGATIVE CONTROL: the pre-change leaf mounted the hero.
    expect("<HubHero compact zeroLine={t(\"x\")} />").toContain("<HubHero");
  });

  it("W2-CAREPRO r2: the stamp lands on a REAL act (Build the summary / the inline brief's Save as PDF), never a chip or the flow wrapper", () => {
    const stampLines = CONSULT_TAB.split("\n").filter((l) => /\bdata-primary-move\b/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
    expect(stampLines).toHaveLength(1);
    expect(stampLines[0]).toContain("const primaryMoveStamp = {");
    expect(CONSULT_TAB).toContain("primaryMoveStamp={primaryMoveStamp}");
    expect(CONSULT_TAB).not.toMatch(/data-module="consult-packet"[^>]*data-primary-move/);
    // r1's chip stamp is gone (its click was a no-op on the selected chip)
    expect(CONSULT).not.toContain("{...(on ? primaryMoveStamp : undefined)}");
    // the build button carries it and acts (scrolls + focuses step 3)
    expect(CONSULT).toMatch(/data-testid="consult-build"\s+onClick=\{buildSummary\}\s+\{\.\.\.primaryMoveStamp\}/);
    expect(CONSULT).toMatch(/const buildSummary = \(\) => \{[\s\S]*?scrollIntoView[\s\S]*?focus/);
    // B-CAREPRO-36: the teacher branch's act is the inline brief's "Save as
    // PDF" — the route's stamp VALUE is handed to the editor, which spreads it
    // on that button (one stamp in the DOM; the old "Open" door is gone).
    expect(CONSULT).toContain('<SchoolBrief embedded teacherNote={visionNote} primaryMove={primaryMoveStamp?.["data-primary-move"]} egressGuard={egressGuard} />');
    expect(CONSULT).not.toContain('data-testid="consult-teacher-open"');
    const BRIEF = read("components/sections/SchoolBrief.tsx");
    expect(BRIEF).toContain('const primaryMove = { "data-primary-move": routeMove ?? "build-school-brief" };');
    expect((BRIEF.match(/\{\.\.\.primaryMove\}/g) ?? []).length).toBe(1);
    expect(BRIEF).toMatch(/<button\s+\{\.\.\.primaryMove\}\s+data-testid="school-brief-review-open"\s+onClick=\{openReview\}/);
    expect(BRIEF).toContain("onClick={onApprove}");
    const openReview = BRIEF.slice(BRIEF.indexOf("const openReview ="), BRIEF.indexOf("const [editing"));
    expect(openReview).toContain("if (!egress.isCurrent() || latestReviewContext.current !== reviewContext) return;");
    expect(openReview).not.toContain("openPrintableReport");
  });

  it("B-CAREPRO-36: #/school-brief renders this page with the teacher preselected (the route stays live)", () => {
    expect(CONSULT_TAB).toContain('const routeAudience: ExportAudience | undefined = activeTab === "school-brief" ? "teacher" : undefined;');
    expect(CONSULT_TAB).toContain("anchorAudience={presetAudience}");
    expect(CONSULT_TAB).toMatch(/activeTab === "school-brief" \? "build-school-brief"/);
    const SHELL = read("components/layout/Shell.tsx").replace(/\r\n/g, "\n");
    expect(SHELL).toMatch(/^\s*"school-brief": ConsultTab,$/m);
    expect(SHELL).not.toContain('import("../sections/SchoolBrief")');
    // NEGATIVE CONTROL: the pre-change registry seat is what this rejects
    expect('  "school-brief": SchoolBriefSection, // AP-056').not.toMatch(/^\s*"school-brief": ConsultTab,$/m);
  });

  it("the audience row is focusable and scroll-anchored", () => {
    expect(CONSULT).toContain('id="consult-audience-row"');
    expect(CONSULT).toContain("tabIndex={-1}");
    expect(CONSULT).toContain('scrollMarginBlockStart: "0.75rem"');
  });

  it("the route carries ONE h1 (CR-21): the packet section uses a subordinate heading", () => {
    expect(CONSULT).toContain('{t("care.packet.title")}');
    expect(CONSULT).not.toMatch(/<h1[\s>]/);
  });
});

describe("CR-21 · the sidebar wordmark is not a page heading", () => {
  it("Sidebar renders <p>Arbor</p>, not <h1>", () => {
    expect(SIDEBAR).toContain(">Arbor</p>");
    expect(SIDEBAR).not.toMatch(/<h1[\s>]/);
  });

  it("negative control: the pre-fix markup is what the scan rejects", () => {
    const PRE_FIX = '<h1 className="text-[21px] font-extrabold leading-none">Arbor</h1>';
    expect(/<h1[\s>]/.test(PRE_FIX)).toBe(true);
  });
});

describe("MOB-20 · Settings says which Arbor this is, and how to reach one", () => {
  it("the About row reads the stamped build (B-INF-05), not the manifest's 0.0.0", () => {
    expect(SETTINGS).toContain('import { APP_BUILD } from "../../lib/buildVersion";');
    expect(SETTINGS).toContain("{ version: APP_BUILD }");
    expect(SETTINGS).not.toContain("metadata.version");
  });

  it("the support link is the address the app already gives, not a new one", () => {
    expect(SETTINGS).toContain('href="mailto:hello@arbor.app"');
    expect(read("lib/i18n.ts")).toContain("hello@arbor.app");
    expect(SETTINGS).toContain('data-testid="settings-support-link"');
    expect(SETTINGS).toContain("min-h-11");
  });

  it("the About copy ships in both locales (law 7)", () => {
    for (const key of ["elev.accountSettings.about.title", "elev.accountSettings.about.sub", "elev.accountSettings.about.contact"]) {
      expect(acctEn[key], `${key} EN`).toBeTruthy();
      expect(acctHe[key], `${key} HE`).toMatch(/[֐-׿]/);
    }
    expect(acctEn["elev.accountSettings.about.sub"]).toContain("{version}");
    expect(acctHe["elev.accountSettings.about.sub"]).toContain("{version}");
  });
});
