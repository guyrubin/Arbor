import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { en, he, translate } from "./i18n";
import {
  ALL_MILESTONES,
  CUSTOM_MILESTONE_AGE_GROUP,
  CUSTOM_MILESTONE_DESC,
  MILESTONE_AGE_BANDS,
  MILESTONE_HE_REVIEW,
  milestoneAgeGroupText,
  milestoneBandLabel,
  milestoneText,
  milestoneTextKey,
  type MilestoneTextField,
} from "./milestoneData";
import { HE_MILESTONE_TEXT } from "./i18nElevation/milestoneCatalogue";
import { CLINICAL_DIAGNOSIS_TERMS_HE, findClinicalDiagnosisTerm } from "./clinicalScan";
import { HE_VERDICT_WORDS as HE_VERDICT_WORDS_SHARED } from "./milestoneHeRules";
import { buildTimeline, signalDetail, signalMeta, signalTitle } from "./signalTimeline";
import type { Milestone } from "../types";

/**
 * B-GROWTH-11 — the Hebrew milestone catalogue (AI first pass, flagged for
 * native review, GD-6), keyed by stable id. Copies the screeningI18n pattern:
 *  1) COVERAGE — every catalogue id has title/desc/looks in BOTH languages,
 *     EN mirrors lib/milestoneData.ts, every band and age label resolves.
 *  2) LANGUAGE — every HE string is Hebrew (no Latin), passes the clinical
 *     scanner (CLINICAL_DIAGNOSIS_TERMS_HE) and carries no verdict/norm word.
 *  3) SEAM — catalogue rows render by id, parent-added rows keep their words.
 *  4) SOURCE — the render sites print through the resolver, never the stored
 *     English (`item.title`, `band.label`, …).
 */

const SRC_ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|\s)\/\/.*$/gm, "");

const FIELDS: MilestoneTextField[] = ["title", "desc", "looks"];
const tHe = (key: string, vars?: Record<string, string | number>) => translate("he", key, vars);
const tEn = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
const LATIN = /[A-Za-z]/;
/** Verdict / norm words a parent must never read about their child — ONE list
 *  (lib/milestoneHeRules), shared with the native-review import (B-LOOP-02). */
const HE_VERDICT_WORDS = [...HE_VERDICT_WORDS_SHARED];

describe("B-GROWTH-11 — catalogue coverage (both languages, keyed by stable id)", () => {
  it("measures the catalogue: 118 CDC + 6 ASHA = 124 rows (B-LOOP-01 retired the 10 unsourced Arbor rows; the 6 Oct reconcile split cdc-24m-5 into body parts + cdc-24m-11 gestures), all with HE", () => {
    expect(ALL_MILESTONES.length).toBe(124);
    const ids = ALL_MILESTONES.map((m) => m.id);
    expect(new Set(ids).size, "catalogue ids must be unique").toBe(ids.length);
    expect(Object.keys(HE_MILESTONE_TEXT).sort()).toEqual([...ids].sort());
  });

  it("every catalogue id has title/desc/looks in BOTH dictionaries; EN mirrors the data", () => {
    for (const m of ALL_MILESTONES) {
      for (const field of FIELDS) {
        const key = milestoneTextKey(m.id, field);
        expect(en[key] ?? translate("en", key), `missing EN ${key}`).not.toBe(key);
        expect(translate("he", key), `missing HE ${key}`).not.toBe(key);
        expect(translate("he", key), `HE ${key} fell back to English`).not.toBe(translate("en", key));
      }
      expect(translate("en", milestoneTextKey(m.id, "title"))).toBe(m.title);
      expect(translate("en", milestoneTextKey(m.id, "desc"))).toBe(m.description);
      expect(translate("en", milestoneTextKey(m.id, "looks"))).toBe(m.skillLooksLike ?? m.description);
    }
  });

  it("every band label and every catalogue ageGroup resolves to Hebrew", () => {
    for (const b of MILESTONE_AGE_BANDS) {
      expect(milestoneBandLabel(b.months, tEn)).toBe(b.label);
      const heLabel = milestoneBandLabel(b.months, tHe);
      expect(heLabel, `band ${b.months}`).not.toMatch(LATIN);
      expect(heLabel.length).toBeGreaterThan(0);
    }
    for (const ageGroup of new Set(ALL_MILESTONES.map((m) => m.ageGroup))) {
      expect(milestoneAgeGroupText({ ageGroup }, tHe), `ageGroup "${ageGroup}"`).not.toMatch(LATIN);
      expect(milestoneAgeGroupText({ ageGroup }, tEn)).toBe(ageGroup);
    }
    expect(milestoneAgeGroupText({ ageGroup: CUSTOM_MILESTONE_AGE_GROUP, custom: true }, tHe)).toBe(he["ms.custom"]);
  });

  it("the whole HE catalogue is flagged as an AI first pass awaiting native review (GD-6)", () => {
    expect(MILESTONE_HE_REVIEW).toBe("ai-first-pass");
    expect(translate("en", "ms.heReview.note")).not.toBe("ms.heReview.note");
    expect(translate("he", "ms.heReview.note")).not.toBe("ms.heReview.note");
    expect(translate("he", "ms.heReview.note")).not.toMatch(LATIN);
    expect(read("lib/i18nElevation/milestoneCatalogue.ts")).toContain("AI FIRST PASS");
  });
});

describe("B-GROWTH-11 — every HE catalogue string is Hebrew, clinical-clean and verdict-free", () => {
  const heStrings: Array<[string, string]> = [];
  for (const [id, row] of Object.entries(HE_MILESTONE_TEXT)) row.forEach((s, i) => heStrings.push([`${id}.${FIELDS[i]}`, s]));
  for (const b of MILESTONE_AGE_BANDS) heStrings.push([`band.${b.months}`, milestoneBandLabel(b.months, tHe)]);
  heStrings.push(["ms.heReview.note", translate("he", "ms.heReview.note")]);

  it("covers 3 × 124 item strings + 13 bands + the review note", () => {
    expect(heStrings.length).toBe(124 * 3 + 13 + 1);
  });

  it("no Latin letters (0 English inside the Hebrew catalogue)", () => {
    const hits = heStrings.filter(([, s]) => LATIN.test(s)).map(([k, s]) => `${k}: ${s}`);
    expect(hits).toEqual([]);
  });

  it("passes CLINICAL_DIAGNOSIS_TERMS_HE (FU#67 standing rule)", () => {
    expect(CLINICAL_DIAGNOSIS_TERMS_HE.length).toBeGreaterThan(0);
    const hits = heStrings.map(([k, s]) => [k, findClinicalDiagnosisTerm(s)] as const).filter(([, term]) => term !== null);
    expect(hits).toEqual([]);
  });

  it("carries no verdict or norm word (counts never verdicts)", () => {
    const hits = heStrings.flatMap(([k, s]) => HE_VERDICT_WORDS.filter((w) => s.includes(w)).map((w) => `${k}: "${w}" in ${s}`));
    expect(hits).toEqual([]);
  });

  it("no empty strings and no stray whitespace", () => {
    for (const [k, s] of heStrings) {
      expect(s.trim(), k).toBe(s);
      expect(s.length, k).toBeGreaterThan(1);
    }
  });
});

describe("B-GROWTH-11 — the resolver seam", () => {
  const catalogue = ALL_MILESTONES[0];

  it("a catalogue row resolves by id, even when the stored doc carries stale English", () => {
    const stored: Milestone = { ...catalogue, title: "Calms when comforted (old seed)", description: "old" };
    expect(milestoneText(stored, "title", tHe)).toBe(HE_MILESTONE_TEXT[catalogue.id][0]);
    expect(milestoneText(stored, "desc", tHe)).toBe(HE_MILESTONE_TEXT[catalogue.id][1]);
    expect(milestoneText(stored, "looks", tHe)).toBe(HE_MILESTONE_TEXT[catalogue.id][2]);
    expect(milestoneText(stored, "title", tEn)).toBe(catalogue.title);
  });

  it("a parent-added milestone keeps the parent's words; the app placeholder description is translated", () => {
    const custom: Milestone = { id: "ms-1700000000000", domain: "social_development", ageGroup: CUSTOM_MILESTONE_AGE_GROUP, title: "Says 'savta' to grandma", description: CUSTOM_MILESTONE_DESC, checked: false, custom: true };
    expect(milestoneText(custom, "title", tHe)).toBe("Says 'savta' to grandma");
    expect(milestoneText(custom, "desc", tHe)).toBe(translate("he", "ms.customDesc"));
    expect(milestoneText(custom, "desc", tHe)).not.toMatch(LATIN);
    // A custom row whose id collides with a catalogue id still keeps its words.
    expect(milestoneText({ ...custom, id: catalogue.id }, "title", tHe)).toBe("Says 'savta' to grandma");
  });

  it("timeline milestone rows render the catalogue in Hebrew; a keepsake note stays the parent's", () => {
    const noticed = ALL_MILESTONES.slice(0, 3).map((m) => ({ ...m, checked: true, observationUpdatedAt: "2026-10-01T10:00:00.000Z" }));
    const signals = buildTimeline({
      milestones: noticed,
      keepsakes: [{ milestoneId: noticed[1].id, note: "First time at Savta's", savedAt: "2026-10-01T10:00:00.000Z" } as never],
    } as never).filter((s) => s.kind === "milestone");
    expect(signals.length).toBe(3);
    for (const s of signals) {
      const title = signalTitle(s, tHe);
      expect(title, title).not.toMatch(LATIN);
      expect(signalMeta(s, tHe) ?? "", "age chip").not.toMatch(LATIN);
    }
    const withNote = signals.find((s) => s.id === `milestone-${noticed[1].id}`)!;
    expect(signalDetail(withNote, tHe)).toBe("First time at Savta's");
    const plain = signals.find((s) => s.id === `milestone-${noticed[0].id}`)!;
    expect(signalDetail(plain, tHe)).toBe(HE_MILESTONE_TEXT[noticed[0].id][1]);
  });
});

describe("B-GROWTH-11 — render sites print through the resolver (source scan)", () => {
  const FORBIDDEN: Record<string, RegExp[]> = {
    "components/tabs/MilestonesTab.tsx": [
      // JSX render (`{item.title}`); the `${item.title}` template is the
      // English AI-explain payload — its output follows aiLang (out of scope).
      /(?<!\$)\{\s*item\.(?:title|description|skillLooksLike|ageGroup)\s*\}/,
      /\bband\.label\b/,
      /\bcurrentBand\.label\b/,
      /milestoneTitle=\{\s*openKeepsake\?\.title/,
      /title:\s*item\.title\b/,
    ],
    "components/tabs/DevelopmentTab.tsx": [
      /\bchosenWatch\.(?:title|description)\b/,
      /\bselected\.milestone\.(?:title|description)\b/,
      /title:\s*m\.title\b/,
    ],
    "components/growth/MonthInReview.tsx": [/\{\s*nextToWatch\.title\s*\}/],
    "components/tabs/StoryTimelineTab.tsx": [/title:\s*m\.refTitle/],
  };
  for (const [rel, patterns] of Object.entries(FORBIDDEN)) {
    it(`${rel} renders no stored English catalogue text`, () => {
      const code = stripComments(read(rel));
      for (const re of patterns) expect(code, `${rel} still matches ${re}`).not.toMatch(re);
      expect(code, `${rel} must route through the resolver`).toMatch(/milestoneText\(|milestoneBandLabel\(|signalTitle\(/);
    });
  }

  it("NEGATIVE CONTROL: the pre-fix render shapes are what the scan bans", () => {
    expect("<span>{item.title}</span>").toMatch(FORBIDDEN["components/tabs/MilestonesTab.tsx"][0]);
    expect("{band.label}").toMatch(FORBIDDEN["components/tabs/MilestonesTab.tsx"][1]);
    expect("title: chosenWatch.title,").toMatch(FORBIDDEN["components/tabs/DevelopmentTab.tsx"][0]);
    expect("{nextToWatch.title}").toMatch(FORBIDDEN["components/growth/MonthInReview.tsx"][0]);
  });
});
