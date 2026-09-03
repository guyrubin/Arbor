/**
 * W5 — milestone celebration chain (Masterplan Wave 5 "Mount the celebration
 * chain"). Source-based guards (repo runs vitest in node, no jsdom — same
 * style as milestonesPolish.test.ts / PlanBadge.test.ts) + pure dedupe logic
 * tests with injectable storage.
 *
 *  1) Mounts: MilestonesTab layers the shared CelebrationMoment on a fresh
 *     "yes" AND mounts PrideMomentCard (relocated from Today — Rule A).
 *  2) Dedupe: once per milestone id ever (arbor.celebrate.seen.{childId}) and
 *     the ≤1/session slot is checked BEFORE the overlay opens.
 *  3) Never on uncheck: the observe handler early-returns for anything that
 *     is not a fresh "yes".
 *  4) Parent register only: no playkit/kid-register imports on any of the
 *     three surfaces; share is parent-mediated via ShareButton only; no
 *     streak/countdown mechanics.
 *  5) Reduced motion: CelebrationMoment's internal guard is pinned, and the
 *     confetti burst is skipped under prefers-reduced-motion.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  celebrateSeenKey,
  celebrationSessionAvailable,
  hasCelebrated,
  loadCelebratedIds,
  markCelebrated,
} from "../ui/CelebrationMoment";

const SRC_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");

const milestonesTab = read("components/tabs/MilestonesTab.tsx");
const celebrationMoment = read("components/ui/CelebrationMoment.tsx");
const prideMomentCard = read("components/overview/PrideMomentCard.tsx");
const celebrateLib = read("lib/celebrate.ts");

/** Minimal in-memory Storage double for the pure helpers. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe("W5 mounts — the celebration chain is actually wired", () => {
  it("MilestonesTab layers CelebrationMoment as an overlay with the shared testId", () => {
    expect(milestonesTab).toContain("<CelebrationMoment");
    expect(milestonesTab).toContain('testId="milestone-celebration"');
    expect(milestonesTab).toContain('data-testid="milestone-celebration-overlay"');
    // A dialog, not a buried inline row.
    expect(milestonesTab).toContain('role="dialog"');
    expect(milestonesTab).toContain('aria-modal="true"');
  });

  it("PrideMomentCard is mounted in MilestonesTab (Rule A bars the Today mount)", () => {
    expect(milestonesTab).toContain("<PrideMomentCard");
    expect(milestonesTab).toMatch(/import PrideMomentCard from "\.\.\/overview\/PrideMomentCard"/);
  });

  it("OverviewTab (Rule A budget) did NOT gain the card — trigger-hook wiring only", () => {
    const overview = read("components/tabs/OverviewTab.tsx");
    expect(overview).not.toContain("PrideMomentCard");
    expect(overview).not.toContain("<CelebrationMoment");
  });
});

describe("W5 dedupe — once per milestone id, ≤1 per session, never on uncheck", () => {
  it("MilestonesTab gates the overlay on BOTH the per-milestone and the session guard", () => {
    expect(milestonesTab).toMatch(/hasCelebrated\(childProfile\.id,\s*item\.id\)\s*&&\s*celebrationSessionAvailable\(\)/);
    expect(milestonesTab).toContain("markCelebrated(childProfile.id, item.id)");
  });

  it("celebration fires ONLY on a fresh 'yes' — uncheck/not_yet/not_sure early-return", () => {
    expect(milestonesTab).toContain('if (status !== "yes" || item.checked) return;');
    // The observe buttons route through the ONE handler (no stray inline celebrate).
    expect(milestonesTab).toContain("observeMilestone(item, status)");
    expect(milestonesTab).not.toMatch(/status === "yes" && !item\.checked\) celebrate\(\)/);
  });

  it("the per-child seen key matches the masterplan contract", () => {
    expect(celebrateSeenKey("c1")).toBe("arbor.celebrate.seen.c1");
  });

  it("pure dedupe: mark → has → idempotent re-mark", () => {
    const store = fakeStorage();
    expect(hasCelebrated("c1", "m1", store)).toBe(false);
    markCelebrated("c1", "m1", store);
    expect(hasCelebrated("c1", "m1", store)).toBe(true);
    expect(hasCelebrated("c1", "m2", store)).toBe(false);
    expect(hasCelebrated("c2", "m1", store)).toBe(false); // per-child isolation
    markCelebrated("c1", "m1", store); // idempotent
    markCelebrated("c1", "m2", store);
    expect(loadCelebratedIds("c1", store)).toEqual(["m1", "m2"]);
  });

  it("pure dedupe: corrupt or absent storage degrades safely", () => {
    expect(loadCelebratedIds("c1", fakeStorage({ [celebrateSeenKey("c1")]: "{not json" }))).toEqual([]);
    expect(loadCelebratedIds("c1", fakeStorage({ [celebrateSeenKey("c1")]: '{"a":1}' }))).toEqual([]);
    expect(loadCelebratedIds("c1", undefined)).toEqual([]);
    expect(() => markCelebrated("c1", "m1", undefined)).not.toThrow();
  });

  it("session slot: available until claimed; storage-less shows rather than dead-ends", () => {
    expect(celebrationSessionAvailable(fakeStorage())).toBe(true);
    expect(celebrationSessionAvailable(fakeStorage({ "arbor.elev.celebrate.shown": "1" }))).toBe(false);
    expect(celebrationSessionAvailable(undefined)).toBe(true);
  });
});

describe("W5 register + safety walls", () => {
  it("parent register only — no playkit/kid-register imports on any chain surface", () => {
    for (const src of [milestonesTab, celebrationMoment, prideMomentCard]) {
      expect(src).not.toMatch(/from "[^"]*\/playkit"/);
      expect(src).not.toContain("PlayShell");
    }
  });

  it("share is parent-mediated ONLY — ShareButton, never a raw share/kid mechanic", () => {
    expect(celebrationMoment).toContain("<ShareButton");
    expect(celebrationMoment).not.toContain("navigator.share");
    // Kid dark-pattern ban: no streak/countdown/urgency mechanics in the chain.
    for (const src of [milestonesTab, celebrationMoment, prideMomentCard]) {
      expect(src.toLowerCase()).not.toMatch(/streak|countdown/);
    }
  });

  it("reduced motion is respected — card entrance AND the confetti burst", () => {
    expect(celebrationMoment).toContain("prefersReducedMotion()");
    // Wave T (CR-05/GP-24): the burst routes through the ONE capped primitive,
    // whose reduced-motion gate precedes the confetti call (pinned in
    // lib/celebrationCaps.test.ts as well).
    expect(milestonesTab).toMatch(/fireCelebration\(\{ kind: "milestone" \}\)/);
    expect(celebrateLib).toMatch(/if \(prefersReducedMotion\(\)\) return;[\s\S]{0,200}confetti\(/);
  });
});
