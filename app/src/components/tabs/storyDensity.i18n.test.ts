/**
 * TJB-23 — the Story density (#/timeline) ran on English literals.
 *
 * A Hebrew parent opening the Story reading of their own child's timeline met:
 * "My Child", "Dylan's Story", the subtitle, "Weekly insight", "Save story",
 * "Built from 3 approved memories…", "Arbor noticed" with an English
 * next-step sentence built in signalTimeline, "1 new facts to review", the
 * whole empty state, and an English `aria-label` on every intensity meter.
 *
 * Law 7: both locales are the design. This scans the rendered STRING SITES of
 * the density, and pins the EN/HE parity + the plural pairs of the keys they
 * moved to. Negative control = the literals themselves, asserted absent.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he } from "../../lib/i18nElevation/childsignals";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const STORY = stripComments(read("components/tabs/StoryTimelineTab.tsx"));
const TIMELINE = stripComments(read("lib/signalTimeline.ts"));

/** Every literal that used to render on this density. */
const RETIRED = [
  'eyebrow="My Child"',
  "'s Story`",
  "one living timeline",
  "Weekly insight",
  "Save story",
  "Built from {story.factCount}",
  "Arbor noticed",
  "story starts here",
  "Capture the first moment",
  "everything you do flows into one living timeline",
  "`Intensity ${value} of 5`",
  "mychild.memoryreview.title",
];

describe("TJB-23 · the Story density carries no English literal", () => {
  it("NEGATIVE CONTROL: every retired literal is a real pre-fix string, and is gone", () => {
    for (const literal of RETIRED) {
      expect(STORY, `still renders: ${literal}`).not.toContain(literal);
    }
  });

  it("the next-step sentences left signalTimeline as template literals", () => {
    expect(TIMELINE).not.toContain("story starts with a single moment");
    expect(TIMELINE).not.toContain("Keep noticing");
    expect(TIMELINE).not.toMatch(/label: "Capture a moment"/);
    expect(TIMELINE).not.toMatch(/Ask Arbor about \$\{/);
    // deriveNextStep now takes the translate fn and emits keys.
    expect(TIMELINE).toMatch(/deriveNextStep = \(momentum: Momentum, childName: string, t: TranslateFn\)/);
    expect(TIMELINE).toMatch(/t\("elev\.childsignals\.next\.first"/);
  });

  it("no raw `#fff` is left where a literal was replaced (law 4)", () => {
    expect(STORY).not.toContain('"#fff"');
  });
});

describe("TJB-23 · EN and HE land together", () => {
  const KEYS = Object.keys(en).filter((k) => k.startsWith("elev.childsignals.story.") || k.startsWith("elev.childsignals.next.") || k.startsWith("elev.childsignals.stat."));

  it("there are keys for the whole density, and every one exists in both locales", () => {
    expect(KEYS.length).toBeGreaterThanOrEqual(24);
    for (const k of KEYS) {
      expect(en[k], `en missing ${k}`).toBeTruthy();
      expect(he[k], `he missing ${k}`).toBeTruthy();
      // HE is transcreated, not a copy of the English.
      expect(he[k], `he ${k} is still English`).not.toBe(en[k]);
      expect(he[k], `he ${k} carries no Hebrew`).toMatch(/[֐-׿]/);
    }
  });

  it("every key the density references resolves in both dictionaries", () => {
    const referenced = Array.from(STORY.matchAll(/"(elev\.childsignals\.[a-zA-Z.]+)"/g)).map((m) => m[1]);
    expect(referenced.length).toBeGreaterThan(10);
    for (const k of referenced) {
      expect(en[k], `en missing referenced ${k}`).toBeTruthy();
      expect(he[k], `he missing referenced ${k}`).toBeTruthy();
    }
  });

  it("the two counted strings are one/many pairs, not a glued {plural}", () => {
    for (const base of ["elev.childsignals.story.builtFrom", "elev.childsignals.story.memory.title"]) {
      for (const dict of [en, he]) {
        expect(dict[`${base}.one`]).toBeTruthy();
        expect(dict[`${base}.many`]).toBeTruthy();
        // "1 new facts" — the defect. The singular carries no {count} token.
        expect(dict[`${base}.one`]).not.toContain("{count}");
        expect(dict[`${base}.many`]).toContain("{count}");
      }
    }
    // Both call sites choose the branch by the count.
    expect(STORY).toMatch(/story\.factCount === 1 \? "one" : "many"/);
    expect(STORY).toMatch(/pendingMemoryItems\.length === 1 \? "one" : "many"/);
  });

  it("no elev.childsignals string leaks an unresolved token", () => {
    for (const dict of [en, he]) {
      for (const [k, v] of Object.entries(dict)) {
        expect(v, `${k} carries {plural}, which this module's resolver cannot fill`).not.toContain("{plural}");
      }
    }
  });
});
