/**
 * practiceDoors.copy.test.ts — the PARENT doors of the practice suite:
 * their module budgets (§3f row 2 / item 11) and their copy (OBJ-PRACTICE-02).
 *
 * Two defects, one file, because they share a cause: nobody was measuring
 * these surfaces.
 *
 *  1. BUDGETS. `surfaceContract` declares moduleBudget 2 for #/speech and
 *     #/feelings. Speech shipped eight top-level modules — the sound drill, the
 *     dose bar, the picker, Words & Express, Early reading and the progress
 *     tracker — and Feelings put three stat bubbles and a safety bar ABOVE its
 *     scenario, so the first answer tile rendered near the bottom of a 390
 *     phone. This file asserts the stamps (`data-module`, exactly one
 *     `data-primary-move`), the count against the declared budget, that the
 *     demoted capabilities still have a door (law 6), and that the move is
 *     stamped BEFORE the disclosure in source order.
 *
 *  2. COPY. `JourneyTab` was ~90 % hardcoded English and the Practice Studio
 *     launcher printed the ten Kid-Mode world names as English literals, so a
 *     Hebrew parent read "Sound Lab" and "Historical progression" on a
 *     right-to-left page. There was no key to fall back FROM.
 *
 * Source-order is a proxy, not a pixel: the rendered 390 px measurement stays
 * the orchestrator's. The proxy is what a repo test can actually hold.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contractFor } from "./surfaceContract";
import { en as doorsEn, he as doorsHe } from "./i18nElevation/practiceDoors";
import { elevationEn, elevationHe } from "./i18nElevation";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const SPEECH = stripComments(read("components/practice/SpeechCoachTab.tsx"));
const FEELINGS = stripComments(read("components/practice/FeelingsLabTab.tsx"));
const JOURNEY = stripComments(read("components/practice/JourneyTab.tsx"));
const STUDIO = stripComments(read("components/practice/PracticeStudioTab.tsx"));

const countOf = (src: string, re: RegExp) => (src.match(re) || []).length;
const MODULE = /\bdata-module=/g;
const MOVE = /\bdata-primary-move=/g;

/* ── 1 · budgets ──────────────────────────────────────────────────────────── */

describe("§3f row 2 — the speech and feelings doors are inside their budget", () => {
  const cases: { route: "speech" | "feelings"; src: string; move: string }[] = [
    { route: "speech", src: SPEECH, move: "complete-speech-round" },
    { route: "feelings", src: FEELINGS, move: "complete-feelings-scenario" },
  ];

  for (const { route, src, move } of cases) {
    it(`#/${route} stamps at most its declared moduleBudget of modules`, () => {
      const budget = contractFor(route)!.moduleBudget;
      expect(budget).toBe(2);
      expect(countOf(src, MODULE), `#/${route} stamps more modules than its budget`).toBeLessThanOrEqual(budget);
      expect(countOf(src, MODULE)).toBeGreaterThan(0);
    });

    it(`#/${route} declares exactly one primary move, and it is the contract's`, () => {
      expect(countOf(src, MOVE)).toBe(1);
      expect(src).toContain(`data-primary-move="${move}"`);
      expect(contractFor(route)!.primaryMove).toBe(move);
    });

    it(`#/${route} stamps the move BEFORE the demoted disclosure`, () => {
      const moveAt = src.indexOf("data-primary-move=");
      const detailsAt = src.indexOf("<details");
      expect(detailsAt, `#/${route} has no disclosure`).toBeGreaterThan(-1);
      expect(moveAt).toBeLessThan(detailsAt);
    });
  }

  it("speech keeps Words & Express and Early reading — demoted, never deleted (law 6)", () => {
    const detailsAt = SPEECH.indexOf('<details data-module="speech-more"');
    expect(detailsAt).toBeGreaterThan(-1);
    const inside = SPEECH.slice(detailsAt);
    expect(inside).toContain('t("prac.lang.title")');
    expect(inside).toContain("<EarlyReadingTrack");
    expect(inside).toContain('t("prac.speech.progress.title"');
  });

  it("feelings keeps the emotion library and the calm-down drills, behind one disclosure", () => {
    const detailsAt = FEELINGS.indexOf('<details data-module="feelings-toolkit"');
    expect(detailsAt).toBeGreaterThan(-1);
    const inside = FEELINGS.slice(detailsAt);
    expect(inside).toContain('t("elev.practice.feelings.why.title")');
    expect(inside).toContain('t("elev.practice.feelings.calm.title")');
    expect(inside).toContain("BREATHING_PATTERNS.map");
    expect(inside).toContain("CALM_TOOLS.map");
  });

  it("feelings puts the answer tiles ABOVE the counts and the safety note", () => {
    const tiles = FEELINGS.indexOf('data-primary-move="complete-feelings-scenario"');
    const counts = FEELINGS.indexOf('t("elev.practice.feelings.counts"');
    const trust = FEELINGS.indexOf("<TrustSafetyBar");
    expect(tiles).toBeGreaterThan(-1);
    expect(tiles).toBeLessThan(counts);
    expect(counts).toBeLessThan(trust);
  });

  it("the three stat bubbles are gone from the feelings door", () => {
    expect(FEELINGS).not.toContain("<StatBubble");
    expect(FEELINGS).not.toContain("StatBubble,");
  });

  it("NEGATIVE CONTROL: the pre-fix order (stats and safety bar above the drill) fails the order rule", () => {
    const preFix = `
      <TrustSafetyBar note="…" />
      <div className="grid grid-cols-3 gap-3"><StatBubble /></div>
      <div className="grid" data-primary-move="complete-feelings-scenario">{emotionTiles}</div>`;
    const trust = preFix.indexOf("<TrustSafetyBar");
    const tiles = preFix.indexOf("data-primary-move=");
    expect(tiles).toBeGreaterThan(trust); // i.e. the move is BELOW the note — the defect
    expect(preFix).toContain("<StatBubble");
  });

  it("NEGATIVE CONTROL: a fixture with budget+1 modules is over budget", () => {
    const overBudget = `<section data-module="a" /><section data-module="b" /><section data-module="c" />`;
    expect(countOf(overBudget, MODULE)).toBeGreaterThan(contractFor("feelings")!.moduleBudget);
  });
});

/* ── 2 · the shared key module ────────────────────────────────────────────── */

describe("practiceDoors — EN and HE land together (law 7)", () => {
  it("every key exists in both languages", () => {
    expect(Object.keys(doorsHe).sort()).toEqual(Object.keys(doorsEn).sort());
  });

  it("every key is elev.* namespaced and non-empty in both", () => {
    for (const [key, value] of Object.entries(doorsEn)) {
      expect(key.startsWith("elev."), key).toBe(true);
      expect(value.trim().length, key).toBeGreaterThan(0);
      expect(doorsHe[key].trim().length, key).toBeGreaterThan(0);
    }
  });

  it("the module is REGISTERED — the keys resolve through the merged dictionaries", () => {
    for (const key of Object.keys(doorsEn)) {
      expect(elevationEn[key], `${key} missing from elevationEn — register practiceDoors in i18nElevation/index.ts`).toBe(doorsEn[key]);
      expect(elevationHe[key], `${key} missing from elevationHe`).toBe(doorsHe[key]);
    }
  });

  it("the Hebrew half is transcreated, not the English string copied through", () => {
    const identical = Object.keys(doorsEn).filter((k) => doorsEn[k] === doorsHe[k]);
    expect(identical, `these HE values are still the English string: ${identical.join(", ")}`).toEqual([]);
    // …and it is actually Hebrew script, not transliteration.
    for (const [key, value] of Object.entries(doorsHe)) {
      expect(/[֐-׿]/.test(value), `${key} carries no Hebrew script`).toBe(true);
    }
  });

  it("interpolation placeholders match between EN and HE", () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(doorsEn)) {
      expect(vars(doorsHe[key]), key).toEqual(vars(doorsEn[key]));
    }
  });

  it("law 1: no key states a verdict about the child", () => {
    const VERDICT = /\b(?:behind|ahead|delayed?|at risk|weakest|below average|percentile|score|grade)\b/i;
    const offenders = Object.entries(doorsEn).filter(([, v]) => VERDICT.test(v));
    expect(offenders.map(([k]) => k)).toEqual([]);
  });
});

/* ── 3 · the doors actually use the keys ──────────────────────────────────── */

describe("OBJ-PRACTICE-02 — the practice doors speak both languages", () => {
  it("JourneyTab routes its own scaffolding through t()", () => {
    for (const key of [
      "elev.practice.journey.activeDays",
      "elev.practice.journey.objectivesDone",
      "elev.practice.journey.badgesLabel",
      "elev.practice.journey.week.title",
      "elev.practice.journey.week.today",
      "elev.practice.journey.mission.done",
      "elev.practice.journey.mission.markDone",
      "elev.practice.journey.extra",
      "elev.practice.journey.objectives.title",
      "elev.practice.journey.objectives.start",
      "elev.practice.journey.objectives.note",
      "elev.practice.journey.objectives.completed",
      "elev.practice.journey.objectives.tap",
      "elev.practice.journey.achievements.title",
      "elev.practice.journey.history.title",
      "elev.practice.journey.history.empty",
      "elev.practice.journey.history.noticed",
    ]) {
      expect(JOURNEY, `JourneyTab never calls t("${key}")`).toContain(`"${key}"`);
    }
  });

  it("NEGATIVE CONTROL: the pre-fix literals are gone from JourneyTab", () => {
    for (const literal of [
      '"This week"',
      '"Achievements"',
      '"Historical progression"',
      '"Mark done"',
      '"Aimed extra"',
      '"Start these"',
      '"Tap to mark complete"',
      "Active practice days this week",
      "Monthly objectives done",
      "Effort badges earned",
    ]) {
      expect(JOURNEY, `JourneyTab still hardcodes ${literal}`).not.toContain(literal);
    }
  });

  it("the launcher names its Kid-Mode worlds from the dictionary, not literals", () => {
    expect(STUDIO).toContain("elev.practice.world.kid.");
    for (const literal of ['"Sound Lab"', '"Mind Vault"', '"Spell Forge"', '"Beat Keeper"', '"Story Quest"']) {
      expect(STUDIO, `PracticeStudioTab still hardcodes ${literal}`).not.toContain(literal);
    }
  });

  it("Comics titles its own door from nav.tab.comics, not an English literal", () => {
    const comics = stripComments(read("components/tabs/ComicsTab.tsx"));
    expect(comics).toContain('t("nav.tab.comics")');
    expect(comics).not.toContain('title="Hero Comics"');
  });
});

/* ── 4 · item 6 / IA-02: the routes this batch owns are stamped ───────────── */

/**
 * `data-module` and `data-primary-move` occurred ZERO times in src/components
 * before this wave, so `surfaceContract`'s moduleBudget and primaryMove were
 * declarations nothing could measure. Every route in this batch now stamps its
 * top-level sibling modules and exactly one declared control.
 *
 * Counting in source, not in a DOM: there is no jsdom here, and a stamp that
 * is not in the file cannot be in the page. The rendered sweep (module count at
 * 390 px, the move above the fold) stays the orchestrator's, against these
 * same attributes. Note the count is a CEILING check — a module inside a
 * conditional branch renders sometimes and never raises the total.
 */
const STAMPED_ROUTES: { route: string; file: string; move: string }[] = [
  { route: "practice", file: "components/practice/PracticeStudioTab.tsx", move: "start-world" },
  { route: "speech", file: "components/practice/SpeechCoachTab.tsx", move: "complete-speech-round" },
  { route: "mimic", file: "components/practice/MimicStudioTab.tsx", move: "complete-mimic-round" },
  { route: "feelings", file: "components/practice/FeelingsLabTab.tsx", move: "complete-feelings-scenario" },
  { route: "journey", file: "components/practice/JourneyTab.tsx", move: "complete-mission" },
  { route: "adventures", file: "components/practice/AdventuresTab.tsx", move: "complete-adventure-scene" },
  { route: "stories", file: "components/tabs/HeroJourneyTab.tsx", move: "read-tonights-story" },
  { route: "bedtime-stories", file: "components/tabs/BedtimeStoriesTab.tsx", move: "generate-bedtime-story" },
  { route: "comics", file: "components/tabs/ComicsTab.tsx", move: "open-comic" },
];

describe("item 6 (IA-02) — every route in this batch stamps its contract", () => {
  for (const { route, file, move } of STAMPED_ROUTES) {
    const src = stripComments(read(file));

    it(`#/${route} stamps at least one data-module, and no more than its budget`, () => {
      const contract = contractFor(route as Parameters<typeof contractFor>[0])!;
      const modules = countOf(src, MODULE);
      expect(modules, `${file} stamps no module`).toBeGreaterThan(0);
      expect(
        modules,
        `${file} stamps ${modules} modules; #/${route} declares a budget of ${contract.moduleBudget}`,
      ).toBeLessThanOrEqual(contract.moduleBudget);
    });

    it(`#/${route} stamps exactly one data-primary-move, and it is "${move}"`, () => {
      expect(countOf(src, MOVE), `${file} must carry exactly one primary-move stamp`).toBe(1);
      expect(src).toContain(`"${move}"`);
      expect(contractFor(route as Parameters<typeof contractFor>[0])!.primaryMove).toBe(move);
    });
  }

  it("NEGATIVE CONTROL: an unstamped leaf and a double-stamped leaf both fail", () => {
    expect(countOf("<div className='x' />", MODULE)).toBe(0);
    expect(countOf('<a data-primary-move="x" /><b data-primary-move="y" />', MOVE)).toBe(2);
  });
});
