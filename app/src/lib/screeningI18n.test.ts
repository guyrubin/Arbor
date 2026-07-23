import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { en, he } from "./i18n";
import { AGE_BANDS, DOMAIN_LABEL } from "./screening";

/**
 * UND-1 — Development Check localization (P0 HE/EN parity on the highest-trust
 * clinical surface).
 *
 * Guards two things:
 *  1) COVERAGE — every item-bank prompt, age-band label and screened domain has
 *     a `screen.*` key in BOTH dictionaries (EN mirrors the canonical bank in
 *     lib/screening.ts), so a new/renamed item cannot ship English-only.
 *  2) SOURCE — the check-flow surfaces (Screening.tsx, ScreeningSheet.tsx) and
 *     the MilestonesTab observation buttons carry none of the previously
 *     hardcoded English literals, and the firewall-banned calm-verdict phrasing
 *     ("on-track" class) never returns to the flow. The i18n VALUE scan lives in
 *     clinicalFirewall.wave3.test.ts (extended to all screen-prefixed keys).
 */

const SRC_ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");

describe("UND-1 — Development Check i18n coverage (HE/EN parity)", () => {
  it("every item-bank prompt has screen.item.<id> in BOTH languages (EN mirrors the bank)", () => {
    for (const band of AGE_BANDS) {
      for (const item of band.items) {
        const key = `screen.item.${item.id}`;
        expect(en[key], `missing EN key ${key}`).toBeTruthy();
        expect(he[key], `missing HE key ${key}`).toBeTruthy();
        expect(en[key], `EN ${key} drifted from the canonical prompt in lib/screening.ts`).toBe(item.prompt);
      }
    }
  });

  it("every age band has screen.band.<id> in BOTH languages (EN mirrors the bank)", () => {
    for (const band of AGE_BANDS) {
      const key = `screen.band.${band.id}`;
      expect(en[key], `missing EN key ${key}`).toBe(band.label);
      expect(he[key], `missing HE key ${key}`).toBeTruthy();
    }
  });

  it("every screened domain has screen.domain.<id> in BOTH languages (EN mirrors DOMAIN_LABEL)", () => {
    for (const [id, label] of Object.entries(DOMAIN_LABEL)) {
      const key = `screen.domain.${id}`;
      expect(en[key], `missing EN key ${key}`).toBe(label);
      expect(he[key], `missing HE key ${key}`).toBeTruthy();
    }
  });
});

describe("UND-1 — the check flow renders no hardcoded English literal", () => {
  // Every UI literal the localization pass moved into i18n. If one reappears in
  // the source, a Hebrew parent gets a half-translated clinical screener again.
  const MOVED_LITERALS = [
    "Start the check",
    "See result",
    "A few areas worth a conversation",
    "Worth a conversation",
    "Prepare a professional summary",
    "Find a professional",
    "View last result",
    "Your next step",
    "Arbor is not a medical device",
    "quick questions about everyday things",
    "loss of skills your child already had",
    "area(s) flagged",
    "Opening a provider-ready summary",
  ];
  const FLOW_SURFACES = [
    "components/sections/Screening.tsx",
    "components/sections/ScreeningSheet.tsx",
  ];

  for (const rel of FLOW_SURFACES) {
    it(`${rel} carries none of the moved UI literals`, () => {
      const code = stripComments(read(rel));
      for (const lit of MOVED_LITERALS) {
        expect(code, `${rel} still hardcodes "${lit}"`).not.toContain(lit);
      }
    });
  }

  it("the banned calm-verdict phrasing never returns to the flow (firewall condition)", () => {
    const banned = /\bon[\s-]?track\b/i;
    for (const rel of FLOW_SURFACES) {
      expect(stripComments(read(rel)), `${rel} renders a verdict literal`).not.toMatch(banned);
    }
    // The replacement result keys are observational, in both languages.
    for (const key of ["screen.result.title.calm", "screen.chip.calm", "screen.last.calm"]) {
      expect(en[key], `missing EN key ${key}`).toBeTruthy();
      expect(he[key], `missing HE key ${key}`).toBeTruthy();
      expect(en[key], `EN ${key} regressed to a verdict register`).not.toMatch(banned);
    }
  });

  it("MilestonesTab observation buttons resolve through i18n keys (no inline uiLang ternaries)", () => {
    const code = read("components/tabs/MilestonesTab.tsx");
    expect(code, "inline HE ternary returned for the Yes label").not.toContain('uiLang === "he" ? "כן"');
    expect(code, "aria prompt is hardcoded again").not.toContain("What have you noticed?");
    expect(code, "not-sure hint is hardcoded again").not.toContain("There is no need to test or push.");
    for (const key of ["ms.observePrompt", "ms.observe.yes", "ms.observe.notSure", "ms.observe.notYet", "ms.observeNotSureHint"]) {
      expect(en[key], `missing EN key ${key}`).toBeTruthy();
      expect(he[key], `missing HE key ${key}`).toBeTruthy();
    }
  });
});
