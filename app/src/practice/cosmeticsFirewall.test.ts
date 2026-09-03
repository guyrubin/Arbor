import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COSMETICS, evaluateCosmetics, lifetimeDomains, type CosmeticStats } from "./cosmetics";

/* BLOCKER 1 firewall guard (Kid Mode viral redesign, P0) + KID-02 (lane K).
 *
 * The redesigned kid dashboard surfaces the cosmetics economy (star counter,
 * earned titles) prominently to a CHILD. A consecutive-day streak metric or a
 * "X days in a row" / loss-framed reward is banned streak-anxiety on a child who
 * can't consent. This guard makes that enforceable: any reward driven by a
 * streak, or worded as a loss/countdown, turns CI red. A documented principle
 * would not. See docs/KID-MODE-VIRAL-REDESIGN-PLAN.md §8.
 *
 * KID-02 widened the rule from "not a streak" to "LIFETIME-MONOTONIC": the old
 * weekly `domainsTouched` metric earned the Explorer / All-rounder badges one
 * week and silently took them away the next. Now every metric a cosmetic may
 * key on is in MONOTONIC_METRICS (weekly / windowed fields are excluded by
 * construction) and a property test proves unlocked(S) ⊆ unlocked(S′) for any
 * S′ ≥ S.
 */

// Every metric a child-facing cosmetic may key on. ALL are lifetime-monotonic
// (only ever grow as ledgers grow). A windowed field (weekly breadth, streak,
// recent anything) must never appear here — adding one is the change this
// guard exists to block; it must be a deliberate, reviewed edit, not a slip.
const MONOTONIC_METRICS: ReadonlyArray<keyof CosmeticStats> = [
  "totalSessions",
  "daysPracticed",
  "domainsEverTouched",
];

/** Windowed / resettable field names that may NEVER be a cosmetic metric. */
const WINDOWED_FIELDS = ["domainsTouched", "streakDays", "streak", "activeDays", "sessionsThisWeek", "recentAccuracy"];

const LOSS_FRAMED = /in a row|streak|don'?t break|keep the streak|days? straight|consecutiv|this week|in a week/i;

describe("cosmetics firewall — no streak-anxiety reaches the child", () => {
  it("keys every cosmetic on a lifetime-monotonic metric", () => {
    for (const c of COSMETICS) {
      expect(MONOTONIC_METRICS, `${c.id} keys on a non-monotonic metric: ${c.metric}`).toContain(c.metric);
    }
  });

  it("never keys a cosmetic on a windowed field (the KID-02 regression class)", () => {
    for (const c of COSMETICS) {
      expect(WINDOWED_FIELDS, `${c.id} keys on windowed field ${c.metric}`).not.toContain(c.metric);
    }
  });

  it("the CosmeticStats shape itself carries no windowed field", () => {
    const src = readFileSync(new URL("./cosmetics.ts", import.meta.url), "utf8");
    const iface = src.slice(src.indexOf("export interface CosmeticStats"), src.indexOf("export interface Cosmetic ", src.indexOf("export interface CosmeticStats")));
    for (const f of WINDOWED_FIELDS) {
      expect(iface, `CosmeticStats declares windowed field ${f}`).not.toMatch(new RegExp(`^\\s*${f}\\s*:`, "m"));
    }
    for (const m of MONOTONIC_METRICS) {
      expect(iface, `CosmeticStats must declare ${m}`).toMatch(new RegExp(`^\\s*${m}\\s*:`, "m"));
    }
  });

  it("has no loss-framed / countdown / weekly-window requirement copy", () => {
    for (const c of COSMETICS) {
      expect(LOSS_FRAMED.test(c.requirement), `${c.id} requirement is loss-framed or windowed: "${c.requirement}"`).toBe(false);
    }
  });

  it("uses no fire/streak emoji on any reward", () => {
    for (const c of COSMETICS) {
      expect(c.emoji, `${c.id} uses a streak/fire emoji`).not.toBe("🔥");
    }
  });

  it("the cosmetics source itself contains no streak metric, fire emoji, or 'in a row' copy", () => {
    const src = readFileSync(new URL("./cosmetics.ts", import.meta.url), "utf8");
    expect(src).not.toContain("streakDays");
    expect(src).not.toContain("🔥");
    expect(src).not.toMatch(/in a row/i);
  });
});

/* ── KID-02: monotonicity property — a badge, once earned, is never lost ──── */

/** Deterministic PRNG (mulberry32) so a failure is reproducible from the seed. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomStats(next: () => number): CosmeticStats {
  return {
    totalSessions: Math.floor(next() * 60),
    daysPracticed: Math.floor(next() * 10),
    domainsEverTouched: Math.floor(next() * 6),
  };
}

/** A later lifetime state: every metric ≥ the earlier one (ledgers only grow). */
function laterStats(s: CosmeticStats, next: () => number): CosmeticStats {
  return {
    totalSessions: s.totalSessions + Math.floor(next() * 20),
    daysPracticed: s.daysPracticed + Math.floor(next() * 4),
    domainsEverTouched: Math.min(5, s.domainsEverTouched + Math.floor(next() * 3)),
  };
}

const unlockedIds = (s: CosmeticStats) => new Set(evaluateCosmetics(s).unlocked.map((c) => c.id));

describe("KID-02: unlocked(S) ⊆ unlocked(S′) for every lifetime-later S′ ≥ S", () => {
  it("holds across 500 seeded (S, S′) pairs", () => {
    const next = rng(20260903);
    for (let i = 0; i < 500; i++) {
      const s = randomStats(next);
      const later = laterStats(s, next);
      const before = unlockedIds(s);
      const after = unlockedIds(later);
      for (const id of before) {
        expect(after, `seed pair ${i}: ${id} was earned at ${JSON.stringify(s)} and LOST at ${JSON.stringify(later)}`).toContain(id);
      }
    }
  });

  it("negative control — a WINDOWED metric would violate the property (the pre-fix class)", () => {
    // The old shape: a badge keyed on this week's breadth. Week 1 touched 3
    // domains (badge earned); week 2 touched 1 (badge gone). The property test
    // above would catch exactly this — proven here on a synthetic catalog.
    type Windowed = CosmeticStats & { domainsTouched: number };
    const weeklyCatalog = [{ id: "weekly-explorer", kind: "badge" as const, label: "Explorer", emoji: "🧭", metric: "domainsTouched" as keyof CosmeticStats, threshold: 3, requirement: "Play across 3 areas in a week" }];
    const week1: Windowed = { totalSessions: 5, daysPracticed: 3, domainsEverTouched: 3, domainsTouched: 3 };
    const week2: Windowed = { totalSessions: 9, daysPracticed: 5, domainsEverTouched: 3, domainsTouched: 1 };
    const earnedWeek1 = evaluateCosmetics(week1, weeklyCatalog).unlocked.map((c) => c.id);
    const earnedWeek2 = evaluateCosmetics(week2, weeklyCatalog).unlocked.map((c) => c.id);
    expect(earnedWeek1).toContain("weekly-explorer");
    expect(earnedWeek2).not.toContain("weekly-explorer"); // earned-then-lost: the banned class
    // …and the SAME child on the lifetime metric keeps the badge.
    const lifetimeCatalog = COSMETICS.filter((c) => c.id === "explorer-badge");
    expect(evaluateCosmetics(week2, lifetimeCatalog).unlocked.map((c) => c.id)).toContain("explorer-badge");
  });
});

describe("KID-02: lifetimeDomains reads every ledger and only ever grows", () => {
  const empty = { speech: [], mimic: [], adventures: [], events: [], missions: [] };

  it("is empty with no play, and counts each ledger's domain once", () => {
    expect(lifetimeDomains(empty)).toEqual([]);
    const d = lifetimeDomains({
      speech: [{ id: "s1" }],
      mimic: [],
      adventures: [{ id: "a1" }],
      events: [{ domain: "emotional" }, { domain: "emotional" }, { domain: "language" }],
      missions: [{ domain: "social", completed: true }, { domain: "cognition", completed: false }],
    });
    expect([...d].sort()).toEqual(["cognition", "emotional", "language", "social", "speech"]);
  });

  it("an uncompleted mission does not count; a completed one does", () => {
    expect(lifetimeDomains({ ...empty, missions: [{ domain: "social", completed: false }] })).toEqual([]);
    expect(lifetimeDomains({ ...empty, missions: [{ domain: "social", completed: true }] })).toEqual(["social"]);
  });

  it("appending to any ledger never removes a domain", () => {
    const base = { ...empty, events: [{ domain: "language" as const }] };
    const grown = { ...base, events: [...base.events, { domain: "speech" as const }], mimic: [{ id: "m1" }] };
    for (const d of lifetimeDomains(base)) expect(lifetimeDomains(grown)).toContain(d);
  });
});
