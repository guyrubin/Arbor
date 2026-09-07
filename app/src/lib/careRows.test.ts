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
const FINDPRO = read("components/sections/FindProfessional.tsx");
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
    expect(CHARTER).toContain('acceptTodayAction(step, "tiny", "family-ritual")');
    expect(CHARTER).toContain("const firstStep = (r: FamilyRitual)");
    // Idempotent: a started ritual shows as started rather than double-writing.
    expect(CHARTER).toContain('a.source === "family-ritual" && a.recommendation === firstStep(r)');
    expect(CHARTER).toContain("disabled={ritualStarted(r)}");
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

describe("LC-16 · no verb over an empty directory", () => {
  it("negative control: the directory really is empty", () => {
    expect(ARBOR_PROFESSIONALS).toEqual([]);
  });

  it("the professional verb and the rail door are conditional on a directory", () => {
    expect(CONSULT).toContain("const hasDirectory = pros.length > 0;");
    expect(CONSULT).toContain("onClick={hasDirectory ? () => setSendOpen(true) : sendToTrusted}");
    expect(CONSULT).toContain("{hasDirectory && (");
    // …and both come back automatically the moment there is one entry.
    expect(CONSULT).not.toContain('<button\n                onClick={() => setSendOpen(true)}\n                disabled={noneSelected}\n                className');
  });

  it("what replaces it is a real move: the SAME audience-capped text, by mail", () => {
    expect(CONSULT).toContain('data-testid={hasDirectory ? "consult-send-pro" : "consult-send-trusted"}');
    expect(CONSULT).toContain("const sendToTrusted = () => {");
    expect(CONSULT).toContain("if (exportText == null) return;");
    expect(CONSULT).toContain("encodeURIComponent(exportText)");
    expect(careEn["elev.learnCare.trusted.send"]).toBeTruthy();
    expect(careHe["elev.learnCare.trusted.send"]).toMatch(/[֐-׿]/);
  });

  it("FindProfessional withholds its search and filters until there is something to search", () => {
    expect(FINDPRO).toContain("{pros.length > 0 && (");
    // The empty state itself stays — it is the honest thing on the page.
    expect(FINDPRO).toContain('t("elev.careNet.empty.title")');
  });
});

describe("LC-28 / OBJ-CARE-02 · the packet, not the hero", () => {
  it("the hub CTA targets the export bar's audience row and moves focus there", () => {
    expect(CONSULT_TAB).toContain('document.getElementById("consult-audience-row")');
    expect(CONSULT_TAB).toContain("target?.focus?.({ preventScroll: true })");
    // It falls back to the flow when the bar is not mounted (day-0 empty state).
    expect(CONSULT_TAB).toContain("?? flowRef.current");
  });

  it("the audience row is focusable and scroll-anchored", () => {
    expect(CONSULT).toContain('id="consult-audience-row"');
    expect(CONSULT).toContain("tabIndex={-1}");
    expect(CONSULT).toContain('scrollMarginBlockStart: "0.75rem"');
  });

  it("the route carries ONE h1 (CR-21): the consult section heading is an h2", () => {
    expect(CONSULT).toContain('{t("consult.title")}');
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
  it("the About row reads the declared version from the app manifest", () => {
    expect(SETTINGS).toContain('import metadata from "../../../metadata.json";');
    expect(SETTINGS).toContain("{ version: metadata.version }");
    const manifest = JSON.parse(readRoot("metadata.json")) as { version?: string };
    expect(manifest.version, "metadata.json declares no version").toBeTruthy();
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
