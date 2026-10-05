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
import { translate } from "./i18n";
import { STUDIO_WORLDS, studioCountKey, type StudioCountSource } from "../components/practice/studioWorlds";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const SPEECH = stripComments(read("components/practice/SpeechCoachTab.tsx"));
const FEELINGS = stripComments(read("components/practice/FeelingsLabTab.tsx"));
const JOURNEY = stripComments(read("components/practice/JourneyTab.tsx"));
// B-PLAY-02: the world list moved to components/practice/studioWorlds.ts.
const STUDIO = stripComments(read("components/practice/PracticeStudioTab.tsx")) + stripComments(read("components/practice/studioWorlds.ts"));

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
    // W2-SHELLPLAY r1: the count line is plural-keyed now.
    const counts = FEELINGS.indexOf('"elev.practice.feelings.count.rounds.one"');
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

/**
 * B-PLAY-02 — Practice tile counts tell the truth. The Feelings tile counted
 * every practiceEvents row of every kind, and every world said "sessions"
 * whatever it counted. Fixture: 5 Beat Keeper rounds, 0 Feelings rounds.
 */
describe("B-PLAY-02 · per-world count and unit", () => {
  const ev = (kind: string, i: number) => ({ id: `${kind}-${i}`, kind, timestamp: "2026-10-01T10:00:00Z" });
  const fixture = (events: { id: string; kind: string; timestamp: string }[]): StudioCountSource =>
    ({ speech: { items: [] }, mimic: { items: [] }, adventures: { items: [] }, events: { items: events } } as unknown as StudioCountSource);
  const world = (id: string) => STUDIO_WORLDS.find((w) => w.id === id)!;
  const chip = (lang: "en" | "he", id: string, d: StudioCountSource) => {
    const n = world(id).count(d);
    return n > 0 ? translate(lang, studioCountKey(world(id).unit, n), { n }) : null;
  };

  it("5 Beat Keeper rounds render '5 rounds' on Beat Keeper and no chip on Feelings (EN + HE)", () => {
    const d = fixture([0, 1, 2, 3, 4].map((i) => ev("rhythm", i)));
    expect(chip("en", "beat", d)).toBe("5 rounds");
    expect(chip("he", "beat", d)).toBe("5 סבבים");
    expect(chip("en", "feelings", d)).toBeNull();
    expect(chip("he", "feelings", d)).toBeNull();
  });

  it("Feelings counts emotion-id | emotion-why | calm only", () => {
    const d = fixture([ev("emotion-id", 1), ev("emotion-why", 2), ev("calm", 3), ev("memory", 4), ev("pattern", 5), ev("phonics", 6), ev("vocab-naming", 7)]);
    expect(world("feelings").count(d)).toBe(3);
  });

  it("plural keys for 1 vs many, every unit, both locales", () => {
    for (const unit of ["tries", "rounds", "stories"] as const) {
      for (const lang of ["en", "he"] as const) {
        const one = translate(lang, studioCountKey(unit, 1), { n: 1 });
        const many = translate(lang, studioCountKey(unit, 3), { n: 3 });
        expect(one, `${lang} ${unit}.one`).not.toBe(studioCountKey(unit, 1));
        expect(many, `${lang} ${unit}`).not.toBe(studioCountKey(unit, 3));
        expect(one).not.toContain("{n}");
        expect(many).toContain("3");
      }
    }
    expect(translate("en", studioCountKey("rounds", 1), { n: 1 })).toBe("1 round");
    expect(translate("he", studioCountKey("rounds", 1), { n: 1 })).toBe("סבב אחד");
  });

  it("no world says 'sessions' any more", () => {
    const studio = stripComments(read("components/practice/PracticeStudioTab.tsx"));
    expect(studio).not.toContain("practice.studio.sessions");
    expect(translate("en", "practice.studio.sessions")).toBe("practice.studio.sessions");
  });
});

describe("B-PLAY-05 + W2-SHELLPLAY critic r1 — ONE sentence on the Practice door", () => {
  const studio = readFileSync(path.join(here, "..", "components", "practice", "PracticeStudioTab.tsx"), "utf8");
  const tEn = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
  const tHe = (key: string, vars?: Record<string, string | number>) => translate("he", key, vars);
  // Thursday 1 Oct 2026, 16:00 UTC; "now" is the next day.
  const T0 = Date.parse("2026-10-01T16:00:00Z");
  const NOW = T0 + 26 * 3_600_000;
  const after = (min: number) => new Date(T0 + min * 60_000).toISOString();
  const base = {
    ledgers: { speech: [after(1), after(2)], practice: [after(4)] },
    stories: [{ title: "Little David", completedAt: after(9) }],
    sinceMs: T0,
    sinceIsFallback: false,
    nowMs: NOW,
    childName: "Maya",
  };

  it("one unit, a named day, one isolated title (EN)", async () => {
    const { doorSinceSentence } = await import("./kidExitRecap");
    const { withChildSignals } = await import("./i18nElevation/childsignals");
    const s = doorSinceSentence({ ...base, uiLang: "en", gender: "girl", t: withChildSignals(tEn, false) })!;
    expect(s.rounds).toBe(3);
    expect(s.title).toBe("Little David");
    const text = s.before + s.title + s.after;
    expect(text).toBe("Since Thursday, Maya played 3 rounds and finished Little David.");
    // never the old log-entry shape ("Maya: Completed 3 …") or mixed units
    expect(text).not.toMatch(/: Completed|games|speech practice/);
  });

  it("Hebrew takes the verb's gender from the profile — never a slash", async () => {
    const { doorSinceSentence } = await import("./kidExitRecap");
    const { withChildSignals } = await import("./i18nElevation/childsignals");
    const t = withChildSignals(tHe, true);
    const he = { ...base, childName: "מאיה", uiLang: "he" as const, t };
    const girl = doorSinceSentence({ ...he, gender: "girl" })!;
    const boy = doorSinceSentence({ ...he, gender: "boy" })!;
    const none = doorSinceSentence({ ...he, gender: undefined })!;
    expect(girl.before).toContain("שיחקה");
    expect(girl.before).toContain("וסיימה");
    expect(boy.before).toContain("שיחק ");
    for (const s of [girl, boy, none]) {
      const text = s.before + s.after;
      expect(text).not.toMatch(/\//);
      expect(text).not.toMatch(/[A-Za-z]/);
      expect(s.title).toBe("Little David");
    }
  });

  it("the window is named: fallback = the last 7 days; same day = today", async () => {
    const { doorSinceSentence } = await import("./kidExitRecap");
    const fb = doorSinceSentence({ ...base, sinceIsFallback: true, uiLang: "en", t: tEn })!;
    expect(fb.before.startsWith("In the last 7 days, ")).toBe(true);
    const today = doorSinceSentence({ ...base, nowMs: T0 + 60 * 60_000, uiLang: "en", t: tEn })!;
    expect(today.before.startsWith("Today, ")).toBe(true);
  });

  it("day 0 (or nothing since the session began) renders nothing", async () => {
    const { doorSinceSentence } = await import("./kidExitRecap");
    const quiet = { ...base, uiLang: "en" as const, t: tEn };
    expect(doorSinceSentence({ ...quiet, ledgers: {}, stories: [] })).toBeNull();
    expect(doorSinceSentence({ ...quiet, ledgers: { speech: [after(-5)] }, stories: [{ title: "Old", completedAt: after(-60) }] })).toBeNull();
  });

  it("count-only keys: no score, %, streak or correctness in the new copy", () => {
    for (const dict of [doorsEn, doorsHe]) {
      const keys = Object.keys(dict).filter((k) => k.startsWith("elev.practice.door.sentence.") || k.startsWith("elev.practice.door.when.") || k.startsWith("elev.practice.door.rounds."));
      expect(keys.length).toBe(14);
      for (const key of keys) expect(dict[key]).not.toMatch(/%|score|streak|correct|right|wrong|ציון|רצף|נכון/i);
    }
  });

  it("the sentence lives INSIDE the kid-mode door (no new module), title bidi-isolated; the page still stamps 2", () => {
    const door = studio.slice(studio.indexOf('data-module="practice-kidmode-door"'), studio.indexOf("</section>", studio.indexOf('data-module="practice-kidmode-door"')));
    expect(door).toContain('data-testid="practice-since-last-play"');
    expect(door).toMatch(/<bdi>\{since\.title\}<\/bdi>/);
    expect((studio.match(/\bdata-module="/g) || []).length).toBe(2);
    expect(studio).toContain("known ?? Date.now() - SINCE_LAST_PLAY_FALLBACK_MS");
    // the story title is resolved in the UI language, never the stored run title
    expect(studio).toContain("runTitle(r, lang)");
  });

  it("the door CTA is secondary and the move is stamped on the first tile, not the grid", () => {
    const src = stripComments(studio);
    expect(src).not.toMatch(/--gradient-cta|--arbor-gradient-primary/);
    expect(src).toContain('data-primary-move={i === 0 ? "start-world" : undefined}');
    expect(src).not.toMatch(/className="grid[^"]*"\s+data-primary-move/);
  });

  it("one count of play per screen: the phone hub line is quiet on practice / feelings / adventures", () => {
    const shell = read("components/layout/Shell.tsx");
    for (const route of ["practice", "feelings", "adventures"]) {
      expect(shell).toMatch(new RegExp(String.raw`HUB_LINE_QUIET_TABS: ReadonlySet<string> = new Set\(\[[^\]]*"${route}"`));
    }
  });

  it("a kid-only tile promises nothing the tap does not deliver (no world name until B-KID-11)", () => {
    const src = stripComments(studio);
    expect(src).not.toContain("practice.studio.openKidmode");
    expect(src).toContain('t("elev.practice.studio.opensKidmode")');
    expect(translate("en", "elev.practice.studio.opensKidmode")).toBe("Opens Kid Mode");
    expect(translate("he", "elev.practice.studio.opensKidmode")).not.toMatch(/[A-Za-z]/);
  });
});

describe("W2-SHELLPLAY r1 · #/speech — the round is scored on the fold, in one neutral treatment", () => {
  const speech = stripComments(read("components/practice/SpeechCoachTab.tsx"));
  const parent = speech.slice(speech.indexOf("if (!kidMode) {"), speech.indexOf('<details data-module="speech-more"'));

  it("the scoring row sits inside the target card, BEFORE Record and the consent door", () => {
    const row = parent.indexOf('data-primary-move="complete-speech-round"');
    expect(row).toBeGreaterThan(-1);
    expect(row).toBeGreaterThan(parent.indexOf('t("prac.speech.next")'));
    expect(row).toBeLessThan(parent.indexOf('t("prac.speech.record", { name: first })'));
    expect(row).toBeLessThan(parent.indexOf('data-testid="speech-consent-door"'));
    // the consent invite is a closed one-line door, not an open card
    expect(parent).toContain('<details data-testid="speech-consent-door"');
  });

  it("law 1: no hue carries correctness; descriptive labels; 44 px; one gradient on 'Said it'", () => {
    const row = parent.slice(parent.indexOf('data-primary-move="complete-speech-round"'), parent.indexOf('data-testid="speech-almost-line"'));
    expect(row).not.toMatch(/green-soft|yellow-soft|pink-soft|green-ink|yellow-ink|pink-ink/);
    expect(row).toContain("min-h-[44px]");
    expect((parent.match(/--gradient-cta/g) || []).length).toBe(1);
    expect(translate("en", "elev.practice.speech.result.got")).toBe("Said it");
    expect(translate("en", "elev.practice.speech.result.missed")).toBe("Not yet — model it again");
    // NEGATIVE CONTROL: the pre-fix triad
    expect('b.tone === "mint" ? "var(--arbor-green-soft)" : b.tone === "yellow" ? "var(--arbor-yellow-soft)" : "var(--arbor-pink-soft)"').toMatch(/green-soft|yellow-soft|pink-soft/);
  });

  it("the ladder tabs are 44 px", () => {
    const ladder = parent.slice(parent.indexOf('role="tablist" aria-label={t("prac.speech.ladder.aria")}'), parent.indexOf("{t(l.labelKey)}"));
    expect(ladder).toContain("min-h-[44px]");
  });

  it("no target pressure: no repetition quota, no dose celebration", () => {
    expect(speech).not.toContain("prac.speech.dose.explainer");
    expect(speech).not.toContain("prac.speech.doseWin");
    expect(speech).not.toContain("speechDose(");
    for (const lang of ["en", "he"] as const) expect(translate(lang, "elev.practice.speech.littleOften")).not.toMatch(/\d/);
  });

  it("law 8: a Hebrew session never renders the English drill — an honest door to #/language instead", () => {
    expect(speech).toContain('const speechHe = uiLang === "he" || aiLang === "he";');
    expect(parent).toMatch(/\{speechHe \? \(\s*<SectionCard title=\{t\("elev\.practice\.speech\.he\.title"\)\}/);
    expect(parent).toContain('onClick={() => setActiveTab("language")}');
    expect(parent).toContain("{!speechHe && (");
    for (const k of ["elev.practice.speech.he.title", "elev.practice.speech.he.body", "elev.practice.speech.he.cta", "elev.practice.speech.almost"]) {
      expect(translate("he", k).replace(/\{\w+\}/g, "")).not.toMatch(/[A-Za-z]/);
    }
  });

  it("law 4: no raw hex or coloured shadow in the file", () => {
    expect(speech).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgba\(88,166,255/);
  });
});
