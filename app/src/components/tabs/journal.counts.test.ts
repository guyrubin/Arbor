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
