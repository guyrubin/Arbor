import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Milestone } from "../../types";
import { DOMAIN_IDS } from "../domains/registry";
import { ALL_MILESTONES } from "../milestoneData";
import type { Observation } from "../observations";
import { noticedMilestoneCounts } from "../pulse";
import { groupMilestonesByShelf } from "./shelfMap";
import * as domainMap from "./domainMap";
import { lastMomentByDomain, noticedByDomain } from "./domainMap";

/* v3 FEAT-03 — the development map's numbers: Seen-it per registry domain,
   folded from the shelf counts (Sleep and Food → body), integers only, no
   not-yet count, and the newest parent-written entry per domain. Catalogue
   rows only; no child data. */

const here = path.dirname(fileURLToPath(import.meta.url));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SOURCE = strip(readFileSync(path.join(here, "domainMap.ts"), "utf8").replace(/\r\n/g, "\n"));
const catalogue = (): Milestone[] => ALL_MILESTONES.map((m) => ({ ...m }));
const seen = (m: Milestone): Milestone => ({ ...m, checked: true, observationStatus: "yes" });
/** The catalogue carries no Sleep skill: the Sleep shelf fills from rows the
 *  parent adds (tag `sleep`, lib/shelves/registry milestoneShelf). Invented. */
const PARENT_SLEEP: Milestone = { id: "ms-sleep-own", custom: true, tags: ["sleep"], domain: "health_sleep_feeding", ageGroup: "Custom", title: "Falls asleep after one story", description: "x", checked: false };

describe("noticedByDomain — Seen it per domain, nothing else", () => {
  it("returns every registry domain, in registry order, at zero on an empty record", () => {
    const counts = noticedByDomain([]);
    expect(Object.keys(counts)).toEqual([...DOMAIN_IDS]);
    expect(Object.keys(counts)).toHaveLength(8);
    for (const id of DOMAIN_IDS) expect(counts[id]).toBe(0);
  });

  it("folds the Sleep and the Food shelf into body", () => {
    const by = groupMilestonesByShelf(catalogue());
    expect(by.food.length).toBeGreaterThan(0);
    const ms = [...catalogue().map((m) => (m.id === by.food[0].id ? seen(m) : m)), seen(PARENT_SLEEP)];
    expect(groupMilestonesByShelf(ms).sleep.map((m) => m.id)).toEqual([PARENT_SLEEP.id]);
    const counts = noticedByDomain(ms);
    expect(counts.body).toBe(2);
    for (const id of DOMAIN_IDS) if (id !== "body") expect(counts[id]).toBe(0);
  });

  it("counts only Seen it: Not yet and Not sure answers never add up anywhere", () => {
    const ms = catalogue().map((m, i) => (i % 3 === 0 ? { ...m, observationStatus: "not_yet" as const } : i % 3 === 1 ? { ...m, observationStatus: "not_sure" as const } : m));
    const counts = noticedByDomain(ms);
    for (const id of DOMAIN_IDS) expect(counts[id]).toBe(0);
  });

  it("gives integers that add up to the one noticed count Care and Growth read", () => {
    const ms = catalogue().map((m, i) => (i % 5 === 0 ? seen(m) : m));
    const counts = noticedByDomain(ms);
    for (const id of DOMAIN_IDS) expect(Number.isInteger(counts[id])).toBe(true);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(noticedMilestoneCounts(ms).noticed);
  });

  it("exports no not-yet reader, no denominator and no ranking", () => {
    expect(Object.keys(domainMap).sort()).toEqual(["lastMomentByDomain", "noticedByDomain"]);
    expect(SOURCE).not.toMatch(/not_yet|not_sure|notYet|\btotal\b|%|\.sort\(|DOMAIN_COUNT/);
  });
});

describe("lastMomentByDomain — the newest entry the parent wrote", () => {
  const entry = (id: string, at: string, over: Partial<Observation> = {}): Observation => ({
    id, childId: "child-a", at, domains: ["talking"], kind: "moment", origin: "behaviorLogs", source: "parent_typed",
    value: { type: "moment", behaviorType: "Moment" }, ageAtObservationMonths: null, pretermCorrected: false, ...over,
  });

  it("picks the newest parent-written entry per domain", () => {
    const last = lastMomentByDomain([
      entry("behaviorLogs:a", "2026-09-01T10:00:00Z"),
      entry("behaviorLogs:b", "2026-09-20T10:00:00Z"),
      entry("behaviorLogs:c", "2026-09-10T10:00:00Z", { domains: ["talking", "feelings"] }),
    ]);
    expect(last.talking?.id).toBe("behaviorLogs:b");
    expect(last.feelings?.id).toBe("behaviorLogs:c");
    expect(last.moving).toBeUndefined();
  });

  it("leaves out kid practice, professional entries, measurements and undated rows", () => {
    const last = lastMomentByDomain([
      entry("speechAttempts:a", "2026-09-30T10:00:00Z", { source: "kid_practice", origin: "speechAttempts", value: { type: "practice", activity: "speech" } }),
      entry("memory:a", "2026-09-29T10:00:00Z", { source: "professional_entered", origin: "memory", value: { type: "fact", fact: "A note" } }),
      entry("growthEntries:a", "2026-09-28T10:00:00Z", { origin: "growthEntries", value: { type: "measurement" } }),
      entry("behaviorLogs:x", "not a date"),
      entry("behaviorLogs:kept", "2026-09-01T10:00:00Z"),
    ]);
    expect(last.talking?.id).toBe("behaviorLogs:kept");
  });

  it("an empty record has no last moment anywhere", () => {
    expect(lastMomentByDomain([])).toEqual({});
  });
});
