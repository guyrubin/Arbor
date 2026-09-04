/* GP-34 — "watch for it this week": a sometimes/not-yet answer becomes one
 * concrete thing to look for, instead of ending at "Retake".
 *
 * The mapping must be REAL. Screening item domains and milestone domains share
 * an id space, so the join is a domain match inside the child's own age window
 * — not a keyword guess, and never an out-of-band milestone.
 */

import { describe, expect, it } from "vitest";
import { AGE_BANDS, type ScreenAnswer } from "./screening";
import {
  clearWatchFocus,
  milestoneForScreenItem,
  readWatchFocus,
  resolveWatchFocus,
  watchOffersForScreening,
  watchableScreenItems,
  writeWatchFocus,
} from "./screeningWatch";
import type { Milestone } from "../types";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
  } as Storage;
}

const band = AGE_BANDS.find((b) => b.id === "1-2")!;
const langItem = band.items.find((i) => i.domain === "language_communication")!;
const socItem = band.items.find((i) => i.domain === "social_development")!;

const ms = (over: Partial<Milestone> & Pick<Milestone, "id" | "domain">): Milestone => ({
  title: `title-${over.id}`,
  description: "d",
  checked: false,
  ageMonths: 18,
  ...over,
} as Milestone);

// An 18-month-old: window = the 18m band + the one before it.
const MONTHS = 18;

describe("GP-34 — screening item → something to watch for", () => {
  it("only uncertain answers are offered — a clean 'yes' is not a watch item", () => {
    const answers: Record<string, ScreenAnswer> = { [langItem.id]: "yes", [socItem.id]: "sometimes" };
    expect(watchableScreenItems(band.items, answers).map((i) => i.id)).toEqual([socItem.id]);
  });

  it("maps to an OPEN milestone in the SAME domain (never another domain's)", () => {
    const milestones = [
      ms({ id: "lang-1", domain: "language_communication" }),
      ms({ id: "soc-1", domain: "social_development" }),
    ];
    expect(milestoneForScreenItem(langItem, milestones, MONTHS)?.id).toBe("lang-1");
    expect(milestoneForScreenItem(socItem, milestones, MONTHS)?.id).toBe("soc-1");
  });

  it("prefers the item the parent already marked 'not sure'", () => {
    const milestones = [
      ms({ id: "lang-plain", domain: "language_communication" }),
      ms({ id: "lang-unsure", domain: "language_communication", observationStatus: "not_sure" }),
    ];
    expect(milestoneForScreenItem(langItem, milestones, MONTHS)?.id).toBe("lang-unsure");
  });

  it("offers NOTHING rather than inventing something", () => {
    // Already noticed → not something to watch for.
    expect(milestoneForScreenItem(langItem, [ms({ id: "lang-1", domain: "language_communication", checked: true })], MONTHS)).toBeNull();
    // Out of the child's age window → never surfaced.
    expect(milestoneForScreenItem(langItem, [ms({ id: "lang-5y", domain: "language_communication", ageMonths: 60 })], MONTHS)).toBeNull();
    // No milestone in that domain at all.
    expect(milestoneForScreenItem(langItem, [ms({ id: "soc-1", domain: "social_development" })], MONTHS)).toBeNull();
  });

  it("de-duplicates: two uncertain items in one domain do not offer the same milestone twice", () => {
    const langItems = band.items.filter((i) => i.domain === "social_development");
    expect(langItems.length).toBeGreaterThan(1);
    const answers = Object.fromEntries(langItems.map((i) => [i.id, "not_yet" as ScreenAnswer]));
    const offers = watchOffersForScreening(band.items, answers, [ms({ id: "soc-1", domain: "social_development" })], MONTHS);
    expect(offers).toHaveLength(1);
    expect(offers[0].milestone.id).toBe("soc-1");
  });
});

describe("GP-34 — the choice carries to the Development hub", () => {
  it("round-trips, and is scoped to the child", () => {
    const s = fakeStorage();
    writeWatchFocus("c1", { milestoneId: "lang-1", screenItemId: langItem.id, chosenAt: "2026-09-04T00:00:00.000Z" }, s);
    expect(readWatchFocus("c1", s)?.milestoneId).toBe("lang-1");
    expect(readWatchFocus("c2", s)).toBeNull();
    clearWatchFocus("c1", s);
    expect(readWatchFocus("c1", s)).toBeNull();
  });

  it("retires itself once the milestone is noticed — a stale instruction is worse than none", () => {
    const s = fakeStorage();
    writeWatchFocus("c1", { milestoneId: "lang-1", screenItemId: langItem.id, chosenAt: "x" }, s);
    const open = [ms({ id: "lang-1", domain: "language_communication" })];
    expect(resolveWatchFocus("c1", open, s)?.id).toBe("lang-1");

    const noticed = [ms({ id: "lang-1", domain: "language_communication", checked: true })];
    expect(resolveWatchFocus("c1", noticed, s)).toBeNull();
    // …and a milestone that no longer exists at all.
    expect(resolveWatchFocus("c1", [], s)).toBeNull();
  });

  it("survives corrupt storage without taking the hub down", () => {
    const s = fakeStorage();
    s.setItem("arbor.screen.watch.c1", "{not json");
    expect(readWatchFocus("c1", s)).toBeNull();
    const blocked = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } } as unknown as Storage;
    expect(readWatchFocus("c1", blocked)).toBeNull();
    expect(() => writeWatchFocus("c1", { milestoneId: "m", screenItemId: "i", chosenAt: "x" }, blocked)).not.toThrow();
  });
});
