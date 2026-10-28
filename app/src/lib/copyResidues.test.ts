import { describe, expect, it } from "vitest";
import { en, translate } from "./i18n";
import { elevationEn } from "./i18nElevation";
import { PARENT_RECORD_COPY } from "../components/companion/parentRecordCopy";
import { resolvePlural } from "../context/LanguageContext";
import { referralEarnedCopy } from "../components/referral/InviteCard";

/* B-SHELL-43 — the five copy residues from the 10 Oct review, each pinned in
   both languages so a later edit cannot quietly bring one back. */

const t = (lang: "en" | "he", key: string, vars?: Record<string, string | number>) =>
  resolvePlural(lang, translate(lang, key, vars), vars).replace(/[⁦-⁩]/g, "");

describe("B-SHELL-43 · copy residues", () => {
  it("the watch row's action reads 'review', not 'update', in Hebrew", () => {
    expect(PARENT_RECORD_COPY.en.reviewObservation).toBe("Review observation");
    expect(PARENT_RECORD_COPY.he.reviewObservation).toBe("לעבור על התצפית");
    expect(PARENT_RECORD_COPY.he.reviewObservation).not.toContain("לעדכן");
  });

  it("the Firsts filter is the natural Hebrew plural of the capture chip's 'פעם ראשונה'", () => {
    expect(t("en", "kept.filter.first")).toBe("Firsts");
    expect(t("he", "kept.filter.first")).toBe("פעמים ראשונות");
    expect(t("he", "kept.capture.first")).toBe("פעם ראשונה");
  });

  it("every Hebrew 'saving…' line speaks in the app's one plural voice", () => {
    for (const key of ["coach.doc.saving", "plan.card.submitting", "companion.input.keeping"]) {
      expect(t("he", key), key).toBe("שומרים…");
    }
    // Ratchet over the whole merged dictionary: no singular "שומר…" anywhere.
    const keys = new Set([...Object.keys(en), ...Object.keys(elevationEn)]);
    const singular = [...keys].filter((key) => /(^|\s)שומר(…|\.\.\.)/.test(translate("he", key)));
    expect(singular).toEqual([]);
  });

  it("the keep-as hint never asks the parent to clear their own words", () => {
    const enLine = t("en", "kept.capture.ownNote");
    const heLine = t("he", "kept.capture.ownNote");
    expect(enLine).not.toMatch(/clear|your own/i);
    expect(heLine).not.toMatch(/למחוק|במילים שלכם/);
    expect(enLine).toMatch(/type it in this box/);
    expect(heLine).toMatch(/להקליד/);
  });
});

describe("B-SHELL-43 · the referral line handles 0, 1 and n", () => {
  const line = (lang: "en" | "he", n: number) => {
    const copy = referralEarnedCopy(n);
    return copy ? t(lang, copy.key, copy.vars) : null;
  };

  it("zero says nothing (no '0 free month(s)')", () => {
    expect(referralEarnedCopy(0)).toBeNull();
    expect(referralEarnedCopy(-2)).toBeNull();
    expect(referralEarnedCopy(Number.NaN)).toBeNull();
  });

  it("one has its own sentence in both languages", () => {
    expect(line("en", 1)).toBe("You've earned one free month");
    expect(line("he", 1)).toBe("צברתם חודש חינם אחד");
  });

  it("many resolves the English suffix through the plural helper; Hebrew carries no token", () => {
    expect(line("en", 2)).toBe("You've earned 2 free months");
    expect(line("en", 5)).toBe("You've earned 5 free months");
    expect(line("he", 3)).toBe("צברתם 3 חודשי חינם");
    for (const lang of ["en", "he"] as const) {
      for (const n of [1, 2, 7]) expect(line(lang, n)).not.toMatch(/\(s\)|\{|\}/);
    }
  });

  it("NEGATIVE CONTROL — the old key shape printed the defect", () => {
    expect("You've earned {count} free month(s)".replace("{count}", "0")).toContain("0 free month(s)");
  });
});
