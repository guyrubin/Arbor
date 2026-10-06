/**
 * B-ASKJB-13 — Journal counts and claims say what they count.
 *
 * The feed header printed `{signals.length} moments` over a feed that mixes
 * moments, plans, memory rows, play and practice ("19 moments" = 3 moments +
 * 16 other rows). The story line claimed "Arbor is connecting … into a living
 * story". Plan and memory rows wore a guessed domain chip via KIND_DOMAIN.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { journalFeedCountKey, weekMomentCount, type TimelineSignal } from "../../lib/signalTimeline";
import { translate } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const JOURNAL = stripComments(readFileSync(path.join(SRC, "components/tabs/JournalTab.tsx"), "utf8"));

const NOW = Date.parse("2026-10-01T12:00:00Z");
const ago = (h: number) => new Date(NOW - h * 3600_000).toISOString();
const sig = (id: string, kind: TimelineSignal["kind"], at: string | null): TimelineSignal =>
  ({ id, kind, at, tone: "lav" } as TimelineSignal);

const SEED: TimelineSignal[] = [
  sig("moment-1", "moment", ago(2)),
  sig("moment-2", "moment", ago(20)),
  sig("moment-3", "moment", ago(50)),
  sig("plan-1", "plan", null),
  sig("memory-1", "memory", ago(5)),
  sig("memory-2", "memory", ago(30)),
];

const header = (lang: "en" | "he", s: TimelineSignal[]) => {
  const { key, n } = journalFeedCountKey(s);
  return translate(lang, key, { n });
};

describe("B-ASKJB-13 · Journal header counts by kind", () => {
  it("3 moments + 1 plan + 2 memory rows reads '6 entries', story '3 moments this week'", () => {
    expect(header("en", SEED)).toBe("6 entries");
    expect(header("he", SEED)).toBe("6 רשומות");
    const week = weekMomentCount(SEED, NOW);
    expect(week).toBe(3);
    expect(translate("en", "journal.story.body", { count: week })).toMatch(/^3 moments this week/);
    expect(translate("he", "journal.story.body", { count: week })).toMatch(/^3 רגעים השבוע/);
  });

  it("names 'moments' only when every row is a moment; plural forms EN + HE", () => {
    const moments = SEED.filter((s) => s.kind === "moment");
    expect(header("en", moments)).toBe("3 moments");
    expect(header("he", moments)).toBe("3 רגעים");
    expect(header("en", moments.slice(0, 1))).toBe("1 moment");
    expect(header("he", moments.slice(0, 1))).toBe("רגע אחד");
    expect(header("en", [SEED[3]])).toBe("1 entry");
    expect(header("he", [SEED[3]])).toBe("רשומה אחת");
    expect(translate("en", "journal.story.body.one")).toMatch(/^1 moment this week/);
    expect(translate("he", "journal.story.body.one")).toMatch(/^רגע אחד השבוע/);
  });

  it("P5-LOOP c2 r1: no journal key claims 'nothing is added without you' while the thread folds practiceEvents / heroRuns (EN + HE)", async () => {
    const { en, he } = await import("../../lib/i18n");
    const fold = readFileSync(path.join(SRC, "lib", "timelineFold.ts"), "utf8");
    const foldsPlay = /practiceEvents|heroRuns/.test(fold);
    for (const dict of [en, he]) {
      for (const [k, v] of Object.entries(dict)) {
        if (!/^(elev\.)?journal\./.test(k)) continue;
        if (foldsPlay) expect(v, k).not.toMatch(/nothing is added|לא נוסף בלעדיכם/i);
      }
    }
    expect(foldsPlay).toBe(true); // the premise: the fold still reads the play rows
    expect(translate("en", "journal.story.body", { count: 7 })).toBe("7 moments this week, in order.");
    expect(translate("he", "journal.story.body", { count: 7 })).toBe("7 רגעים השבוע, לפי הסדר.");
  });

  it("the story line claims nothing Arbor does not do", () => {
    for (const lang of ["en", "he"] as const) {
      for (const key of ["journal.story.body", "journal.story.body.one"]) {
        const v = translate(lang, key, { count: 3 });
        expect(v).not.toMatch(/connecting|living story|מחבר/);
      }
    }
  });

  it("the header reads the count selector, never `signals.length` + a fixed noun", () => {
    expect(JOURNAL).toContain("journalFeedCountKey(signals)");
    expect(JOURNAL).not.toContain("journal.timeline.count");
  });

  it("NEXTLEVEL critic r1 — under a filter or search the count says what is on screen ('3 matches'), never the unfiltered total and never 'x of y'", () => {
    const at = JOURNAL.indexOf('data-testid="journal-feed-count"');
    expect(at).toBeGreaterThan(-1);
    const span = JOURNAL.slice(at, JOURNAL.indexOf("</span>", at));
    expect(span).toMatch(/filtering\s*\?\s*t\(visibleSignals\.length === 1 \? "journal\.timeline\.matches\.one" : "journal\.timeline\.matches", \{ n: visibleSignals\.length \}\)/);
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "journal.timeline.matches", { n: 3 })).toContain("3");
      expect(translate(lang, "journal.timeline.matches", { n: 3 })).not.toMatch(/ of |מתוך|%|\//);
      expect(translate(lang, "journal.timeline.matches.one")).toBeTruthy();
    }
  });

  it("NEXTLEVEL critic r1 — at lg a reading column (≤ 42rem) and a sticky 20rem compose rail", () => {
    expect(JOURNAL).toContain("lg:grid lg:grid-cols-[minmax(0,42rem)_20rem]");
    expect(JOURNAL).toMatch(/data-module="journal-header" className="[^"]*lg:col-start-1 lg:row-start-1"/);
    expect(JOURNAL).toMatch(/data-module="journal-compose" className="[^"]*lg:sticky lg:top-4 lg:col-start-2 lg:row-span-3 lg:row-start-1"/);
    expect(JOURNAL).toContain('aria-labelledby="journal-timeline-title" className="min-w-0 lg:col-start-1"');
  });
});

describe("B-ASKJB-13 · no guessed domain chip on plan or memory rows", () => {
  it("KIND_DOMAIN is gone from the source", () => {
    expect(JOURNAL).not.toMatch(/KIND_DOMAIN/);
  });
  it("the row domain comes from explicit data only", () => {
    expect(JOURNAL).toContain("domainOf.get(s.id) ?? null");
    expect(JOURNAL).toMatch(/PLAY_TO_DOMAIN\[pl\.domain\]/);
  });
});
