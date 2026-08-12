import { describe, expect, it } from "vitest";
import { childsignalsText, en, he, withChildSignals } from "./childsignals";
import type { ChildActivityType } from "../signalTimeline";

/**
 * childsignals module guard — EN/HE parity, key-shape completeness for every
 * child-activity type, interpolation contract, and the clinical firewall on
 * the strings themselves (counts + events only; no %, verdicts, or
 * period-vs-period comparison words).
 */

const ACTIVITY_TYPES: ChildActivityType[] = ["practice", "speech", "mimic", "adventure", "mission", "hero"];

describe("i18nElevation/childsignals", () => {
  it("keeps EN and HE key sets identical and elev.childsignals.* namespaced", () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en)) {
      expect(key.startsWith("elev.childsignals."), `${key} escapes the module namespace`).toBe(true);
    }
  });

  it("carries a count-aware title pair for every child-activity type", () => {
    for (const type of ACTIVITY_TYPES) {
      for (const dict of [en, he]) {
        expect(dict[`elev.childsignals.title.${type}.one`], `${type}.one missing`).toBeTruthy();
        const many = dict[`elev.childsignals.title.${type}.many`];
        expect(many, `${type}.many missing`).toBeTruthy();
        expect(many).toContain("{count}");
      }
    }
  });

  it("interpolates {var}s and falls back key→en→key (same contract as t())", () => {
    expect(childsignalsText("elev.childsignals.title.speech.many", false, { count: 2 }))
      .toBe("Completed 2 speech practice rounds");
    expect(childsignalsText("elev.childsignals.title.speech.many", true, { count: 2 }))
      .toBe("הושלמו 2 סבבי תרגול דיבור");
    // Missing key → the key itself (app-wide convention).
    expect(childsignalsText("elev.childsignals.nope", false)).toBe("elev.childsignals.nope");
    // Missing var → left as-is.
    expect(childsignalsText("elev.childsignals.months.by", false, { month: "March" }))
      .toBe("By March: {count} moments in the story");
  });

  it("withChildSignals routes module keys locally and everything else to t()", () => {
    const base = (key: string) => `[base:${key}]`;
    const tt = withChildSignals(base, false);
    expect(tt("elev.childsignals.kind")).toBe("Practice");
    expect(tt("timeline.title.observed")).toBe("[base:timeline.title.observed]");
  });

  it("FIREWALL: no percentage, verdict, or comparison framing in any string", () => {
    const banned = [
      /%/,
      /\bfaster\b/i, /\bslower\b/i,
      /\bmore than\b/i, /\bless than\b/i, /\bfewer than\b/i,
      /\bimproved\b/i, /\bdeclined\b/i, /\bbehind\b/i, /\bahead\b/i,
      /\bvs\.?\b/i, /לעומת/, /יותר מ/, /פחות מ/, /מהר יותר/,
    ];
    for (const dict of [en, he]) {
      for (const [key, value] of Object.entries(dict)) {
        for (const pat of banned) {
          expect(value, `${key} carries comparison/verdict framing (${pat})`).not.toMatch(pat);
        }
      }
    }
  });
});
