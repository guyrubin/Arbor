/**
 * N1-06 guard — the name-free template set.
 *
 * critic-vision BLOCK #3: a notification payload may never carry a child's
 * name, a behaviour pattern, or a streak. The failure mode this guard exists to
 * catch is not a careless string — it is REUSE: `lib/jitai.ts` `nextNudge`
 * already produces copy whose `vars` hold the child's first name, and the first
 * out-of-app channel that reaches for that copy breaches the block on its first
 * fire. So the negative control below is not a fixture someone invented; it is
 * the LIVE output of `nextNudge`, asserted to fail the same scan the templates
 * pass.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  NUDGE_TEMPLATES,
  NUDGE_TEMPLATE_KEYS,
  templateFor,
  type NudgeTemplate,
} from "./nudgeTemplates";
import { en, he } from "../lib/i18nElevation/returnhooks";
import { nextNudge } from "../lib/jitai";
import type { RhythmPrediction } from "../rhythm/predict";

/** Any interpolation token at all. The item's scan, character for character. */
const INTERPOLATION = /\{name\}|\{\{|\$\{/;

const KINDS = ["prep", "calm", "bedtime", "log", "practice"] as const;

const baseRhythm = (over: Partial<RhythmPrediction> = {}): RhythmPrediction => ({
  confidence: "low",
  daysObserved: 2,
  daysNeeded: 5,
  bands: [],
  frictionPeak: null,
  calmWindow: null,
  windDownHour: null,
  ...over,
});

describe("N1-06 — the template record has no vars field, at type level and at runtime", () => {
  it("TYPE LEVEL: `vars` is not a key of NudgeTemplate", () => {
    // If someone adds a `vars` field to NudgeTemplate this assignment stops
    // compiling, so `npm run lint` fails before any test runs.
    type HasVars = "vars" extends keyof NudgeTemplate ? true : false;
    const hasVars: HasVars = false;
    expect(hasVars).toBe(false);

    // And the shape is exactly the two keys — nothing else to populate.
    type Keys = keyof NudgeTemplate;
    const keys: Keys[] = ["titleKey", "bodyKey"];
    expect(keys).toHaveLength(2);
  });

  it("RUNTIME: no template object carries a vars key or any third field", () => {
    for (const kind of KINDS) {
      const tpl = NUDGE_TEMPLATES[kind];
      expect(Object.keys(tpl).sort()).toEqual(["bodyKey", "titleKey"]);
      expect("vars" in tpl).toBe(false);
    }
  });

  it("coverage is TOTAL — every kind jitai can emit has a template", () => {
    for (const kind of KINDS) {
      expect(templateFor(kind)).toBeDefined();
      expect(templateFor(kind).titleKey).toMatch(/^elev\.rh\.nudge\./);
    }
    expect(Object.keys(NUDGE_TEMPLATES).sort()).toEqual([...KINDS].sort());
  });
});

describe("N1-06 — every template string, in both locales, is name-free", () => {
  it("EN: no interpolation token in any template string", () => {
    expect(NUDGE_TEMPLATE_KEYS.length).toBe(10);
    for (const key of NUDGE_TEMPLATE_KEYS) {
      const value = en[key];
      expect(value, `missing EN copy for ${key}`).toBeTruthy();
      expect(value, `${key} carries an interpolation token`).not.toMatch(INTERPOLATION);
    }
  });

  it("HE: transcreated, present, and equally name-free", () => {
    for (const key of NUDGE_TEMPLATE_KEYS) {
      const value = he[key];
      expect(value, `missing HE copy for ${key}`).toBeTruthy();
      expect(value, `${key} carries an interpolation token`).not.toMatch(INTERPOLATION);
      // Transcreated, not an English string left in place.
      expect(value, `${key} is not Hebrew`).toMatch(/[֐-׿]/);
      expect(value).not.toBe(en[key]);
    }
  });

  it("no template string carries a streak, a count, or a pressure word", () => {
    // Law 3 read across to the notification payload: nothing that pressures,
    // nothing that grades, nothing that counts a child.
    const banned = /streak|day in a row|don'?t break|you missed|behind|overdue|score|level|\d+\s*(days?|weeks?)/i;
    for (const key of NUDGE_TEMPLATE_KEYS) {
      expect(en[key], `${key} carries a pressure/verdict word`).not.toMatch(banned);
    }
  });

  it("JSON.stringify of the whole set contains no interpolation token", () => {
    const rendered = NUDGE_TEMPLATE_KEYS.map((k) => ({ en: en[k], he: he[k] }));
    expect(JSON.stringify(rendered)).not.toMatch(INTERPOLATION);
  });
});

describe("N1-06 NEGATIVE CONTROL — the live jitai nudge fails the scan the templates pass", () => {
  it("nextNudge's own output DOES carry {name}, which is why the templates exist", () => {
    const at = (h: number) => new Date(2026, 5, 17, h, 0, 0).getTime();
    const candidate = nextNudge({
      nowMs: at(16),
      rhythm: baseRhythm({ confidence: "low" }),
      loggedToday: 0,
      recent7d: 4,
      childName: "Dylan",
    });
    expect(candidate).not.toBeNull();

    // (1) It has a `vars` key at all — the field the template type does not have.
    expect(candidate!.vars).toBeDefined();
    // (2) And that field holds the child's first name.
    expect(JSON.stringify(candidate!.vars)).toContain("Dylan");
    // (3) The copy behind its keys interpolates — this is the exact string that
    //     must never reach a lock screen.
    const headline = enOrKey(candidate!.headlineKey);
    const body = enOrKey(candidate!.bodyKey);
    expect(`${headline} ${body}`).toMatch(INTERPOLATION);

    // (4) The same scan applied to this candidate's kind's TEMPLATE passes.
    const tpl = templateFor(candidate!.kind);
    expect(`${en[tpl.titleKey]} ${en[tpl.bodyKey]}`).not.toMatch(INTERPOLATION);
  });

  it("the base i18n dictionary's nudge.* copy is the thing being replaced", () => {
    // Read the base dictionary as text rather than importing it — the point is
    // that `nudge.log.*` (jitai's keys) carries {name} and `elev.rh.nudge.*`
    // (the templates' keys) does not.
    const i18nSrc = readFileSync(path.join(process.cwd(), "src/lib/i18n.ts"), "utf8");
    const nudgeLines = i18nSrc
      .split("\n")
      .filter((l) => /"nudge\.[a-z]+\.(headline|body)"/.test(l));
    expect(nudgeLines.length).toBeGreaterThan(0);
    expect(nudgeLines.join("\n")).toMatch(INTERPOLATION);
  });
});

/** Resolve a jitai i18n key from the base dictionary source, by text. */
function enOrKey(key: string): string {
  const i18nSrc = readFileSync(path.join(process.cwd(), "src/lib/i18n.ts"), "utf8");
  const escaped = key.replace(/\./g, "\\.");
  const m = new RegExp(`"${escaped}"\\s*:\\s*"([^"]*)"`).exec(i18nSrc);
  return m ? m[1] : key;
}
