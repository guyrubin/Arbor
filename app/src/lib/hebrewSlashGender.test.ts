/**
 * W2-GROWTH r2 (Law 8) — the catalogue's Hebrew slash forms resolve to ONE
 * form by the child's profile gender (lib/hebrewSlashGender). The house rule:
 * "Hebrew takes the verb's gender from the profile — never a slash"
 * (practiceDoors.copy.test.ts).
 */
import { describe, expect, it } from "vitest";
import { resolveHebrewSlash } from "./hebrewSlashGender";
import { HE_MILESTONE_TEXT } from "./i18nElevation/milestoneCatalogue";
import { milestoneText } from "./milestoneData";
import { translate } from "./i18n";

const SLASH = /[א-ת]\/[א-ת]/;

describe("resolveHebrewSlash", () => {
  it("every catalogue string resolves with no slash, for a girl, a boy and no gender", () => {
    let scanned = 0;
    for (const row of Object.values(HE_MILESTONE_TEXT)) {
      for (const s of row) {
        if (!SLASH.test(s)) continue;
        scanned++;
        for (const g of ["girl", "boy", undefined, "other"]) {
          const out = resolveHebrewSlash(s, g);
          expect(out, `${g}: ${s}`).not.toMatch(SLASH);
        }
      }
    }
    // the catalogue really carries the forms this resolves (≥100 strings on 5 Oct)
    expect(scanned).toBeGreaterThan(100);
  });

  it("feminine: suffix + medial final letter; pronoun ו/ה; whole-word alternatives", () => {
    const g = (s: string) => resolveHebrewSlash(s, "girl");
    expect(g("נרגע/ת")).toBe("נרגעת");
    expect(g("שם/ה לב")).toBe("שמה לב");
    expect(g("קופץ/ת")).toBe("קופצת");
    expect(g("מבין/ה")).toBe("מבינה");
    expect(g("מחייך/ת")).toBe("מחייכת");
    expect(g("מנופף/ת")).toBe("מנופפת");
    expect(g("אותו/ה.")).toBe("אותה.");
    expect(g("לעצמו/ה")).toBe("לעצמה");
    expect(g("שלו/ה")).toBe("שלה");
    expect(g("איש/אשת")).toBe("אשת");
    expect(g("גיבור/ת-על.")).toBe("גיבורת-על.");
    expect(g("ותסגור/י")).toBe("ותסגרי");
  });

  it("masculine (boy, or no gender on file): the base form", () => {
    for (const gender of ["boy", undefined, null]) {
      expect(resolveHebrewSlash("נרגע/ת אחרי שאתם הולכים", gender)).toBe("נרגע אחרי שאתם הולכים");
      expect(resolveHebrewSlash("אותו/ה.", gender)).toBe("אותו.");
      expect(resolveHebrewSlash("איש/אשת", gender)).toBe("איש");
    }
  });

  it("Latin pairs and plain text are untouched", () => {
    expect(resolveHebrewSlash("CDC/AAP", "girl")).toBe("CDC/AAP");
    expect(resolveHebrewSlash("Calms after you leave", "girl")).toBe("Calms after you leave");
  });

  it("milestoneText resolves only when the caller passes the profile gender", () => {
    const t = (k: string, v?: Record<string, string | number>) => translate("he", k, v);
    const m = { id: "cdc-36m-1", title: "Calms after you leave" };
    expect(milestoneText(m, "title", t)).toMatch(SLASH); // negative control: the raw seam
    expect(milestoneText(m, "title", t, { gender: "girl" })).toBe("נרגעת אחרי שאתם הולכים");
    expect(milestoneText(m, "title", t, { gender: "boy" })).toBe("נרגע אחרי שאתם הולכים");
  });
});
