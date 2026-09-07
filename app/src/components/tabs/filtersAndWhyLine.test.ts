/**
 * OBJ-JOURNAL-04 · TJB-30 — two controls that told the parent nothing.
 *
 * OBJ-JOURNAL-04: the timeline's filter row rendered all eight kind chips
 * regardless of the stream. On a real ledger five read zero — tapping one
 * empties the timeline and teaches nothing. The rule now: a chip exists for
 * "all", for the active filter, and for any kind the stream actually holds.
 *
 * TJB-30: each suggested plan topic carried its reason in `title` — a tooltip,
 * which does not exist on touch. A chip proposing a plan for the parent's own
 * child gave no way to see where it came from. The reason is a visible
 * ContentWhyLine now.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTimeline, type SignalKind } from "../../lib/signalTimeline";
import { suggestedChallenges } from "../../lib/plans";
import type { BehaviorLog } from "../../types";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const STORY = read("components/tabs/StoryTimelineTab.tsx");
const PLANS = read("components/tabs/PlansTab.tsx");

/** The predicate the density applies, extracted so it can be exercised. */
const chipShown = (
  key: SignalKind | "all",
  active: SignalKind | "all",
  signals: { kind: SignalKind }[],
) => key === "all" || active === key || signals.some((s) => s.kind === key);

const log = (over: Partial<BehaviorLog> = {}): BehaviorLog => ({
  id: "b1", childId: "c", behaviorType: "Transition Refusal", intensity: 3,
  durationMinutes: 5, trigger: "leaving", response: "waited", context: "Home",
  notes: "", timestamp: new Date().toISOString(), resolved: false, ...over,
} as BehaviorLog);

describe("OBJ-JOURNAL-04 · zero-count filter chips", () => {
  const signals = buildTimeline({ behaviorLogs: [log()] }).map((s) => ({ kind: s.kind }));

  it("a stream of moments alone shows only 'all' and 'moment'", () => {
    const shown = (["all", "moment", "milestone", "plan", "play", "practice", "action", "memory"] as const)
      .filter((k) => chipShown(k, "all", signals));
    expect(shown).toEqual(["all", "moment"]);
  });

  it("the ACTIVE filter keeps its chip even when its count falls to zero", () => {
    expect(chipShown("plan", "plan", signals)).toBe(true);
    expect(chipShown("plan", "all", signals)).toBe(false);
  });

  it("the density applies exactly that predicate", () => {
    expect(STORY).toMatch(
      /FILTERS\.filter\(\(f\) => f\.key === "all" \|\| filter === f\.key \|\| signals\.some\(\(s\) => s\.kind === f\.key\)\)/,
    );
  });

  it("NEGATIVE CONTROL: the pre-fix row mapped every chip unconditionally", () => {
    expect(STORY).not.toMatch(/\{FILTERS\.map\(\(f\) => \{/);
  });
});

describe("TJB-30 · the suggestion chip shows its reason", () => {
  it("a suggestion carries a reason worth showing — a count of the parent's own logs", () => {
    const today = new Date().toISOString().slice(0, 10);
    const logs = [log({ id: "a" }), log({ id: "b" })];
    const [suggestion] = suggestedChallenges(logs, today);
    expect(suggestion).toBeTruthy();
    expect(suggestion.reason).toMatch(/\d/);
  });

  it("the reason renders as a ContentWhyLine, not a title attribute", () => {
    expect(PLANS).toContain('import { ContentWhyLine } from "../ui/ContentActionBar";');
    expect(PLANS).toMatch(/<ContentWhyLine why=\{s\.reason\} \/>/);
    // NEGATIVE CONTROL: the tooltip that shipped.
    expect(PLANS).not.toMatch(/title=\{s\.reason\}/);
  });

  it("no suggestion field is routed to a tooltip", () => {
    // `title` survives on PageHeader/SectionSkeleton, where it is a React prop
    // and not an HTML tooltip. What must not come back is a suggestion's own
    // copy hidden behind a hover.
    expect(PLANS).not.toMatch(/title=\{s\./);
  });
});
