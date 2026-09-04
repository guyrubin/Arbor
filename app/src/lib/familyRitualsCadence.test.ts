/**
 * ENG-25 — the Family Rituals cadence is real, and comes back on its own.
 *
 * WHAT SHIPPED: every ritual carried its cadence as PROSE ("Weekly, same
 * evening each week, 10 to 15 minutes around the table") rendered as a grey
 * chip in Arbor Academy, and nothing in the product ever read it. A ritual a
 * parent meant to run weekly never came back — there was no schedule, no
 * record of having run it, and no surface that asked.
 *
 * WHAT THESE PIN: `cadenceDays` exists on every ritual (the prose alone cannot
 * be scheduled), the turn logic, the record, and the mount on Growth.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FAMILY_RITUALS } from "./familyRituals";
import {
  DAY_MS,
  cadenceLabel,
  clearRitualRecord,
  daysUntilNextTurn,
  dueRituals,
  markRitualPractised,
  readRitualRecord,
  ritualIsDue,
  ritualOfTheMoment,
} from "./familyRitualsCadence";
import { en, he } from "./i18nElevation/returnhooks";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8").replace(/\r\n/g, "\n");

/** Minimal Storage double — the node env has no real one. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as unknown as Storage;
}

const NOW = Date.UTC(2026, 8, 4, 9, 0, 0);
const weekly = FAMILY_RITUALS.find((r) => r.id === "truth-practice-weekly")!;
const monthly = FAMILY_RITUALS.find((r) => r.id === "family-story-canon")!;

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  clearRitualRecord();
});

describe("ENG-25 — a cadence a machine can act on", () => {
  it("NEGATIVE CONTROL: the prose cadence alone yields no schedule", () => {
    // The exact shape that shipped: a sentence. Nothing derives a period from it.
    const prose = "Weekly, same evening each week, 10 to 15 minutes around the table.";
    expect(prose).toMatch(/weekly/i);
    expect(Number.parseInt(prose, 10)).toBeNaN();
  });

  it("every ritual now carries a positive cadence in DAYS", () => {
    expect(FAMILY_RITUALS.length).toBeGreaterThan(0);
    for (const r of FAMILY_RITUALS) {
      expect(typeof r.cadenceDays, r.id).toBe("number");
      expect(r.cadenceDays, r.id).toBeGreaterThan(0);
    }
    expect(weekly.cadenceDays).toBe(7);
    expect(monthly.cadenceDays).toBe(30);
  });

  it("the cadence label is an i18n key present in EN and HE, never raw copy", () => {
    for (const r of FAMILY_RITUALS) {
      const label = cadenceLabel(r);
      expect(en[label.key], `EN missing ${label.key}`).toBeTruthy();
      expect(he[label.key], `HE missing ${label.key}`).toBeTruthy();
    }
  });
});

describe("ENG-25 — whose turn it is", () => {
  it("a ritual never practised is due", () => {
    expect(ritualIsDue(weekly, NOW, {})).toBe(true);
    expect(dueRituals(NOW, {}).length).toBe(FAMILY_RITUALS.length);
  });

  it("a weekly ritual practised today is not due; at seven days it is again", () => {
    expect(ritualIsDue(weekly, NOW, { [weekly.id]: NOW })).toBe(false);
    expect(ritualIsDue(weekly, NOW, { [weekly.id]: NOW - 6 * DAY_MS })).toBe(false);
    expect(ritualIsDue(weekly, NOW, { [weekly.id]: NOW - 7 * DAY_MS })).toBe(true);
  });

  it("a monthly ritual is left alone for a month", () => {
    expect(ritualIsDue(monthly, NOW, { [monthly.id]: NOW - 20 * DAY_MS })).toBe(false);
    expect(ritualIsDue(monthly, NOW, { [monthly.id]: NOW - 31 * DAY_MS })).toBe(true);
  });

  it("ONE ritual is surfaced, and it is the most overdue", () => {
    const record: Record<string, number> = {};
    for (const r of FAMILY_RITUALS) record[r.id] = NOW; // everything settled
    expect(ritualOfTheMoment(NOW, record)).toBeNull();

    record[weekly.id] = NOW - 9 * DAY_MS; // 2 days past its turn
    record["weekly-reflection-sunday-reset"] = NOW - 30 * DAY_MS; // 23 days past
    const turn = ritualOfTheMoment(NOW, record);
    expect(turn).toBeTruthy();
    expect(turn!.ritual.id).toBe("weekly-reflection-sunday-reset");
    expect(turn!.daysOverdue).toBe(23);
    expect(turn!.firstTime).toBe(false);
  });

  it("a first-timer reports itself as one", () => {
    const turn = ritualOfTheMoment(NOW, {});
    expect(turn).toBeTruthy();
    expect(turn!.firstTime).toBe(true);
    expect(turn!.daysOverdue).toBe(0);
  });

  it("counts the days until a settled ritual comes back", () => {
    expect(daysUntilNextTurn(weekly, NOW, { [weekly.id]: NOW - 5 * DAY_MS })).toBe(2);
    expect(daysUntilNextTurn(weekly, NOW, { [weekly.id]: NOW - 8 * DAY_MS })).toBeNull();
    expect(daysUntilNextTurn(weekly, NOW, {})).toBeNull();
  });
});

describe("ENG-25 — the record is device-local and holds no child data", () => {
  it("marking a ritual practised restarts its clock and survives a re-read", () => {
    expect(ritualOfTheMoment(NOW, readRitualRecord())!.ritual.id).toBe(FAMILY_RITUALS[0].id);
    markRitualPractised(FAMILY_RITUALS[0].id, NOW);
    const record = readRitualRecord();
    expect(record[FAMILY_RITUALS[0].id]).toBe(NOW);
    expect(ritualIsDue(FAMILY_RITUALS[0], NOW, record)).toBe(false);
    expect(ritualOfTheMoment(NOW, record)!.ritual.id).not.toBe(FAMILY_RITUALS[0].id);
  });

  it("stores ids and timestamps only — nothing about a child", () => {
    markRitualPractised(weekly.id, NOW);
    const raw = localStorage.getItem("arbor.familyRituals.practised");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as Record<string, unknown>;
    for (const [k, v] of Object.entries(parsed)) {
      expect(FAMILY_RITUALS.some((r) => r.id === k)).toBe(true);
      expect(typeof v).toBe("number");
    }
  });

  it("garbage in storage degrades to an empty record, never a throw", () => {
    localStorage.setItem("arbor.familyRituals.practised", "{not json");
    expect(readRitualRecord()).toEqual({});
    localStorage.setItem("arbor.familyRituals.practised", '["a"]');
    expect(readRitualRecord()).toEqual({});
    localStorage.setItem("arbor.familyRituals.practised", '{"x":"soon"}');
    expect(readRitualRecord()).toEqual({});
  });
});

describe("ENG-25 — the cadence is surfaced on a real surface", () => {
  const growth = read("../components/tabs/DevelopmentTab.tsx");
  const card = read("../components/nextopen/RitualTurnCard.tsx");

  it("NEGATIVE CONTROL: before this change no surface referenced the cadence", () => {
    const shipped = '<span className="inline-block text-[10.5px] font-bold mt-2 px-2 py-0.5 rounded-full">{he ? r.cadenceHe : r.cadence}</span>';
    expect(/cadenceHe/.test(shipped)).toBe(true);
    expect(/ritualOfTheMoment|cadenceDays/.test(shipped)).toBe(false);
  });

  it("reads both files (a scan over an empty string proves nothing)", () => {
    expect(growth.length).toBeGreaterThan(2000);
    expect(card.length).toBeGreaterThan(1000);
  });

  it("Growth mounts the card, and the card runs the cadence + records a run", () => {
    expect(growth).toMatch(/<RitualTurnCard\s*\/>/);
    expect(card).toContain("ritualOfTheMoment");
    expect(card).toContain("markRitualPractised");
    expect(card).toContain('data-testid="ritual-turn-card"');
    // The run button exists and is a real 44px target.
    const btn = card.match(/data-testid="ritual-turn-practised"[\s\S]{0,600}?>/)?.[0];
    expect(btn).toBeTruthy();
    expect(btn).toContain("minHeight: 44");
  });

  it("the card is a family practice, never a measure of the child", () => {
    expect(card).not.toMatch(/\bstreak\b/i);
    expect(card).not.toMatch(/\{[^}]*\}%/);
    expect(card).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
